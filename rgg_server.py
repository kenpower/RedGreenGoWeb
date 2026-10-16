"""RedGreenGo helper: watches what Visual Studio produces (GoogleTest results, build
log, source files) and pushes it to the RedGreenGo web app.

It never runs anything and only reads files, so it is safe to leave running.

No setup needed: Visual Studio's Google Test adapter writes XMLGoogleTestResults.xml
next to the test .exe on every run, and the build writes <Project>.log; the helper
finds both under the solution folder.

Run from the folder that holds your solution:
  python rgg_server.py                  opens the game in your browser
  python rgg_server.py --dev            opens the dev build on http://localhost:8080
  python rgg_server.py --help           all options

Endpoints (127.0.0.1:8000):
  GET  /events    Server-Sent Events stream; one message per change
  GET  /results   the same data once (handy for debugging)
  POST /reset     forget test results and build status (new game)
"""

import argparse
import glob
import json
import os
import re
import threading
import time
import webbrowser
import xml.etree.ElementTree as ET
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

GAME_URL = "https://kenpower.github.io/RedGreenGoWeb/?helper=1"  # ?helper=1 turns on the app's connection
DEV_GAME_URL = "http://localhost:8080/?helper=1"
ALLOWED_ORIGINS = {"http://localhost:8080", "https://kenpower.github.io"}
ALLOWED_HOSTS = {"127.0.0.1", "localhost"}
PORT = 8000

POLL_SECONDS = 0.5
SETTLE_SECONDS = 0.3  # ignore files modified more recently than this (still being written)
RESCAN_SECONDS = 5  # how often to look for new result/log files (e.g. a new build configuration)
BROWSER_GRACE_SECONDS = 4  # an already-open game tab reconnects within this time
SSE_RETRY_MS = 2000
SSE_PING_SECONDS = 15

RESULT_FILE_NAMES = ["XMLGoogleTestResults.xml", "test_detail.xml"]  # VS adapter; plain --gtest_output=xml
BUILD_ERROR = re.compile(r"^.*: (?:fatal )?error [A-Z]+\d+:.*$", re.MULTILINE)
SOURCE_EXTENSIONS = {".cpp", ".cc", ".h", ".hpp"}
SKIP_DIRS = {"packages", "x64", "x86", "Win32", "ARM64", "Debug", "Release", "out", "build"}
SKIP_FILES = re.compile(r"^(pch|stdafx|framework|targetver)\.(h|cpp)$", re.IGNORECASE)
TEST_MARKER = re.compile(r"\bTEST(?:_F|_P)?\s*\(")
MAX_FILE_BYTES = 100_000
MAX_FILES = 50

changed = threading.Condition()  # guards state and sse_clients; notified on every change
sse_clients = 0
state = {
    "version": 0,  # bumps on every change
    "run": 0,  # id of the latest test run
    "runTime": None,
    "tests": {},  # "Suite.Name" -> {name, status, message, run}
    "build": None,  # {status, errors, time} from the latest build log
    "files": [],  # [{path, kind: test|production, content}] read when results/build arrive
}


def read_text(path):
    with open(path, "rb") as f:
        raw = f.read()
    encoding = "utf-16" if raw[:2] in (b"\xff\xfe", b"\xfe\xff") else "utf-8-sig"
    return raw.decode(encoding, errors="replace")


def parse_results(path):
    """Parse a GoogleTest XML file into a list of test results."""
    root = ET.parse(path).getroot()
    results = []
    for case in root.iter("testcase"):
        name = f'{case.get("classname")}.{case.get("name")}'
        failure = case.find("failure")
        if failure is None:
            failure = case.find("error")

        if case.get("status") == "notrun" or case.find("skipped") is not None:
            status, message = "skipped", ""
        elif failure is not None:
            status = "failed"
            message = (failure.get("message") or failure.text or "").strip()[:500]
        else:
            status, message = "passed", ""
        results.append({"name": name, "status": status, "message": message})
    return results


def find_result_files(project_dir):
    """The VS Google Test adapter writes XMLGoogleTestResults.xml next to each test .exe."""
    paths = []
    for name in RESULT_FILE_NAMES:
        paths += glob.glob(os.path.join(project_dir, "**", name), recursive=True)
    return paths


def check_result_files(paths, seen_mtimes):
    """Return [(mtime, results)] for result files changed since last seen, oldest first.

    Visual Studio rewrites these files on every run, so they are only read, never deleted.
    """
    runs = []
    now = time.time()
    for path in paths:
        try:
            mtime = os.path.getmtime(path)
        except OSError:
            continue
        if seen_mtimes.get(path) == mtime or now - mtime < SETTLE_SECONDS:
            continue
        try:
            results = parse_results(path)
        except ET.ParseError:
            continue  # probably still being written; try again next poll
        seen_mtimes[path] = mtime
        runs.append((mtime, results))
    return sorted(runs, key=lambda run: run[0])


def find_build_logs(project_dir):
    """MSBuild writes <Project>.log next to the <Project>.tlog folder in each C++ project's IntDir."""
    logs = []
    for tlog in glob.glob(os.path.join(project_dir, "**", "*.tlog"), recursive=True):
        logs += glob.glob(os.path.join(os.path.dirname(tlog), "*.log"))
    return logs


def check_build_logs(paths, seen_mtimes):
    """Return the status of the most recently changed build log, or None if none changed."""
    latest = None
    for path in paths:
        try:
            mtime = os.path.getmtime(path)
        except OSError:
            continue
        if seen_mtimes.get(path) == mtime or time.time() - mtime < SETTLE_SECONDS:
            continue
        seen_mtimes[path] = mtime
        errors = [m.group(0).strip() for m in BUILD_ERROR.finditer(read_text(path))][:20]
        if latest is None or mtime > latest["time"]:
            latest = {"status": "failed" if errors else "succeeded", "errors": errors, "time": mtime}
    return latest


def read_sources(project_dir):
    """Read the students' .cpp/.h files, skipping build output, packages and precompiled headers."""
    files = []
    for dirpath, dirnames, filenames in os.walk(project_dir):
        dirnames[:] = sorted(d for d in dirnames if d not in SKIP_DIRS and not d.startswith("."))
        for name in sorted(filenames):
            if os.path.splitext(name)[1].lower() not in SOURCE_EXTENSIONS or SKIP_FILES.match(name):
                continue
            path = os.path.join(dirpath, name)
            if os.path.getsize(path) > MAX_FILE_BYTES:
                continue
            content = read_text(path)
            files.append({
                "path": os.path.relpath(path, project_dir).replace("\\", "/"),
                "kind": "test" if TEST_MARKER.search(content) else "production",
                "content": content,
            })
            if len(files) >= MAX_FILES:
                return files
    return files


def beep(runs):
    try:
        import winsound
    except ImportError:
        return
    all_passed = all(r["status"] != "failed" for _, results in runs for r in results)
    winsound.MessageBeep(winsound.MB_OK if all_passed else winsound.MB_ICONHAND)


def publish(runs, build, files):
    """Apply new results/build/files as one change, so the app never sees a half-updated state."""
    with changed:
        for mtime, results in runs:
            state["run"] += 1
            state["runTime"] = mtime
            for r in results:
                state["tests"][r["name"]] = {**r, "run": state["run"]}
        if build:
            state["build"] = build
        state["files"] = files
        state["version"] += 1
        changed.notify_all()


def expand(patterns):
    return [path for pattern in patterns for path in glob.glob(pattern, recursive=True)]


def watch(project_dir, result_patterns, build_log_patterns, beep_on_results):
    """Poll result files and build logs. Whatever is on disk at startup is reported too:
    it is the project's latest state, and the app can tell its age from the times."""
    seen_mtimes = {}
    result_files, logs, next_scan = [], [], 0
    while True:
        try:
            if time.time() >= next_scan:
                result_files = expand(result_patterns) if result_patterns else find_result_files(project_dir)
                logs = expand(build_log_patterns) if build_log_patterns else find_build_logs(project_dir)
                next_scan = time.time() + RESCAN_SECONDS

            runs = check_result_files(result_files, seen_mtimes)
            build = check_build_logs(logs, seen_mtimes)

            if runs or build:
                publish(runs, build, read_sources(project_dir))
                for _, results in runs:
                    print("tests: " + ", ".join(f'{r["name"]}={r["status"]}' for r in results), flush=True)
                if build:
                    print(f'build {build["status"]}: {len(build["errors"])} error(s)', flush=True)
                if runs and beep_on_results:
                    beep(runs)
        except OSError as e:
            print(f"watch error: {e}", flush=True)
        time.sleep(POLL_SECONDS)


def snapshot():
    with changed:
        return {
            "version": state["version"],
            "run": state["run"],
            "runTime": state["runTime"],
            "tests": sorted(state["tests"].values(), key=lambda t: t["name"]),
            "build": state["build"],
            "files": state["files"],
        }


def reset():
    with changed:
        state["tests"] = {}
        state["build"] = None
        state["runTime"] = None
        state["version"] += 1
        changed.notify_all()


class Handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        if not self.allowed():
            return
        self.send_response(204)
        self.send_cors_headers()
        self.send_header("Access-Control-Allow-Methods", "GET, POST")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.end_headers()

    def do_GET(self):
        if not self.allowed():
            return
        path = self.path.split("?")[0]
        if path == "/events":
            self.stream_events()
        elif path == "/results":
            self.send_json(snapshot())
        else:
            self.send_error(404)

    def do_POST(self):
        # State-changing, so the Origin header is required (blocks <img>/<form> tricks from other sites).
        if not self.allowed(require_origin=True):
            return
        if self.path.split("?")[0] != "/reset":
            self.send_error(404)
            return
        reset()
        print("reset", flush=True)
        self.send_response(204)
        self.send_cors_headers()
        self.end_headers()

    def stream_events(self):
        global sse_clients
        self.send_response(200)
        self.send_cors_headers()
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

        with changed:
            sse_clients += 1
        try:
            self.wfile.write(f"retry: {SSE_RETRY_MS}\n\n".encode())
            last_version = None
            while True:
                with changed:
                    changed.wait_for(lambda: state["version"] != last_version, timeout=SSE_PING_SECONDS)
                    data = snapshot()
                if data["version"] != last_version:
                    last_version = data["version"]
                    self.wfile.write(f"data: {json.dumps(data)}\n\n".encode())
                else:
                    self.wfile.write(b": ping\n\n")  # keeps the connection alive, detects closed tabs
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass
        finally:
            with changed:
                sse_clients -= 1

    def send_json(self, data):
        body = json.dumps(data).encode("utf-8")
        self.send_response(200)
        self.send_cors_headers()
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def allowed(self, require_origin=False):
        # Host check blocks DNS-rebinding; Origin check blocks other websites.
        # GETs with no Origin (opening the URL directly in a tab) are allowed for debugging.
        host = (self.headers.get("Host") or "").rsplit(":", 1)[0]
        origin = self.headers.get("Origin")
        if host not in ALLOWED_HOSTS or (origin or require_origin) and origin not in ALLOWED_ORIGINS:
            self.send_error(403)
            return False
        return True

    def send_cors_headers(self):
        origin = self.headers.get("Origin")
        if origin:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")

    def log_message(self, format, *args):
        pass  # keep the console for test/build messages


def open_game_unless_connected(url):
    time.sleep(BROWSER_GRACE_SECONDS)
    with changed:
        connected = sse_clients > 0
    if connected:
        print("Game already open in the browser - reconnected.", flush=True)
    else:
        print(f"Opening {url}", flush=True)
        webbrowser.open(url)


def main():
    parser = argparse.ArgumentParser(description="Feed Visual Studio test results to RedGreenGo")
    parser.add_argument("--project", default=".",
                        help="folder holding the solution and source files (default: current folder)")
    parser.add_argument("--results", action="append", default=[],
                        help="glob for GoogleTest XML files, if auto-detection fails (repeatable)")
    parser.add_argument("--build-log", action="append", default=[],
                        help="glob for MSBuild .log files, if auto-detection fails (repeatable)")
    parser.add_argument("--dev", action="store_true", help=f"open {DEV_GAME_URL} instead of {GAME_URL}")
    parser.add_argument("--no-browser", action="store_true", help="don't open the game")
    parser.add_argument("--beep", action="store_true", help="beep when new test results arrive")
    args = parser.parse_args()

    project_dir = os.path.abspath(args.project)

    with changed:
        state["files"] = read_sources(project_dir)
        state["version"] = 1

    print(f"Project: {project_dir} ({len(state['files'])} source files)")
    if not (args.results or find_result_files(project_dir)):
        print("  No test results yet - run your tests in Visual Studio's Test Explorer.")
    print(f"Serving http://127.0.0.1:{PORT}  (Ctrl+C to stop)", flush=True)

    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    threading.Thread(target=watch, args=(project_dir, args.results, args.build_log, args.beep), daemon=True).start()
    if not args.no_browser:
        threading.Thread(target=open_game_unless_connected,
                         args=(DEV_GAME_URL if args.dev else GAME_URL,), daemon=True).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("Stopped.")


if __name__ == "__main__":
    main()
