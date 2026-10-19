"""RedGreenGo coach proxy: the web app sends each finished TDD step here, and
this service asks Claude to judge it. The Anthropic API key lives only on
this server; students never see it.

Every request needs a class code (X-Class-Code header). Codes, their daily
request limits and token usage live in a SQLite file next to this script.

Run behind nginx (see deploy/), listening on localhost only:
  python coach_server.py serve                       start on 127.0.0.1:8100
  python coach_server.py add-class CODE "Name" [--limit 600] [--tokens 2000000]
  python coach_server.py disable-class CODE
  python coach_server.py classes                     list codes and today's use
  python coach_server.py usage [--days 7]            tokens per class per day
  python coach_server.py progress [CODE] [--days N] [--csv]   one row per pair, for grading
  python coach_server.py clear-progress CODE [--yes]

Needs ANTHROPIC_API_KEY in the environment. RGG_COACH_PORT and RGG_COACH_DB
override the port and the SQLite file.

Endpoints:
  POST /coach     body: a step (see coach.py); returns the coach's verdict.
                  With pair and game_id, the verdict is also counted in that game's progress.
  POST /progress  body: the browser's own progress counts for one game (see validate_progress);
                  needs an active class code but doesn't use up its allowance
  GET  /health    "ok"
"""

import argparse
import datetime
import json
import os
import sqlite3
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import anthropic

from coach import MODEL, BadStep, ask_coach, validate

ALLOWED_ORIGINS = {"http://localhost:8080", "https://kenpower.github.io"}
PORT = int(os.environ.get("RGG_COACH_PORT", 8100))
DB_PATH = Path(os.environ.get("RGG_COACH_DB", Path(__file__).parent / "coach.sqlite3"))
DEFAULT_DAILY_LIMIT = 600  # requests per class per day; a pair does ~30 steps per problem
# Tokens per class per day: uncached input + cache writes + output. Cache reads
# (the shared system prompt) cost a tenth as much and aren't counted. A step
# uses ~2-3k, so 600 steps fit; padded requests run out well before that.
DEFAULT_DAILY_TOKENS = 2_000_000
MAX_BODY_BYTES = 100_000  # 4 fields of MAX_TEXT plus JSON escaping
MAX_PROGRESS_BYTES = 4_000

PROGRESS_PHASES = {"red", "swap", "green", "refactor", "finished"}
PROGRESS_COUNTS = ("steps", "cycles", "overrides", "back_to_red")
MAX_COUNT = 10_000
COACH_DECISIONS = ("advance", "redo", "back_to_red")

client = None  # created by serve(), so the admin commands don't need the API key


def db():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    con.executescript(
        """
        CREATE TABLE IF NOT EXISTS classes (
            code TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            daily_limit INTEGER NOT NULL,
            active INTEGER NOT NULL DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS usage (
            id INTEGER PRIMARY KEY,
            code TEXT NOT NULL,
            day TEXT NOT NULL,
            kata TEXT, phase TEXT,
            input INTEGER, cache_write INTEGER, cache_read INTEGER, output INTEGER
        );
        CREATE INDEX IF NOT EXISTS usage_code_day ON usage (code, day);
        -- One row per game. steps..finished are reported by the browser; the coach_*
        -- counts are written here from the coach's own verdicts, so they can be trusted.
        CREATE TABLE IF NOT EXISTS progress (
            game_id TEXT PRIMARY KEY,
            code TEXT NOT NULL,
            pair TEXT NOT NULL DEFAULT '',
            problem TEXT NOT NULL DEFAULT '',
            started TEXT NOT NULL,
            updated TEXT NOT NULL,
            steps INTEGER NOT NULL DEFAULT 0,
            cycles INTEGER NOT NULL DEFAULT 0,
            phase TEXT NOT NULL DEFAULT '',
            overrides INTEGER NOT NULL DEFAULT 0,
            back_to_red INTEGER NOT NULL DEFAULT 0,
            coach_asks INTEGER NOT NULL DEFAULT 0,
            coach_advance INTEGER NOT NULL DEFAULT 0,
            coach_redo INTEGER NOT NULL DEFAULT 0,
            coach_back_to_red INTEGER NOT NULL DEFAULT 0,
            coach_advice INTEGER NOT NULL DEFAULT 0,
            finished INTEGER NOT NULL DEFAULT 0,
            coach_agreed_finish INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS progress_code ON progress (code, updated);
        """
    )
    columns = {r["name"] for r in con.execute("PRAGMA table_info(classes)")}
    if "daily_tokens" not in columns:  # databases created before the token budget
        con.execute(f"ALTER TABLE classes ADD COLUMN daily_tokens INTEGER NOT NULL DEFAULT {DEFAULT_DAILY_TOKENS}")
        con.commit()
    return con


def tokens_used(con, code):
    return con.execute(
        "SELECT COALESCE(SUM(input + cache_write + output), 0) FROM usage WHERE code = ? AND day = ?",
        (code, today()),
    ).fetchone()[0]


def today():
    return datetime.date.today().isoformat()


def now():
    return datetime.datetime.now().isoformat(timespec="seconds")


def class_active(con, code):
    row = con.execute("SELECT active FROM classes WHERE code = ?", (code,)).fetchone()
    return bool(row and row["active"])


def check_class(con, code):
    """Return None if the class may make a request, else (status, message)."""
    row = con.execute("SELECT daily_limit, daily_tokens, active FROM classes WHERE code = ?", (code,)).fetchone()
    if not row or not row["active"]:
        return 403, "unknown class code"
    used = con.execute("SELECT COUNT(*) FROM usage WHERE code = ? AND day = ?", (code, today())).fetchone()[0]
    if used >= row["daily_limit"] or tokens_used(con, code) >= row["daily_tokens"]:
        return 429, "this class has used today's coaching allowance"
    return None


def record_usage(con, code, step, usage):
    # The kata column predates kata-agnostic coaching and is left NULL.
    con.execute(
        "INSERT INTO usage (code, day, phase, input, cache_write, cache_read, output) VALUES (?,?,?,?,?,?,?)",
        (code, today(), step["phase"], usage.input_tokens,
         usage.cache_creation_input_tokens or 0, usage.cache_read_input_tokens or 0, usage.output_tokens),
    )
    con.commit()


def record_verdict(con, code, step, verdict):
    """Count the coach's verdict in the game's progress row. Older clients send no game_id."""
    game_id = step.get("game_id")
    if not game_id:
        return
    decision = verdict.get("decision")
    counts = {f"coach_{d}": int(decision == d) for d in COACH_DECISIONS}
    counts["coach_advice"] = int(bool(verdict.get("advice")))
    counts["coach_agreed_finish"] = int(step["phase"] == "finish" and decision == "advance")
    stamp = now()
    # The WHERE keeps one class from writing into another class's game.
    con.execute(
        "INSERT INTO progress (game_id, code, pair, problem, started, updated, coach_asks, "
        f"{', '.join(counts)}) VALUES (?, ?, ?, ?, ?, ?, 1, {', '.join('?' * len(counts))}) "
        "ON CONFLICT(game_id) DO UPDATE SET updated = excluded.updated, coach_asks = coach_asks + 1, "
        + ", ".join(f"{c} = {c} + excluded.{c}" for c in counts if c != "coach_agreed_finish")
        + ", coach_agreed_finish = MAX(coach_agreed_finish, excluded.coach_agreed_finish), "
        "pair = CASE WHEN excluded.pair != '' THEN excluded.pair ELSE pair END "
        "WHERE progress.code = excluded.code",
        (game_id, code, step.get("pair") or "", (step.get("problem") or "")[:100], stamp, stamp, *counts.values()),
    )
    con.commit()


class BadProgress(ValueError):
    pass


def validate_progress(body):
    if not isinstance(body, dict):
        raise BadProgress("body must be an object")
    for field, longest in (("game_id", 64), ("pair", 200), ("problem", 100)):
        if not isinstance(body.get(field), str) or len(body[field]) > longest:
            raise BadProgress(f"{field} must be a string of at most {longest} characters")
    if not body["game_id"]:
        raise BadProgress("game_id is required")
    for field in PROGRESS_COUNTS:
        value = body.get(field)
        if type(value) is not int or not 0 <= value <= MAX_COUNT:  # type(): a bool is not a count
            raise BadProgress(f"{field} must be a whole number from 0 to {MAX_COUNT}")
    if body.get("phase") not in PROGRESS_PHASES:
        raise BadProgress(f"phase must be one of {', '.join(sorted(PROGRESS_PHASES))}")
    if not isinstance(body.get("finished"), bool):
        raise BadProgress("finished must be true or false")


def record_progress(con, code, body):
    stamp = now()
    fields = ("pair", "problem", *PROGRESS_COUNTS, "phase", "finished")
    values = [body[f] for f in fields[:-1]] + [int(body["finished"])]
    con.execute(
        f"INSERT INTO progress (game_id, code, started, updated, {', '.join(fields)}) "
        f"VALUES (?, ?, ?, ?, {', '.join('?' * len(fields))}) "
        "ON CONFLICT(game_id) DO UPDATE SET updated = excluded.updated, "
        + ", ".join(f"{f} = excluded.{f}" for f in fields)
        + " WHERE progress.code = excluded.code",
        (body["game_id"], code, stamp, stamp, *values),
    )
    con.commit()


class Handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_cors_headers()
        self.send_header("Access-Control-Allow-Methods", "POST")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Class-Code")
        self.send_header("Access-Control-Max-Age", "86400")
        self.end_headers()

    def do_GET(self):
        if self.path == "/health":
            self.send_json(200, {"status": "ok"})
        else:
            self.send_json(404, {"error": "not found"})

    def do_POST(self):
        routes = {"/coach": (MAX_BODY_BYTES, self.coach), "/progress": (MAX_PROGRESS_BYTES, self.progress)}
        if self.path not in routes:
            return self.send_json(404, {"error": "not found"})
        if self.headers.get("Origin") not in ALLOWED_ORIGINS:
            return self.send_json(403, {"error": "origin not allowed"})

        max_bytes, handle = routes[self.path]
        length = int(self.headers.get("Content-Length") or 0)
        if not 0 < length <= max_bytes:
            return self.send_json(413, {"error": "request too large"})
        try:
            body = json.loads(self.rfile.read(length))
        except (json.JSONDecodeError, UnicodeDecodeError):
            return self.send_json(400, {"error": "body must be JSON"})
        handle(body, (self.headers.get("X-Class-Code") or "").strip().upper())

    def progress(self, body, code):
        try:
            validate_progress(body)
        except BadProgress as e:
            return self.send_json(400, {"error": str(e)})
        con = db()
        try:
            if not class_active(con, code):
                return self.send_json(403, {"error": "unknown class code"})
            record_progress(con, code, body)
            self.send_json(200, {"status": "ok"})
        finally:
            con.close()

    def coach(self, step, code):
        try:
            validate(step)
        except BadStep as e:
            return self.send_json(400, {"error": str(e)})

        con = db()
        try:
            refused = check_class(con, code)
            if refused:
                return self.send_json(refused[0], {"error": refused[1]})
            try:
                verdict, usage = ask_coach(client, step)
            except anthropic.RateLimitError:
                return self.send_json(503, {"error": "coach is busy, try again shortly"})
            except (anthropic.APIError, RuntimeError, json.JSONDecodeError, StopIteration) as e:
                self.log_error("coach failed: %r", e)
                return self.send_json(502, {"error": "coach unavailable"})
            record_usage(con, code, step, usage)
            record_verdict(con, code, step, verdict)
            self.send_json(200, verdict)
        finally:
            con.close()

    def send_json(self, status, data):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_cors_headers()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_cors_headers(self):
        origin = self.headers.get("Origin")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")


def serve(_args):
    global client
    client = anthropic.Anthropic(timeout=60.0, max_retries=2)
    db().close()  # create tables before the first request
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"RedGreenGo coach on http://127.0.0.1:{PORT} ({MODEL})")
    server.serve_forever()


def add_class(args):
    with db() as con:
        con.execute(
            "INSERT INTO classes (code, name, daily_limit, daily_tokens) VALUES (?, ?, ?, ?) "
            "ON CONFLICT(code) DO UPDATE SET name = excluded.name, daily_limit = excluded.daily_limit, "
            "daily_tokens = excluded.daily_tokens, active = 1",
            (args.code.upper(), args.name, args.limit, args.tokens),
        )
    print(f"class {args.code.upper()} ({args.name}): {args.limit} requests/day, {args.tokens} tokens/day")


def disable_class(args):
    with db() as con:
        changed = con.execute("UPDATE classes SET active = 0 WHERE code = ?", (args.code.upper(),)).rowcount
    print("disabled" if changed else "no such class")


def list_classes(_args):
    con = db()
    rows = con.execute(
        "SELECT c.code, c.name, c.daily_limit, c.daily_tokens, c.active, "
        "(SELECT COUNT(*) FROM usage u WHERE u.code = c.code AND u.day = ?) AS used "
        "FROM classes c ORDER BY c.code",
        (today(),),
    ).fetchall()
    print("class        reqs today   tokens today         name")
    for r in rows:
        status = "" if r["active"] else "  (disabled)"
        tokens = f"{tokens_used(con, r['code'])}/{r['daily_tokens']}"
        print(f"{r['code']:<12} {r['used']:>4}/{r['daily_limit']:<5} {tokens:<20} {r['name']}{status}")


def show_usage(args):
    since = (datetime.date.today() - datetime.timedelta(days=args.days - 1)).isoformat()
    con = db()
    rows = con.execute(
        "SELECT day, code, COUNT(*) AS n, SUM(input) AS i, SUM(cache_write) AS w, SUM(cache_read) AS r, "
        "SUM(output) AS o FROM usage WHERE day >= ? GROUP BY day, code ORDER BY day, code",
        (since,),
    ).fetchall()
    print("day         class        reqs   input  c.write   c.read   output")
    for r in rows:
        print(f"{r['day']}  {r['code']:<12} {r['n']:>4} {r['i']:>7} {r['w']:>8} {r['r']:>8} {r['o']:>8}")


def pair_key(pair):
    """jane__john and john__jane are the same pair."""
    return "__".join(sorted(pair.split("__")))


def show_progress(args):
    """One row per pair, adding up all its games."""
    con = db()
    where, params = [], []
    if args.code:
        where.append("code = ?")
        params.append(args.code.upper())
    if args.days:
        where.append("updated >= ?")
        params.append((datetime.date.today() - datetime.timedelta(days=args.days - 1)).isoformat())
    rows = con.execute(
        "SELECT * FROM progress" + (" WHERE " + " AND ".join(where) if where else "") + " ORDER BY updated",
        params,
    ).fetchall()

    pairs = {}
    for r in rows:  # oldest first, so the latest spelling of the pair wins
        p = pairs.setdefault((r["code"], pair_key(r["pair"])), {
            "games": 0, "steps": 0, "cycles": 0, "coach_asks": 0, "coach_advance": 0, "holds": 0,
            "overrides": 0, "finished": 0, "coach_agreed": 0,
        })
        p["class"], p["pair"], p["last_active"] = r["code"], r["pair"] or "(no names)", r["updated"]
        p["games"] += 1
        for f in ("steps", "cycles", "coach_asks", "coach_advance", "overrides", "finished"):
            p[f] += r[f]
        p["holds"] += r["coach_redo"] + r["coach_back_to_red"]
        p["coach_agreed"] += r["coach_agreed_finish"]
    for p in pairs.values():
        p["first_time_pct"] = round(100 * p["coach_advance"] / p["coach_asks"]) if p["coach_asks"] else ""

    columns = ["class", "pair", "games", "last_active", "steps", "cycles", "coach_asks", "first_time_pct",
               "holds", "overrides", "finished", "coach_agreed"]
    ordered = sorted(pairs.values(), key=lambda p: (p["class"], p["pair"]))
    if args.csv:
        import csv
        writer = csv.DictWriter(sys.stdout, fieldnames=columns, extrasaction="ignore", lineterminator="\n")
        writer.writeheader()
        writer.writerows(ordered)
        return
    print(f"{'class':<10} {'pair':<28} {'games':>5}  {'last active':<19} {'steps':>5} {'cycles':>6} "
          f"{'asks':>5} {'1st ok':>6} {'holds':>5} {'overr':>5}  finished (coach agreed)")
    for p in ordered:
        pct = f"{p['first_time_pct']}%" if p["coach_asks"] else "-"
        print(f"{p['class']:<10} {p['pair']:<28} {p['games']:>5}  {p['last_active']:<19} {p['steps']:>5} "
              f"{p['cycles']:>6} {p['coach_asks']:>5} {pct:>6} {p['holds']:>5} {p['overrides']:>5}  "
              f"{p['finished']}/{p['games']} ({p['coach_agreed']})")
    if not ordered:
        print("(no progress recorded)")


def clear_progress(args):
    code = args.code.upper()
    con = db()
    games = con.execute("SELECT COUNT(*) FROM progress WHERE code = ?", (code,)).fetchone()[0]
    if not games:
        print(f"no progress recorded for {code}")
        return
    if not args.yes:
        answer = input(f"Delete {games} game(s) of progress for {code}? Type the class code to confirm: ")
        if answer.strip().upper() != code:
            print("cancelled")
            return
    with con:
        con.execute("DELETE FROM progress WHERE code = ?", (code,))
    print(f"deleted {games} game(s) of progress for {code}")


def main(argv):
    parser = argparse.ArgumentParser(description="RedGreenGo coach proxy")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("serve").set_defaults(func=serve)
    p = sub.add_parser("add-class", help="add or update a class code")
    p.add_argument("code")
    p.add_argument("name")
    p.add_argument("--limit", type=int, default=DEFAULT_DAILY_LIMIT, help="requests per day")
    p.add_argument("--tokens", type=int, default=DEFAULT_DAILY_TOKENS, help="tokens per day (cache reads not counted)")
    p.set_defaults(func=add_class)
    p = sub.add_parser("disable-class")
    p.add_argument("code")
    p.set_defaults(func=disable_class)
    sub.add_parser("classes").set_defaults(func=list_classes)
    p = sub.add_parser("usage")
    p.add_argument("--days", type=int, default=7)
    p.set_defaults(func=show_usage)
    p = sub.add_parser("progress", help="one row per pair, for grading")
    p.add_argument("code", nargs="?", help="only this class")
    p.add_argument("--days", type=int, help="only games active in the last N days")
    p.add_argument("--csv", action="store_true", help="CSV for a spreadsheet")
    p.set_defaults(func=show_progress)
    p = sub.add_parser("clear-progress", help="delete a class's progress records")
    p.add_argument("code")
    p.add_argument("--yes", action="store_true", help="don't ask for confirmation")
    p.set_defaults(func=clear_progress)
    args = parser.parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main(sys.argv[1:])
