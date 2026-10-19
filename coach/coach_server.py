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

Needs ANTHROPIC_API_KEY in the environment. RGG_COACH_PORT and RGG_COACH_DB
override the port and the SQLite file.

Endpoints:
  POST /coach    body: a step (see coach.py); returns the coach's verdict
  GET  /health   "ok"
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
        if self.path != "/coach":
            return self.send_json(404, {"error": "not found"})
        if self.headers.get("Origin") not in ALLOWED_ORIGINS:
            return self.send_json(403, {"error": "origin not allowed"})

        length = int(self.headers.get("Content-Length") or 0)
        if not 0 < length <= MAX_BODY_BYTES:
            return self.send_json(413, {"error": "request too large"})
        try:
            step = json.loads(self.rfile.read(length))
            validate(step)
        except (json.JSONDecodeError, UnicodeDecodeError):
            return self.send_json(400, {"error": "body must be JSON"})
        except BadStep as e:
            return self.send_json(400, {"error": str(e)})

        code = (self.headers.get("X-Class-Code") or "").strip().upper()
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
    args = parser.parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main(sys.argv[1:])
