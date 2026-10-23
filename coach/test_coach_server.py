"""Regression tests for coach_server.py: progress and events, the teacher endpoints,
the class-code check, which coach calls count, Done/reuse, and the admin commands.

Runs a real server in-process on a free port with a temporary database. The model
call is faked and coach.py's own validation is switched off, so no API key is needed
and the tests check only the server's handling (coach.py has its own fixtures).

  cd coach && python -m unittest test_coach_server -v
"""

import contextlib
import io
import json
import shutil
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path
from types import SimpleNamespace

import coach_server as s

GAME = "https://kenpower.github.io"
HELPER = "http://127.0.0.1:8000"
fake = {"answer": {}, "calls": []}
server = base = tmp = None


def fake_ask(_client, step):
    fake["calls"].append(step.get("mode", "verdict"))
    usage = SimpleNamespace(input_tokens=10, cache_creation_input_tokens=0, cache_read_input_tokens=0,
                            output_tokens=1)
    return dict(fake["answer"]), usage


def setUpModule():
    global server, base, tmp
    tmp = tempfile.mkdtemp()
    s.DB_PATH = Path(tmp) / "test.sqlite3"
    s.ask_coach = fake_ask
    s.validate = lambda step: None
    server = ThreadingHTTPServer(("127.0.0.1", 0), s.Handler)
    server.RequestHandlerClass.log_message = lambda *args: None
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{server.server_address[1]}"


def tearDownModule():
    server.shutdown()
    server.server_close()
    shutil.rmtree(tmp, ignore_errors=True)


def quietly(func, *args, stdin=None):
    """Run an admin command; return what it printed."""
    out = io.StringIO()
    with contextlib.redirect_stdout(out):
        if stdin is None:
            func(*args)
        else:
            s.input = lambda _prompt: stdin  # shadows the builtin inside coach_server
            try:
                func(*args)
            finally:
                del s.input
    return out.getvalue()


def add_class(code, teacher=False):
    quietly(s.add_class, SimpleNamespace(code=code, name=f"Class {code}", limit=600, tokens=2_000_000))
    if teacher:
        url = quietly(s.teacher_link, SimpleNamespace(code=code, rotate=False)).strip()
        return url.rsplit("key=", 1)[1]


def call(method, path, body=None, code="", key=None, origin=GAME, raw=None):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    req = urllib.request.Request(base + path, data=data, method=method)
    if origin:
        req.add_header("Origin", origin)
    req.add_header("X-Class-Code", code)
    if key is not None:
        req.add_header("X-Teacher-Key", key)
    if data is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read() or b"{}"), r.headers
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}"), e.headers


def progress_body(game_id, pair="jane__ann", **extra):
    return {"game_id": game_id, "pair": pair, "problem": "FizzBuzz", "steps": 3, "cycles": 1, "phase": "green",
            "overrides": 0, "back_to_red": 0, "finished": False, **extra}


def event(kind="hold", t=None, detail="Too much code", phase="green"):
    return {"t": t or int(time.time()) - 30, "kind": kind, "phase": phase, "cycle": 1, "detail": detail}


def rows(sql, *params):
    con = s.db()
    try:
        return [tuple(r) for r in con.execute(sql, params)]
    finally:
        con.close()


class ProgressTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        add_class("PROG")

    def test_old_client_body_is_accepted(self):
        status, body, _ = call("POST", "/progress", progress_body("p-old"), code="PROG")
        self.assertEqual((status, body), (200, {"status": "ok"}))

    def test_new_fields_and_ip_are_stored(self):
        full = progress_body("p-full", held=True, held_since=int(time.time()) - 60, last_note="Test first",
                             overrides_in_row=1, predictions_right=2, predictions_total=3, rescues=2,
                             passed_first=1, events=[event()])
        self.assertEqual(call("POST", "/progress", full, code="PROG")[0], 200)
        self.assertEqual(rows("SELECT held, last_note, rescues, passed_first, ip FROM progress WHERE game_id = 'p-full'"),
                         [(1, "Test first", 2, 1, "127.0.0.1")])

    def test_resent_events_are_stored_once(self):
        body = progress_body("p-events", events=[event("rescue"), event("orient", detail="Bowling"),
                                                 event("recheck", detail="red", phase="red"),
                                                 event("refactor_move", detail="Extract Function | better",
                                                       phase="refactor")])
        for _ in range(2):
            self.assertEqual(call("POST", "/progress", body, code="PROG")[0], 200)
        self.assertEqual(rows("SELECT COUNT(*) FROM events WHERE game_id = 'p-events'"), [(4,)])

    def test_bad_bodies_are_refused(self):
        good = progress_body("p-bad", events=[event()])
        cases = {
            "held not bool": {"held": 1},
            "held_since text": {"held_since": "x"},
            "last_note too long": {"last_note": "x" * 301},
            "count is a bool": {"hints_l2": True},
            "count negative": {"smells_shown": -1},
            "11 events": {"events": [event()] * 11},
            "unknown kind": {"events": [event("nope")]},
            "unknown phase": {"events": [event(phase="blue")]},
            "time in the future": {"events": [event(t=int(time.time()) + 10 ** 6)]},
            "detail too long": {"events": [event(detail="x" * 501)]},
            "event not an object": {"events": ["x"]},
            "no game_id": {"game_id": ""},
            "unknown mode": {"mode": "kata"},
            "refactorings not a map": {"refactorings": ["Extract Function"]},
            "refactoring count a bool": {"refactorings": {"Extract Function": True}},
            "refactoring name too long": {"refactorings": {"x" * 61: 1}},
            "too many refactorings": {"refactorings": {f"R{i}": 1 for i in range(21)}},
            "rounds negative": {"rounds": -1},
        }
        for name, change in cases.items():
            with self.subTest(name):
                self.assertEqual(call("POST", "/progress", {**good, **change}, code="PROG")[0], 400)

    def test_unknown_class_and_origin_are_refused(self):
        self.assertEqual(call("POST", "/progress", progress_body("p-x"), code="NOPE")[0], 403)
        self.assertEqual(call("POST", "/progress", progress_body("p-x"), code="PROG", origin="https://evil.example")[0], 403)

    def test_one_class_cannot_write_into_anothers_game(self):
        add_class("PROG2")
        call("POST", "/progress", progress_body("p-owned", steps=5), code="PROG")
        call("POST", "/progress", progress_body("p-owned", steps=99, events=[event()]), code="PROG2")
        self.assertEqual(rows("SELECT code, steps FROM progress WHERE game_id = 'p-owned'"), [("PROG", 5)])
        self.assertEqual(rows("SELECT COUNT(*) FROM events WHERE game_id = 'p-owned'"), [(0,)])

    def test_too_large_body_is_refused(self):
        self.assertEqual(call("POST", "/progress", raw=b"x" * (s.MAX_PROGRESS_BYTES + 1), code="PROG")[0], 413)


class TeacherTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.key = add_class("TEACH", teacher=True)
        now = int(time.time())
        call("POST", "/progress", progress_body("t1", "jane__ann", held=True, held_since=now - 700, rescues=2,
                                                passed_first=1, events=[event("intent", now - 60), event("hold", now - 30)]),
             code="TEACH")
        call("POST", "/progress", progress_body("t2", "ann__jane", rescues=2, passed_first=1), code="TEACH")
        call("POST", "/progress", progress_body("t3", "bob__al"), code="TEACH")

    def get(self, path, **kw):
        return call("GET", path, **{"code": "TEACH", "key": self.key, **kw})

    def put(self, path, body, **kw):
        return call("PUT", path, body, **{"code": "TEACH", "key": self.key, **kw})

    def test_access_needs_the_key_and_an_allowed_origin(self):
        self.assertEqual(self.get("/teacher/progress", key="wrong")[0], 403)
        self.assertEqual(self.get("/teacher/progress", key=None)[0], 403)
        self.assertEqual(self.get("/teacher/progress", code="NOPE")[0], 404)
        self.assertEqual(self.get("/teacher/progress", origin="https://evil.example")[0], 403)
        self.assertEqual(self.get("/teacher/progress", origin=HELPER)[0], 403)

    def test_progress_lists_recent_games(self):
        status, body, headers = self.get("/teacher/progress")
        self.assertEqual(status, 200)
        self.assertEqual(headers["Access-Control-Allow-Origin"], GAME)
        self.assertEqual(body["class"], "TEACH")
        games = {g["game_id"]: g for g in body["games"]}
        self.assertEqual(set(games), {"t1", "t2", "t3"})
        t1 = games["t1"]
        self.assertIs(t1["held"], True)
        self.assertEqual(t1["pair_key"], "ann__jane")
        self.assertEqual((t1["rescues"], t1["passed_first"], t1["ip"]), (2, 1, "127.0.0.1"))
        self.assertLess(abs(body["now"] - t1["updated"]), 60)

    def test_pair_adds_up_its_games_and_timeline(self):
        status, body, _ = self.get("/teacher/pair?key=ann__jane")
        self.assertEqual(status, 200)
        self.assertEqual(len(body["games"]), 2)
        self.assertEqual([e["kind"] for e in body["events"]], ["intent", "hold"])
        self.assertEqual((body["summary"]["steps"], body["summary"]["rescues"], body["summary"]["passed_first"]),
                         (6, 4, 2))
        self.assertEqual(self.get("/teacher/pair?key=nobody")[0], 404)

    def test_rubric(self):
        key = add_class("RUBRIC", teacher=True)
        status, body, _ = call("GET", "/teacher/rubric", code="RUBRIC", key=key)
        self.assertEqual([c["id"] for c in body["criteria"]], ["tdd", "tests", "refactoring", "collaboration", "commits"])
        status, body, _ = call("PUT", "/teacher/rubric", {"criteria": [{"id": "tdd", "name": "TDD"}]},
                               code="RUBRIC", key=key)
        self.assertEqual((status, body), (200, {"criteria": [{"id": "tdd", "name": "TDD", "description": ""}]}))
        for name, bad in {"duplicate id": [{"id": "a", "name": "A"}, {"id": "a", "name": "B"}],
                          "bad id": [{"id": "A B", "name": "A"}], "empty": [], "no name": [{"id": "a"}]}.items():
            with self.subTest(name):
                self.assertEqual(call("PUT", "/teacher/rubric", {"criteria": bad}, code="RUBRIC", key=key)[0], 400)

    def test_grades(self):
        status, body, _ = self.put("/teacher/grades", {"pair_key": "ann__jane",
                                                       "grades": [{"criterion": "tdd", "score": 3, "comment": "good"}]})
        self.assertEqual((status, body["grades"][0]["score"]), (200, 3))
        self.put("/teacher/grades", {"pair_key": "ann__jane", "grades": [{"criterion": "tests", "score": None,
                                                                          "comment": "names"}]})
        self.put("/teacher/grades", {"pair_key": "al__bob", "grades": [{"criterion": "tdd", "score": 4}]})
        self.assertEqual(len(self.get("/teacher/grades?pair_key=ann__jane")[1]["grades"]), 2)
        self.assertEqual(len(self.get("/teacher/grades")[1]["grades"]), 3)
        status, body, _ = self.put("/teacher/grades", {"pair_key": "ann__jane",
                                                       "grades": [{"criterion": "tests", "score": None, "comment": ""}]})
        self.assertEqual(len(body["grades"]), 1, "null score and empty comment delete the grade")
        for name, bad in {"score 5": {"pair_key": "x", "grades": [{"criterion": "tdd", "score": 5}]},
                          "score bool": {"pair_key": "x", "grades": [{"criterion": "tdd", "score": True}]},
                          "unknown criterion": {"pair_key": "x", "grades": [{"criterion": "zzz", "score": 1}]},
                          "no pair": {"grades": [{"criterion": "tdd", "score": 1}]}}.items():
            with self.subTest(name):
                self.assertEqual(self.put("/teacher/grades", bad)[0], 400)
        self.assertEqual(call("PUT", "/teacher/grades", raw=b"x" * (s.MAX_TEACHER_BYTES + 1), code="TEACH",
                              key=self.key)[0], 413)

    def test_preflight_allows_put_and_the_teacher_key(self):
        req = urllib.request.Request(base + "/teacher/grades", method="OPTIONS", headers={"Origin": GAME})
        with urllib.request.urlopen(req) as r:
            self.assertIn("PUT", r.headers["Access-Control-Allow-Methods"])
            self.assertIn("X-Teacher-Key", r.headers["Access-Control-Allow-Headers"])

    def test_rotating_the_key_stops_the_old_link(self):
        old = add_class("ROTATE", teacher=True)
        new = quietly(s.teacher_link, SimpleNamespace(code="ROTATE", rotate=True)).strip().rsplit("key=", 1)[1]
        self.assertNotEqual(old, new)
        self.assertEqual(call("GET", "/teacher/progress", code="ROTATE", key=old)[0], 403)
        self.assertEqual(call("GET", "/teacher/progress", code="ROTATE", key=new)[0], 200)


class RefactorLabTests(unittest.TestCase):
    """The refactor lab's progress (DESIGN-refactor-lab.md): mode, rounds, commits, reverts, refactorings."""

    @classmethod
    def setUpClass(cls):
        cls.key = add_class("LAB", teacher=True)
        lab = {"mode": "refactor", "rounds": 3, "commits": 3, "reverts": 1,
               "refactorings": {"Extract Function": 2, "Rename Variable": 1}}
        call("POST", "/progress", progress_body("lab1", "ann__bo", phase="refactor", **lab), code="LAB")
        call("POST", "/progress", progress_body("lab2", "bo__ann", phase="refactor", mode="refactor", rounds=1,
                                                commits=1, refactorings={"Extract Function": 1}), code="LAB")
        call("POST", "/progress", progress_body("tdd1", "cy__di"), code="LAB")

    def test_teacher_progress_shows_the_lab_fields(self):
        games = {g["game_id"]: g for g in call("GET", "/teacher/progress", code="LAB", key=self.key)[1]["games"]}
        self.assertEqual((games["lab1"]["mode"], games["lab1"]["rounds"], games["lab1"]["reverts"]), ("refactor", 3, 1))
        self.assertEqual(games["lab1"]["refactorings"], {"Extract Function": 2, "Rename Variable": 1})
        self.assertEqual((games["tdd1"]["mode"], games["tdd1"]["refactorings"]), ("tdd", {}), "defaults for TDD games")

    def test_the_pair_summary_adds_refactorings_up_by_name(self):
        summary = call("GET", "/teacher/pair?key=ann__bo", code="LAB", key=self.key)[1]["summary"]
        self.assertEqual((summary["rounds"], summary["commits"], summary["reverts"]), (4, 4, 1))
        self.assertEqual(summary["refactorings"], {"Extract Function": 3, "Rename Variable": 1})

    def test_totals_are_replaced_not_added(self):
        call("POST", "/progress", progress_body("lab3", "ed__fi", mode="refactor", refactorings={"Extract Function": 1}),
             code="LAB")
        call("POST", "/progress", progress_body("lab3", "ed__fi", mode="refactor", refactorings={"Extract Function": 2}),
             code="LAB")
        self.assertEqual(rows("SELECT refactorings FROM progress WHERE game_id = 'lab3'"), [('{"Extract Function": 2}',)])

    def test_progress_report_has_rounds_reverts_and_refactorings(self):
        csv = quietly(s.show_progress, SimpleNamespace(code="LAB", days=None, csv=True)).splitlines()
        header = csv[0].split(",")
        row = next(line for line in csv[1:] if "ann__bo" in line or "bo__ann" in line).split(",")
        self.assertEqual((row[header.index("rounds")], row[header.index("reverts")]), ("4", "1"))
        self.assertEqual(row[header.index("refactorings")], "Extract Function:3; Rename Variable:1")
        table = quietly(s.show_progress, SimpleNamespace(code="LAB", days=None, csv=False))
        self.assertIn("rounds", table.splitlines()[0])

    def test_the_labs_test_and_commit_phases_are_accepted(self):
        for phase in ("test", "commit"):
            with self.subTest(phase):
                body = progress_body(f"lab-{phase}", mode="refactor", phase=phase,
                                     events=[event("commit", detail="1a2b3c4d Extract Function: total", phase=phase)])
                self.assertEqual(call("POST", "/progress", body, code="LAB")[0], 200)

    def test_refactor_move_events_are_stored(self):
        body = progress_body("lab4", mode="refactor",
                             events=[event("refactor_move", detail="Extract Function | better", phase="refactor")])
        self.assertEqual(call("POST", "/progress", body, code="LAB")[0], 200)
        self.assertEqual(rows("SELECT kind, detail FROM events WHERE game_id = 'lab4'"),
                         [("refactor_move", "Extract Function | better")])


class ReflectionTests(unittest.TestCase):
    def test_reflection_events_are_stored(self):
        detail = "Which change made the code easiest to read, and why? | Extract Function, the name says it"
        body = progress_body("refl1", finished=True,
                             events=[event("reflection", detail=detail, phase="finished")])
        self.assertEqual(call("POST", "/progress", body, code="LAB")[0], 200)
        self.assertEqual(rows("SELECT kind, detail FROM events WHERE game_id = 'refl1'"),
                         [("reflection", detail)])


class ClassCheckTests(unittest.TestCase):
    def test_active_class(self):
        add_class("CHECK")
        for origin in (GAME, HELPER, "http://localhost:8000"):
            with self.subTest(origin):
                status, body, headers = call("GET", "/class?code=%20check%20", origin=origin)
                self.assertEqual((status, body), (200, {"ok": True, "name": "Class CHECK"}))
                self.assertEqual(headers["Access-Control-Allow-Origin"], origin)

    def test_unknown_disabled_or_missing(self):
        add_class("OFF")
        quietly(s.disable_class, SimpleNamespace(code="OFF"))
        for path in ("/class?code=NOPE", "/class?code=OFF", "/class"):
            with self.subTest(path):
                self.assertEqual(call("GET", path)[:2], (404, {"ok": False}))

    def test_other_origins_are_refused(self):
        self.assertEqual(call("GET", "/class?code=CHECK", origin="https://evil.example")[0], 403)


class CoachCountingTests(unittest.TestCase):
    """Only a Done counts toward a pair's coach asks; every call is logged with its mode."""

    @classmethod
    def setUpClass(cls):
        add_class("COUNT")
        fake["answer"] = {"decision": "advance", "advice": False}

    def post(self, game_id, **step):
        return call("POST", "/coach", {"phase": "red", "game_id": game_id, "pair": "a__b", **step}, code="COUNT",
                    origin=HELPER)

    def asks(self, game_id):
        return rows("SELECT coach_asks FROM progress WHERE game_id = ?", game_id) or [(0,)]

    def test_orient_look_and_next_steps_are_not_counted(self):
        for mode in ("orient", "look", "next_steps"):
            self.assertEqual(self.post("c-guide", mode=mode)[0], 200)
        self.assertEqual(self.asks("c-guide"), [(0,)])

    def test_verdicts_and_done_looks_are_counted(self):
        self.post("c-done")
        self.post("c-done", mode="verdict")
        self.post("c-done", mode="look", done=True)
        self.assertEqual(self.asks("c-done"), [(3,)])

    def test_usage_records_the_mode_and_rescues(self):
        before = rows("SELECT COUNT(*) FROM usage WHERE code = 'COUNT'")[0][0]
        self.post("c-usage", mode="orient")
        self.post("c-usage", mode="look", rescue=True)
        self.post("c-usage")
        self.assertEqual(rows("SELECT mode, rescue FROM usage WHERE code = 'COUNT' ORDER BY id")[before:],
                         [("orient", 0), ("look", 1), ("verdict", 0)])
        printed = quietly(s.show_usage, SimpleNamespace(days=1))
        self.assertIn("orient", printed.splitlines()[0])

    def test_worst_case_look_fits_the_body_limit(self):
        line = 'EXPECT_EQ("Fizz", fizz(3)); // 3 → "Fizz"\\n\n'
        cpp = (line * (10_000 // len(line) + 1))[:10_000]
        look = {
            "mode": "look", "phase": "green", "problem": ("é" + "x" * 99) * 80, "building": "b" * 300,
            "expected": "e" * 300, "intent": "i" * 200, "tests": cpp, "code": cpp, "tests_before": cpp,
            "code_before": cpp, "test_result": cpp, "rule_findings": ['f"' * 250] * 20,
            "history": [{"phase": "red", "decision": "redo", "note": "n" * 500}] * 5,
            "catalogue": [{"id": "x" * 64, "text": "t" * 300}] * 60, "pair": "p" * 200, "game_id": "g" * 64,
        }
        size = len(json.dumps(look, ensure_ascii=False).encode("utf-8"))
        self.assertLess(size, s.MAX_BODY_BYTES)


class ReuseTests(unittest.TestCase):
    """A Done with unchanged code reuses the last Look the server answered for that game."""

    @classmethod
    def setUpClass(cls):
        add_class("REUSE")
        add_class("REUSE2")

    def look(self, game_id, phase="green", code="REUSE", **extra):
        return call("POST", "/coach", {"mode": "look", "phase": phase, "game_id": game_id, "pair": "a__b", **extra},
                    code=code, origin=HELPER)

    def reuse(self, game_id, phase="green", code="REUSE", **extra):
        return call("POST", "/coach", {"mode": "look", "done": True, "reuse": True, "game_id": game_id,
                                       "pair": "a__b", "phase": phase, **extra}, code=code, origin=HELPER)

    def counts(self, game_id):
        return (rows("SELECT coach_asks, coach_redo, coach_advance FROM progress WHERE game_id = ?", game_id)
                or [(0, 0, 0)])[0]

    def test_reuse_counts_the_stored_verdict_once_without_a_model_call(self):
        fake["answer"] = {"decision": "redo", "advice": False}
        self.look("r1")
        self.assertEqual(self.counts("r1"), (0, 0, 0), "a plain Look isn't counted")
        calls_before = len(fake["calls"])
        usage_before = rows("SELECT COUNT(*) FROM usage WHERE code = 'REUSE'")
        status, body, _ = self.reuse("r1", decision="advance")  # a sent decision is ignored
        self.assertEqual((status, body), (200, {"status": "recorded", "decision": "redo"}))
        self.assertEqual(self.counts("r1"), (1, 1, 0))
        self.assertEqual(len(fake["calls"]), calls_before, "no model call")
        self.assertEqual(rows("SELECT COUNT(*) FROM usage WHERE code = 'REUSE'"), usage_before, "no usage")
        self.assertEqual(self.reuse("r1")[0], 409, "each Look is reused at most once")

    def test_no_reuse_without_a_matching_recent_look(self):
        fake["answer"] = {"decision": "advance", "advice": True}
        self.assertEqual(self.reuse("r2")[0], 409, "no Look yet")
        self.look("r2")
        self.assertEqual(self.reuse("r2", phase="refactor")[0], 409, "another phase")
        self.assertEqual(self.reuse("r2", code="REUSE2")[0], 409, "another class")
        con = s.db()
        with con:
            con.execute("UPDATE looks SET t = t - ? WHERE game_id = 'r2'", (s.LOOK_REUSE_SECONDS + 1,))
        con.close()
        self.assertEqual(self.reuse("r2")[0], 409, "too old")

    def test_a_done_look_is_counted_and_not_reusable(self):
        fake["answer"] = {"decision": "advance", "advice": False}
        self.look("r3", done=True)
        self.assertEqual(self.counts("r3"), (1, 0, 1))
        self.assertEqual(self.reuse("r3")[0], 409)

    def test_a_look_without_a_decision_is_not_stored(self):
        fake["answer"] = {"steps": [], "extra": ""}
        self.look("r4")
        self.assertEqual(self.reuse("r4")[0], 409)

    def test_bad_reuse_requests(self):
        cases = {"not done": {"done": False}, "not a look": {"mode": "verdict"}, "no game": {"game_id": ""},
                 "bad phase": {"phase": "swap"}}
        for name, change in cases.items():
            with self.subTest(name):
                body = {"mode": "look", "done": True, "reuse": True, "game_id": "r5", "pair": "a__b", "phase": "green",
                        **change}
                self.assertEqual(call("POST", "/coach", body, code="REUSE", origin=HELPER)[0], 400)
        self.assertEqual(self.reuse("r5", code="NOPE")[0], 403)


class AdminTests(unittest.TestCase):
    def test_clear_progress_keeps_grades_and_clear_grades_asks(self):
        key = add_class("CLEAR", teacher=True)
        call("POST", "/progress", progress_body("x1", events=[event()]), code="CLEAR")
        call("PUT", "/teacher/grades", {"pair_key": "ann__jane", "grades": [{"criterion": "tdd", "score": 2}]},
             code="CLEAR", key=key)
        quietly(s.clear_progress, SimpleNamespace(code="clear", yes=True))
        self.assertEqual(rows("SELECT COUNT(*) FROM progress WHERE code = 'CLEAR'"), [(0,)])
        self.assertEqual(rows("SELECT COUNT(*) FROM events WHERE code = 'CLEAR'"), [(0,)])
        self.assertEqual(rows("SELECT COUNT(*) FROM grades WHERE code = 'CLEAR'"), [(1,)])
        self.assertIn("cancelled", quietly(s.clear_grades, SimpleNamespace(code="CLEAR", yes=False), stdin="WRONG"))
        self.assertEqual(rows("SELECT COUNT(*) FROM grades WHERE code = 'CLEAR'"), [(1,)])
        quietly(s.clear_grades, SimpleNamespace(code="CLEAR", yes=False), stdin="clear")
        self.assertEqual(rows("SELECT COUNT(*) FROM grades WHERE code = 'CLEAR'"), [(0,)])

    def test_progress_and_grades_reports(self):
        key = add_class("REPORT", teacher=True)
        call("POST", "/progress", progress_body("y1", rescues=3, passed_first=2), code="REPORT")
        call("PUT", "/teacher/grades", {"pair_key": "ann__jane", "grades": [{"criterion": "tdd", "score": 4,
                                                                               "comment": "tidy"}]},
             code="REPORT", key=key)
        csv = quietly(s.show_progress, SimpleNamespace(code="REPORT", days=None, csv=True)).splitlines()
        header, row = csv[0].split(","), csv[1].split(",")
        self.assertEqual((row[header.index("rescues")], row[header.index("passed_first")]), ("3", "2"))
        grades = quietly(s.show_grades, SimpleNamespace(code="REPORT", csv=True))
        self.assertIn("tidy", grades)


if __name__ == "__main__":
    unittest.main()
