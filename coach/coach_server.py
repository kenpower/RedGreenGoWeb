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
  python coach_server.py clear-progress CODE [--yes] also deletes the class's events
  python coach_server.py teacher-link CODE [--rotate]          the secret link to the live class view
  python coach_server.py grades CODE [--csv]         the rubric grades given in the teacher view
  python coach_server.py clear-grades CODE [--yes]

Needs ANTHROPIC_API_KEY in the environment. RGG_COACH_PORT and RGG_COACH_DB
override the port and the SQLite file.

Endpoints:
  POST /coach     body: a step (see coach.py); returns the coach's verdict.
                  With pair and game_id, a Done verdict is also counted in that game's progress
                  (a verdict call, or a Look with done: true). {mode: "look", done: true,
                  reuse: true, game_id, pair, phase} counts the game's last Look instead, without
                  a model call: 200 {status: "recorded", decision}, or 409 if there is none to reuse.
  POST /progress  body: the browser's own progress counts and new events for one game (see
                  validate_progress); needs an active class code but doesn't use up its allowance
  GET  /class?code=CODE   {"ok": true, "name"} for an active class, else 404 {"ok": false};
                  the game checks the code before it starts. Doesn't use up the allowance.
  GET  /health    "ok"

Teacher endpoints need X-Class-Code and X-Teacher-Key (from teacher-link):
  GET  /teacher/progress             games updated in the last 12 hours
  GET  /teacher/pair?key=PAIR_KEY    one pair's games, summary counts and event timeline
  GET  /teacher/rubric               PUT {"criteria": [{id, name, description?}]} replaces it
  GET  /teacher/grades[?pair_key=K]  PUT {"pair_key", "grades": [{criterion, score, comment}]} upserts
"""

import argparse
import datetime
import hmac
import json
import os
import re
import secrets
import sqlite3
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlsplit

import anthropic

from coach import MODEL, BadStep, ask_coach, validate

ALLOWED_ORIGINS = {"http://localhost:8080", "https://kenpower.github.io"}
# The game page served by the students' own helper (rgg_server.py); /coach and /progress only.
HELPER_ORIGINS = {"http://127.0.0.1:8000", "http://localhost:8000"}
APP_URL = "https://kenpower.github.io/RedGreenGoWeb/"
PORT = int(os.environ.get("RGG_COACH_PORT", 8100))
DB_PATH = Path(os.environ.get("RGG_COACH_DB", Path(__file__).parent / "coach.sqlite3"))
DEFAULT_DAILY_LIMIT = 600  # requests per class per day; a pair does ~30 steps per problem
# Tokens per class per day: uncached input + cache writes + output. Cache reads
# (the shared system prompt) cost a tenth as much and aren't counted. A step
# uses ~2-3k, so 600 steps fit; padded requests run out well before that.
DEFAULT_DAILY_TOKENS = 2_000_000
# A Look at its largest (coach.py's limits): tests, code, tests_before, code_before and
# test_result at 10k characters each, an 8k problem, 20 findings and 5 history notes of 500,
# a 60-step catalogue of ~360, plus the short fields: ~95k characters. JSON escaping and
# UTF-8 add 10-50% on code, so 200k leaves room. nginx allows 256k.
MAX_BODY_BYTES = 200_000
MAX_PROGRESS_BYTES = 40_000  # 10 events of 500 characters, even if every one is escaped
MAX_TEACHER_BYTES = 40_000

PROGRESS_PHASES = {"red", "swap", "green", "refactor", "finished", "test", "commit"}  # test, commit: refactor lab
PROGRESS_COUNTS = ("steps", "cycles", "overrides", "back_to_red")
# Added with the learning features; optional so an old cached client still works.
PROGRESS_EXTRA_COUNTS = ("overrides_in_row", "predictions_right", "predictions_total", "intents_given",
                         "hints_l2", "hints_l3", "smells_shown", "smells_revealed", "rescues",
                         "passed_first", "rounds", "commits", "reverts")  # the last three: refactor lab
PROGRESS_ADDED_COLUMNS = {
    "held": "INTEGER NOT NULL DEFAULT 0",
    "held_since": "REAL",
    "last_note": "TEXT NOT NULL DEFAULT ''",
    **{c: "INTEGER NOT NULL DEFAULT 0" for c in PROGRESS_EXTRA_COUNTS},
    "mode": "TEXT NOT NULL DEFAULT 'tdd'",  # tdd | refactor (DESIGN-refactor-lab.md)
    "refactorings": "TEXT NOT NULL DEFAULT '{}'",  # JSON {"Extract Function": 3, ...}, running totals
}
GAME_MODES = {"tdd", "refactor"}
MAX_REFACTORING_KINDS = 20
MAX_COUNT = 10_000
COACH_DECISIONS = ("advance", "redo", "back_to_red")
NON_VERDICT_MODES = {"orient", "look", "next_steps"}
LOOK_REUSE_SECONDS = 600  # a Done can reuse a Look this recent
REUSE_PHASES = {"red", "green", "refactor", "finish"}  # the step phases coach.py accepts

EVENT_KINDS = {"advance", "hold", "release", "override", "back_to_red", "intent", "prediction",
               "hint", "smell", "commit", "finish", "rescue", "passed_first_time", "orient",
               "recheck",  # detail = the phase the pair re-checked from
               "refactor_move"}  # detail = "<refactoring> | <effect>", e.g. "Extract Function | better"
EVENT_PHASES = PROGRESS_PHASES | {"finish", ""}
MAX_EVENTS_PER_CALL = 10
MAX_EVENTS_PER_GAME = 3_000
MAX_PAIR_EVENTS = 10_000
EARLIEST_TIME = 1_600_000_000  # 2020; anything before is a broken clock

TEACHER_WINDOW = datetime.timedelta(hours=12)
DEFAULT_RUBRIC = [
    {"id": "tdd", "name": "TDD discipline",
     "description": "One failing test at a time; only enough code to pass it; refactor on green."},
    {"id": "tests", "name": "Test quality",
     "description": "Each test checks one behaviour, is named for it, and fails for the right reason."},
    {"id": "refactoring", "name": "Refactoring",
     "description": "Spots duplication and unclear names, and tidies them without changing behaviour."},
    {"id": "collaboration", "name": "Collaboration",
     "description": "Swaps roles, says the next test before typing it, and talks through the design."},
    {"id": "commits", "name": "Small commits",
     "description": "Commits after each cycle, with messages that say what changed."},
]
CRITERION_ID = re.compile(r"[a-z0-9_-]{1,40}")
MAX_CRITERIA = 12
MAX_GRADES_PER_PUT = 20
MAX_COMMENT = 1_000

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
        -- Later columns (held, last_note, predictions_...) are added below.
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
        -- The browser's timeline of each game (t is the browser's clock), for the teacher view.
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY,
            game_id TEXT NOT NULL,
            code TEXT NOT NULL,
            t REAL NOT NULL,
            kind TEXT NOT NULL,
            phase TEXT NOT NULL,
            cycle INTEGER NOT NULL,
            detail TEXT NOT NULL
        );
        -- The browser resends events until a call succeeds; this drops the repeats.
        CREATE UNIQUE INDEX IF NOT EXISTS events_once ON events (game_id, t, kind, cycle, detail);
        CREATE INDEX IF NOT EXISTS events_code ON events (code, game_id);
        CREATE TABLE IF NOT EXISTS rubric (
            code TEXT PRIMARY KEY,
            criteria TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS grades (
            code TEXT NOT NULL,
            pair_key TEXT NOT NULL,
            criterion TEXT NOT NULL,
            score INTEGER,
            comment TEXT NOT NULL DEFAULT '',
            updated INTEGER NOT NULL,
            PRIMARY KEY (code, pair_key, criterion)
        );
        -- The last Look the coach answered for each game, so a Done with unchanged code
        -- can count that verdict without another call (see reuse_look).
        CREATE TABLE IF NOT EXISTS looks (
            game_id TEXT PRIMARY KEY,
            code TEXT NOT NULL,
            t INTEGER NOT NULL,
            phase TEXT NOT NULL,
            verdict TEXT NOT NULL,
            used INTEGER NOT NULL DEFAULT 0
        );
        """
    )
    columns = {r["name"] for r in con.execute("PRAGMA table_info(classes)")}
    if "daily_tokens" not in columns:  # databases created before the token budget
        con.execute(f"ALTER TABLE classes ADD COLUMN daily_tokens INTEGER NOT NULL DEFAULT {DEFAULT_DAILY_TOKENS}")
    if "teacher_key" not in columns:  # databases created before the teacher view
        con.execute("ALTER TABLE classes ADD COLUMN teacher_key TEXT")
    columns = {r["name"] for r in con.execute("PRAGMA table_info(usage)")}
    if "rescue" not in columns:  # 1 for a "Show me the code" request, an extra coach call
        con.execute("ALTER TABLE usage ADD COLUMN rescue INTEGER NOT NULL DEFAULT 0")
    if "mode" not in columns:  # the request's mode (orient, look, ...); NULL in older rows
        con.execute("ALTER TABLE usage ADD COLUMN mode TEXT")
    columns = {r["name"] for r in con.execute("PRAGMA table_info(progress)")}
    for column, kind in {**PROGRESS_ADDED_COLUMNS, "ip": "TEXT NOT NULL DEFAULT ''"}.items():
        if column not in columns:
            con.execute(f"ALTER TABLE progress ADD COLUMN {column} {kind}")
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


def epoch(stamp):
    """A stored now() string as epoch seconds."""
    return int(datetime.datetime.fromisoformat(stamp).timestamp())


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
        "INSERT INTO usage (code, day, phase, mode, rescue, input, cache_write, cache_read, output) "
        "VALUES (?,?,?,?,?,?,?,?,?)",
        (code, today(), step["phase"], step.get("mode", "verdict"), int(step.get("rescue") is True),
         usage.input_tokens,
         usage.cache_creation_input_tokens or 0, usage.cache_read_input_tokens or 0, usage.output_tokens),
    )
    con.commit()


def record_verdict(con, code, step, verdict):
    """Count the coach's verdict in the game's progress row. Older clients send no game_id.
    Only a Done verdict counts: a verdict call, or a Look sent for a Done click (done: true).
    Orient, plain Look and next-steps calls guide but never hold."""
    game_id = step.get("game_id")
    is_done = step.get("mode", "verdict") not in NON_VERDICT_MODES or step.get("done") is True
    if not game_id or not is_done:
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


def remember_look(con, code, step, verdict):
    """Keep a Look's verdict for one later reuse. A Look made for a Done is counted
    already, so it is stored as used."""
    game_id = step.get("game_id")
    if step.get("mode") != "look" or not game_id or verdict.get("decision") not in COACH_DECISIONS:
        return
    con.execute(
        "INSERT INTO looks (game_id, code, t, phase, verdict, used) VALUES (?, ?, ?, ?, ?, ?) "
        "ON CONFLICT(game_id) DO UPDATE SET t = excluded.t, phase = excluded.phase, "
        "verdict = excluded.verdict, used = excluded.used WHERE looks.code = excluded.code",
        (game_id, code, int(time.time()), step["phase"],
         json.dumps({"decision": verdict["decision"], "advice": bool(verdict.get("advice"))}),
         int(step.get("done") is True)),
    )
    con.commit()


def reuse_look(con, code, step):
    """A Done whose code hasn't changed since the last Look: count that Look's stored
    verdict, once, without calling the coach. Returns the decision, or None if there is
    no unused Look for this game and phase from the last LOOK_REUSE_SECONDS. Whatever
    decision the browser holds is ignored, so a reuse can't be forged."""
    row = con.execute(
        "SELECT verdict FROM looks WHERE game_id = ? AND code = ? AND phase = ? AND used = 0 AND t >= ?",
        (step["game_id"], code, step["phase"], int(time.time()) - LOOK_REUSE_SECONDS),
    ).fetchone()
    # used = 0 again in the UPDATE: of two reuses at once, only one wins
    if not row or not con.execute(
        "UPDATE looks SET used = 1 WHERE game_id = ? AND code = ? AND used = 0", (step["game_id"], code)
    ).rowcount:
        return None
    verdict = json.loads(row["verdict"])
    record_verdict(con, code, step, verdict)  # commits
    return verdict["decision"]


def validate_reuse(step):
    if step.get("mode") != "look" or step.get("done") is not True:
        raise BadStep("reuse is for a Look sent for a Done click (mode look, done true)")
    if not isinstance(step.get("game_id"), str) or not 0 < len(step["game_id"]) <= 64:
        raise BadStep("game_id is required")
    if not isinstance(step.get("pair", ""), str) or len(step.get("pair", "")) > 200:
        raise BadStep("pair must be text of at most 200 characters")
    if step.get("phase") not in REUSE_PHASES:
        raise BadStep("phase must be red, green, refactor or finish")


class BadProgress(ValueError):
    pass


def check_string(body, field, longest):
    if not isinstance(body.get(field), str) or len(body[field]) > longest:
        raise BadProgress(f"{field} must be a string of at most {longest} characters")


def check_count(body, field):
    value = body.get(field)
    if type(value) is not int or not 0 <= value <= MAX_COUNT:  # type(): a bool is not a count
        raise BadProgress(f"{field} must be a whole number from 0 to {MAX_COUNT}")


def check_time(value, field):
    if type(value) not in (int, float) or not EARLIEST_TIME <= value <= time.time() + 86_400:
        raise BadProgress(f"{field} must be a time in epoch seconds")


def validate_progress(body):
    """Raise BadProgress unless body is a valid progress report. Fills in the
    fields an older client leaves out."""
    if not isinstance(body, dict):
        raise BadProgress("body must be an object")
    for field, longest in (("game_id", 64), ("pair", 200), ("problem", 100)):
        check_string(body, field, longest)
    if not body["game_id"]:
        raise BadProgress("game_id is required")
    for field in PROGRESS_COUNTS:
        check_count(body, field)
    if body.get("phase") not in PROGRESS_PHASES:
        raise BadProgress(f"phase must be one of {', '.join(sorted(PROGRESS_PHASES))}")
    if not isinstance(body.get("finished"), bool):
        raise BadProgress("finished must be true or false")

    for field in PROGRESS_EXTRA_COUNTS:
        body.setdefault(field, 0)
        check_count(body, field)
    if not isinstance(body.setdefault("held", False), bool):
        raise BadProgress("held must be true or false")
    if body.setdefault("held_since", None) is not None:
        check_time(body["held_since"], "held_since")
    body.setdefault("last_note", "")
    check_string(body, "last_note", 300)
    if body.setdefault("mode", "tdd") not in GAME_MODES:
        raise BadProgress("mode must be tdd or refactor")
    kinds = body.setdefault("refactorings", {})
    if (not isinstance(kinds, dict) or len(kinds) > MAX_REFACTORING_KINDS
            or not all(isinstance(k, str) and 0 < len(k) <= 60 and type(v) is int and 0 <= v <= MAX_COUNT
                       for k, v in kinds.items())):
        raise BadProgress(f"refactorings must map at most {MAX_REFACTORING_KINDS} names (60 characters) "
                          f"to whole numbers from 0 to {MAX_COUNT}")

    events = body.setdefault("events", [])
    if not isinstance(events, list) or len(events) > MAX_EVENTS_PER_CALL:
        raise BadProgress(f"events must be a list of at most {MAX_EVENTS_PER_CALL}")
    for event in events:
        if not isinstance(event, dict):
            raise BadProgress("each event must be an object")
        check_time(event.get("t"), "event t")
        if event.get("kind") not in EVENT_KINDS:
            raise BadProgress(f"event kind must be one of {', '.join(sorted(EVENT_KINDS))}")
        if event.get("phase") not in EVENT_PHASES:
            raise BadProgress(f"event phase must be one of {', '.join(sorted(EVENT_PHASES))}")
        check_count(event, "cycle")
        check_string(event, "detail", 500)


def record_progress(con, code, body, ip):
    """ip is where the latest report came from, so the teacher can match a tile to a lab PC."""
    stamp = now()
    fields = ("pair", "problem", *PROGRESS_COUNTS, "phase", "finished", *PROGRESS_ADDED_COLUMNS)
    con.execute(
        f"INSERT INTO progress (game_id, code, started, updated, ip, {', '.join(fields)}) "
        f"VALUES (?, ?, ?, ?, ?, {', '.join('?' * len(fields))}) "
        "ON CONFLICT(game_id) DO UPDATE SET updated = excluded.updated, ip = excluded.ip, "
        + ", ".join(f"{f} = excluded.{f}" for f in fields)
        + " WHERE progress.code = excluded.code",
        (body["game_id"], code, stamp, stamp, ip,
         *(json.dumps(body[f], sort_keys=True) if f == "refactorings" else body[f] for f in fields)),
    )
    owner = con.execute("SELECT code FROM progress WHERE game_id = ?", (body["game_id"],)).fetchone()
    stored = con.execute("SELECT COUNT(*) FROM events WHERE game_id = ?", (body["game_id"],)).fetchone()[0]
    # Same rule as the progress row: no events into another class's game. The cap
    # stops one game filling the disk.
    if owner["code"] == code and stored < MAX_EVENTS_PER_GAME:
        con.executemany(
            "INSERT OR IGNORE INTO events (game_id, code, t, kind, phase, cycle, detail) VALUES (?,?,?,?,?,?,?)",
            [(body["game_id"], code, e["t"], e["kind"], e["phase"], e["cycle"], e["detail"]) for e in body["events"]],
        )
    con.commit()


def pair_key(pair):
    """jane__john and john__jane are the same pair."""
    return "__".join(sorted(pair.split("__")))


SUMMED = ("steps", "cycles", "coach_asks", "coach_advance", "overrides", "back_to_red", "finished",
          *PROGRESS_EXTRA_COUNTS)


def summarize(rows):
    """Add up a pair's games."""
    s = dict.fromkeys(SUMMED, 0)
    s.update(games=len(rows), holds=0, coach_agreed=0, refactorings={})
    for r in rows:
        for f in SUMMED:
            s[f] += r[f]
        s["holds"] += r["coach_redo"] + r["coach_back_to_red"]
        s["coach_agreed"] += r["coach_agreed_finish"]
        for kind, n in json.loads(r["refactorings"]).items():
            s["refactorings"][kind] = s["refactorings"].get(kind, 0) + n
    s["first_time_pct"] = round(100 * s["coach_advance"] / s["coach_asks"]) if s["coach_asks"] else None
    return s


def refactorings_text(kinds):
    """{"Extract Function": 3, "Rename Variable": 2} as "Extract Function:3; Rename Variable:2", most first."""
    return "; ".join(f"{k}:{n}" for k, n in sorted(kinds.items(), key=lambda kn: (-kn[1], kn[0])))


def game_json(r):
    """One progress row for the teacher view."""
    game = {f: r[f] for f in ("game_id", "pair", "problem", "phase", "held_since", "last_note", "ip", "mode",
                              *SUMMED)}
    game.update(
        refactorings=json.loads(r["refactorings"]),
        pair_key=pair_key(r["pair"]),
        started=epoch(r["started"]),
        updated=epoch(r["updated"]),
        held=bool(r["held"]),
        finished=bool(r["finished"]),
        coach_holds=r["coach_redo"] + r["coach_back_to_red"],
    )
    return game


def get_rubric(con, code):
    row = con.execute("SELECT criteria FROM rubric WHERE code = ?", (code,)).fetchone()
    return json.loads(row["criteria"]) if row else DEFAULT_RUBRIC


class BadRequest(ValueError):
    pass


def validate_rubric(body):
    criteria = body.get("criteria") if isinstance(body, dict) else None
    if not isinstance(criteria, list) or not 1 <= len(criteria) <= MAX_CRITERIA:
        raise BadRequest(f"criteria must be a list of 1 to {MAX_CRITERIA}")
    cleaned, ids = [], set()
    for c in criteria:
        if not isinstance(c, dict):
            raise BadRequest("each criterion must be an object")
        if not isinstance(c.get("id"), str) or not CRITERION_ID.fullmatch(c["id"]) or c["id"] in ids:
            raise BadRequest("each criterion needs a unique id of a-z, 0-9, _ or -, at most 40 characters")
        if not isinstance(c.get("name"), str) or not 0 < len(c["name"]) <= 80:
            raise BadRequest("each criterion needs a name of at most 80 characters")
        description = c.get("description", "")
        if not isinstance(description, str) or len(description) > 500:
            raise BadRequest("a description must be a string of at most 500 characters")
        ids.add(c["id"])
        cleaned.append({"id": c["id"], "name": c["name"], "description": description})
    return cleaned


def validate_grades(body, rubric_ids):
    if not isinstance(body, dict):
        raise BadRequest("body must be an object")
    if not isinstance(body.get("pair_key"), str) or not 0 < len(body["pair_key"]) <= 200:
        raise BadRequest("pair_key must be a string of at most 200 characters")
    grades = body.get("grades")
    if not isinstance(grades, list) or not 1 <= len(grades) <= MAX_GRADES_PER_PUT:
        raise BadRequest(f"grades must be a list of 1 to {MAX_GRADES_PER_PUT}")
    for g in grades:
        if not isinstance(g, dict):
            raise BadRequest("each grade must be an object")
        if g.get("criterion") not in rubric_ids:
            raise BadRequest("each grade's criterion must be the id of a criterion in the class rubric")
        if g.get("score") is not None and (type(g["score"]) is not int or not 0 <= g["score"] <= 4):
            raise BadRequest("score must be a whole number from 0 to 4, or null")
        if not isinstance(g.setdefault("comment", ""), str) or len(g["comment"]) > MAX_COMMENT:
            raise BadRequest(f"comment must be a string of at most {MAX_COMMENT} characters")


def grades_json(con, code, key=None):
    rows = con.execute(
        "SELECT pair_key, criterion, score, comment, updated FROM grades WHERE code = ?"
        + (" AND pair_key = ?" if key is not None else "") + " ORDER BY pair_key, criterion",
        (code, key) if key is not None else (code,),
    ).fetchall()
    return {"grades": [dict(r) for r in rows]}


class Handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_cors_headers()
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Class-Code, X-Teacher-Key")
        self.send_header("Access-Control-Max-Age", "86400")
        self.end_headers()

    def do_GET(self):
        if self.path == "/health":
            return self.send_json(200, {"status": "ok"})
        if urlsplit(self.path).path == "/class":
            return self.dispatch({"/class": (None, self.check_code)})
        self.dispatch({
            "/teacher/progress": (None, self.teacher_progress),
            "/teacher/pair": (None, self.teacher_pair),
            "/teacher/rubric": (None, self.teacher_rubric),
            "/teacher/grades": (None, self.teacher_grades),
        }, teacher=True)

    def do_POST(self):
        self.dispatch({"/coach": (MAX_BODY_BYTES, self.coach), "/progress": (MAX_PROGRESS_BYTES, self.progress)})

    def do_PUT(self):
        self.dispatch({
            "/teacher/rubric": (MAX_TEACHER_BYTES, self.put_rubric),
            "/teacher/grades": (MAX_TEACHER_BYTES, self.put_grades),
        }, teacher=True)

    def dispatch(self, routes, teacher=False):
        """Check the route, origin and body size, then call the handler with the
        parsed body (or the query, for a GET) and the class code. Teacher handlers
        also get a database connection, and are only called with the right key."""
        url = urlsplit(self.path)
        if url.path not in routes:
            return self.send_json(404, {"error": "not found"})
        if not self.origin_allowed():
            return self.send_json(403, {"error": "origin not allowed"})

        max_bytes, handle = routes[url.path]
        if max_bytes:
            try:
                length = int(self.headers.get("Content-Length") or 0)
            except ValueError:
                length = 0
            if not 0 < length <= max_bytes:
                return self.send_json(413, {"error": "request too large"})
            try:
                data = json.loads(self.rfile.read(length))
            except (json.JSONDecodeError, UnicodeDecodeError):
                return self.send_json(400, {"error": "body must be JSON"})
        else:
            data = {k: v[0] for k, v in parse_qs(url.query).items()}
        code = (self.headers.get("X-Class-Code") or "").strip().upper()
        if not teacher:
            return handle(data, code)

        con = db()
        try:
            row = con.execute("SELECT teacher_key FROM classes WHERE code = ?", (code,)).fetchone()
            if not row:
                return self.send_json(404, {"error": "unknown class code"})
            given = (self.headers.get("X-Teacher-Key") or "").strip().encode()
            if not row["teacher_key"] or not hmac.compare_digest(row["teacher_key"].encode(), given):
                return self.send_json(403, {"error": "wrong teacher key"})
            try:
                handle(con, code, data)
            except BadRequest as e:
                self.send_json(400, {"error": str(e)})
        finally:
            con.close()

    def check_code(self, query, _header_code):
        """The game checks a class code before it starts. Free: no allowance used."""
        code = query.get("code", "").strip().upper()
        con = db()
        try:
            row = con.execute("SELECT name FROM classes WHERE code = ? AND active = 1", (code,)).fetchone()
        finally:
            con.close()
        if row:
            self.send_json(200, {"ok": True, "name": row["name"]})
        else:
            self.send_json(404, {"ok": False})

    def progress(self, body, code):
        try:
            validate_progress(body)
        except BadProgress as e:
            return self.send_json(400, {"error": str(e)})
        con = db()
        try:
            if not class_active(con, code):
                return self.send_json(403, {"error": "unknown class code"})
            record_progress(con, code, body, self.client_ip())
            self.send_json(200, {"status": "ok"})
        finally:
            con.close()

    def coach(self, step, code):
        if isinstance(step, dict) and step.get("reuse") is True:
            return self.reuse(step, code)
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
            remember_look(con, code, step, verdict)
            self.send_json(200, verdict)
        finally:
            con.close()

    def reuse(self, step, code):
        """POST /coach {mode: "look", done: true, reuse: true, game_id, pair, phase}:
        200 {status: "recorded", decision}, or 409 when there is no Look to reuse
        (the browser then makes a real call). No model call, no allowance used."""
        try:
            validate_reuse(step)
        except BadStep as e:
            return self.send_json(400, {"error": str(e)})
        con = db()
        try:
            if not class_active(con, code):
                return self.send_json(403, {"error": "unknown class code"})
            decision = reuse_look(con, code, step)
            if decision is None:
                return self.send_json(409, {"error": "no recent look to reuse"})
            self.send_json(200, {"status": "recorded", "decision": decision})
        finally:
            con.close()

    def teacher_progress(self, con, code, _query):
        since = (datetime.datetime.now() - TEACHER_WINDOW).isoformat(timespec="seconds")
        name = con.execute("SELECT name FROM classes WHERE code = ?", (code,)).fetchone()["name"]
        rows = con.execute(
            "SELECT * FROM progress WHERE code = ? AND updated >= ? ORDER BY updated DESC", (code, since)
        ).fetchall()
        self.send_json(200, {"class": code, "name": name, "now": int(time.time()),
                             "games": [game_json(r) for r in rows]})

    def teacher_pair(self, con, code, query):
        key = query.get("key", "")
        rows = [r for r in con.execute("SELECT * FROM progress WHERE code = ? ORDER BY updated", (code,))
                if pair_key(r["pair"]) == key]
        if not rows:
            return self.send_json(404, {"error": "no games for that pair"})
        game_ids = [r["game_id"] for r in rows]
        events = con.execute(
            "SELECT game_id, t, kind, phase, cycle, detail FROM events "
            f"WHERE code = ? AND game_id IN ({', '.join('?' * len(game_ids))}) ORDER BY t, id LIMIT ?",
            (code, *game_ids, MAX_PAIR_EVENTS),
        ).fetchall()
        self.send_json(200, {
            "pair_key": key,
            "pair": rows[-1]["pair"],
            "summary": summarize(rows),
            "games": [game_json(r) for r in reversed(rows)],
            "events": [dict(e) for e in events],
        })

    def teacher_rubric(self, con, code, _query):
        self.send_json(200, {"criteria": get_rubric(con, code)})

    def put_rubric(self, con, code, body):
        criteria = validate_rubric(body)
        with con:
            con.execute(
                "INSERT INTO rubric (code, criteria) VALUES (?, ?) "
                "ON CONFLICT(code) DO UPDATE SET criteria = excluded.criteria",
                (code, json.dumps(criteria)),
            )
        self.send_json(200, {"criteria": criteria})

    def teacher_grades(self, con, code, query):
        self.send_json(200, grades_json(con, code, query.get("pair_key")))

    def put_grades(self, con, code, body):
        validate_grades(body, {c["id"] for c in get_rubric(con, code)})
        key, stamp = body["pair_key"], int(time.time())
        with con:
            for g in body["grades"]:
                if g.get("score") is None and not g["comment"]:
                    con.execute("DELETE FROM grades WHERE code = ? AND pair_key = ? AND criterion = ?",
                                (code, key, g["criterion"]))
                    continue
                con.execute(
                    "INSERT INTO grades (code, pair_key, criterion, score, comment, updated) VALUES (?,?,?,?,?,?) "
                    "ON CONFLICT(code, pair_key, criterion) DO UPDATE SET score = excluded.score, "
                    "comment = excluded.comment, updated = excluded.updated",
                    (code, key, g["criterion"], g.get("score"), g["comment"], stamp),
                )
        self.send_json(200, grades_json(con, code, key))

    def send_json(self, status, data):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_cors_headers()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def client_ip(self):
        """nginx puts the real address in X-Real-IP; without nginx (local runs) it's the socket's."""
        return (self.headers.get("X-Real-IP") or self.client_address[0]).strip()[:45]

    def origin_allowed(self):
        origin = self.headers.get("Origin")
        return origin in ALLOWED_ORIGINS or (origin in HELPER_ORIGINS and not self.path.startswith("/teacher/"))

    def send_cors_headers(self):
        origin = self.headers.get("Origin")
        if self.origin_allowed():
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
        "SELECT day, code, COUNT(*) AS n, COUNT(CASE WHEN mode = 'orient' THEN 1 END) AS orients, "
        "COUNT(CASE WHEN mode = 'look' THEN 1 END) AS looks, "
        "SUM(rescue) AS rescues, SUM(input) AS i, SUM(cache_write) AS w, SUM(cache_read) AS r, SUM(output) AS o "
        "FROM usage WHERE day >= ? GROUP BY day, code ORDER BY day, code",
        (since,),
    ).fetchall()
    # reqs counts every call; orient, look and rescue are the ones of each kind among them
    print("day         class        reqs orient  look rescue   input  c.write   c.read   output")
    for r in rows:
        print(f"{r['day']}  {r['code']:<12} {r['n']:>4} {r['orients']:>6} {r['looks']:>5} {r['rescues']:>6} "
              f"{r['i']:>7} {r['w']:>8} {r['r']:>8} {r['o']:>8}")


def write_csv(rows, columns):
    import csv
    writer = csv.DictWriter(sys.stdout, fieldnames=columns, extrasaction="ignore", lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)


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

    games = {}
    for r in rows:
        games.setdefault((r["code"], pair_key(r["pair"])), []).append(r)
    pairs = []
    for (code, _), group in games.items():
        p = summarize(group)
        # oldest first, so the latest spelling of the pair wins
        p.update({"class": code, "pair": group[-1]["pair"] or "(no names)", "last_active": group[-1]["updated"]})
        pairs.append(p)

    columns = ["class", "pair", "games", "last_active", "steps", "cycles", "coach_asks", "first_time_pct",
               "holds", "overrides", "rescues", "passed_first", "rounds", "commits", "reverts", "refactorings",
               "finished", "coach_agreed"]
    ordered = sorted(pairs, key=lambda p: (p["class"], p["pair"]))
    if args.csv:
        return write_csv([{**p, "refactorings": refactorings_text(p["refactorings"])} for p in ordered], columns)
    print(f"{'class':<10} {'pair':<28} {'games':>5}  {'last active':<19} {'steps':>5} {'cycles':>6} "
          f"{'asks':>5} {'1st ok':>6} {'holds':>5} {'overr':>5} {'rescue':>6} {'kept':>4} {'rounds':>6} {'revert':>6}"
          f"  finished (coach agreed)")
    for p in ordered:
        pct = f"{p['first_time_pct']}%" if p["coach_asks"] else "-"
        print(f"{p['class']:<10} {p['pair']:<28} {p['games']:>5}  {p['last_active']:<19} {p['steps']:>5} "
              f"{p['cycles']:>6} {p['coach_asks']:>5} {pct:>6} {p['holds']:>5} {p['overrides']:>5} "
              f"{p['rescues']:>6} {p['passed_first']:>4} {p['rounds']:>6} {p['reverts']:>6}  "
              f"{p['finished']}/{p['games']} ({p['coach_agreed']})")
    if not ordered:
        print("(no progress recorded)")


def confirm(question, code, yes):
    """Ask before deleting; the admin types the class code to agree."""
    if yes:
        return True
    if input(f"{question} Type the class code to confirm: ").strip().upper() == code:
        return True
    print("cancelled")
    return False


def clear_progress(args):
    code = args.code.upper()
    con = db()
    games = con.execute("SELECT COUNT(*) FROM progress WHERE code = ?", (code,)).fetchone()[0]
    events = con.execute("SELECT COUNT(*) FROM events WHERE code = ?", (code,)).fetchone()[0]
    if not games and not events:
        print(f"no progress recorded for {code}")
        return
    if not confirm(f"Delete {games} game(s) of progress and {events} event(s) for {code}?", code, args.yes):
        return
    with con:
        con.execute("DELETE FROM progress WHERE code = ?", (code,))
        con.execute("DELETE FROM events WHERE code = ?", (code,))
        con.execute("DELETE FROM looks WHERE code = ?", (code,))
    print(f"deleted {games} game(s) of progress and {events} event(s) for {code} (grades are kept)")


def teacher_link(args):
    code = args.code.upper()
    with db() as con:
        row = con.execute("SELECT teacher_key FROM classes WHERE code = ?", (code,)).fetchone()
        if not row:
            sys.exit(f"no such class: {code}")
        key = row["teacher_key"]
        if not key or args.rotate:
            key = secrets.token_urlsafe(24)
            con.execute("UPDATE classes SET teacher_key = ? WHERE code = ?", (key, code))
    print(APP_URL + "?" + urlencode({"teacher": code, "key": key}))


def show_grades(args):
    """One row per graded pair: a score per rubric criterion, then the comments."""
    code = args.code.upper()
    con = db()
    criteria = get_rubric(con, code)
    names = {pair_key(r["pair"]): r["pair"]
             for r in con.execute("SELECT pair FROM progress WHERE code = ? ORDER BY updated", (code,))}
    pairs = {}
    for g in con.execute("SELECT * FROM grades WHERE code = ?", (code,)):
        p = pairs.setdefault(g["pair_key"], {"pair": names.get(g["pair_key"], g["pair_key"])})
        p[g["criterion"]] = "" if g["score"] is None else g["score"]
        p[g["criterion"] + " comment"] = g["comment"]
    for p in pairs.values():
        p["total"] = sum(p.get(c["id"]) or 0 for c in criteria)
    ordered = sorted(pairs.values(), key=lambda p: p["pair"])

    if args.csv:
        rows = [{"pair": p["pair"], "total": p["total"],
                 **{c["name"]: p.get(c["id"], "") for c in criteria},
                 **{c["name"] + " comment": p.get(c["id"] + " comment", "") for c in criteria}}
                for p in ordered]
        return write_csv(rows, ["pair", *(c["name"] for c in criteria), "total",
                                *(c["name"] + " comment" for c in criteria)])
    print(f"{'pair':<28} " + " ".join(f"{c['id'][:12]:>12}" for c in criteria) + f" {'total':>6}")
    for p in ordered:
        print(f"{p['pair']:<28} " + " ".join(f"{p.get(c['id'], '-')!s:>12}" for c in criteria)
              + f" {p['total']:>6}")
    if not ordered:
        print(f"(no grades for {code})")


def clear_grades(args):
    code = args.code.upper()
    con = db()
    count = con.execute("SELECT COUNT(*) FROM grades WHERE code = ?", (code,)).fetchone()[0]
    if not count:
        print(f"no grades recorded for {code}")
        return
    if not confirm(f"Delete {count} grade(s) for {code}?", code, args.yes):
        return
    with con:
        con.execute("DELETE FROM grades WHERE code = ?", (code,))
    print(f"deleted {count} grade(s) for {code}")


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
    p = sub.add_parser("clear-progress", help="delete a class's progress records and events")
    p.add_argument("code")
    p.add_argument("--yes", action="store_true", help="don't ask for confirmation")
    p.set_defaults(func=clear_progress)
    p = sub.add_parser("teacher-link", help="print the secret link to the live class view")
    p.add_argument("code")
    p.add_argument("--rotate", action="store_true", help="make a new key; the old link stops working")
    p.set_defaults(func=teacher_link)
    p = sub.add_parser("grades", help="rubric grades from the teacher view")
    p.add_argument("code")
    p.add_argument("--csv", action="store_true", help="CSV for a spreadsheet")
    p.set_defaults(func=show_grades)
    p = sub.add_parser("clear-grades", help="delete a class's rubric grades")
    p.add_argument("code")
    p.add_argument("--yes", action="store_true", help="don't ask for confirmation")
    p.set_defaults(func=clear_grades)
    args = parser.parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main(sys.argv[1:])
