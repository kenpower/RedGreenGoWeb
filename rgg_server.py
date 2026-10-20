"""RedGreenGo helper: watches what Visual Studio produces (GoogleTest results, build
log, source files) and the project's git status, and pushes it to the RedGreenGo web app.

It only reads: it never builds, never runs tests and never writes to the project. The
one program it runs is git, read-only (status, log, branch; --no-optional-locks, so not
even git's index refresh is written), so it is safe to leave running.

No setup needed: Visual Studio's Google Test adapter writes XMLGoogleTestResults.xml
next to the test .exe on every run, and the build writes <Project>.log; the helper
finds both under the solution folder.

Run from the folder that holds your solution:
  python rgg_server.py                  opens the game at http://127.0.0.1:8000/ (after the first test run, if there are tests)
  python rgg_server.py --class-code CODE   the same, with your class code filled in (--class also works);
                                        without it, a "Class code: CODE" line in README.md is used
  python rgg_server.py --dev            opens the dev build on http://localhost:8080
  python rgg_server.py --remote         opens the game on GitHub Pages instead (Chrome may block it from the helper)
  python rgg_server.py --help           all options

The game is served from the helper itself, so the page and the helper share an origin:
Chrome's Local Network Access blocks a public site (github.io) from reaching 127.0.0.1,
even with the permission allowed. The page is a few lines of HTML; the game's code and
styles still load from GitHub Pages, so the helper never needs updating for a new release.

Endpoints (127.0.0.1:8000):
  GET  /          the game page
  GET  /rgg_server.py   this file, for the game's download link
  GET  /events    Server-Sent Events stream; one message per change
  GET  /results   the same data once, re-read from disk
  POST /reset     new game: forget the previous game's results, then re-read what is on disk
"""

import argparse
import glob
import json
import os
import re
import subprocess
import threading
import time
import webbrowser
import xml.etree.ElementTree as ET
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlencode

PORT = 8000
PUBLISHED_URL = "https://kenpower.github.io/RedGreenGoWeb/"
GAME_URL = f"http://127.0.0.1:{PORT}/?helper=1"  # ?helper=1 turns on the app's connection
DEV_GAME_URL = "http://localhost:8080/?helper=1"
REMOTE_GAME_URL = PUBLISHED_URL + "?helper=1"
ALLOWED_ORIGINS = {"http://localhost:8080", "https://kenpower.github.io",
                   f"http://127.0.0.1:{PORT}", f"http://localhost:{PORT}"}
ALLOWED_HOSTS = {"127.0.0.1", "localhost"}

# public/index.html, with a <base> so its relative paths (the bundle, styles, icons,
# build/rgg_server.py) load from GitHub Pages.
GAME_PAGE = f"""<!DOCTYPE html>
<html lang="en">
<head>
\t<base href="{PUBLISHED_URL}">
\t<meta charset='utf-8'>
\t<meta name='viewport' content='width=device-width,initial-scale=1'>
\t<meta name="color-scheme" content="dark">

\t<title>Red Green Go!</title>

\t<link rel='icon' type='image/png' href='favicon.png'>
\t<link rel="preconnect" href="https://fonts.googleapis.com">
\t<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
\t<link rel='stylesheet' href='https://fonts.googleapis.com/css2?family=Source+Code+Pro:wght@300;400;500;700&display=swap'>
\t<link rel='stylesheet' href='global.css'>
\t<link rel='stylesheet' href='build/bundle.css'>

\t<script defer src='build/bundle.js'></script>
</head>

<body>
</body>
</html>
"""

POLL_SECONDS = 0.5
SETTLE_SECONDS = 0.3  # ignore files modified more recently than this (still being written)
RESCAN_SECONDS = 5  # how often to look for new result/log files (e.g. a new build configuration)
BROWSER_GRACE_SECONDS = 4  # an already-open game tab reconnects within this time
RESULTS_WAIT_SECONDS = 60  # longest the game waits for the first test run before opening anyway
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
MAX_README_CHARS = 8_000  # the problem description sent to the coach
CLASS_CODE_LINE = re.compile(r"^\s*class code\s*:\s*([A-Za-z0-9-]{2,40})\s*$", re.IGNORECASE | re.MULTILINE)
GIT_TIMEOUT_SECONDS = 3
MAX_DIRTY = 200  # untracked build output can be thousands of files when there's no .gitignore

changed = threading.Condition()  # guards state and sse_clients; notified on every change
sse_clients = 0
have_results = threading.Event()  # set once any GoogleTest XML has been read; the game opens then
config = {"project": ".", "results": [], "build_logs": []}  # set by main() from the command line
state = {
    "version": 0,  # bumps on every change
    "run": 0,  # id of the latest test run
    "runTime": None,
    "tests": {},  # "Suite.Name" -> {name, status, message, run}
    "build": None,  # {status, errors, time} from the latest build log
    "files": [],  # [{path, kind: test|production, content, mtime}] read when results/build arrive
    "readme": None,  # {path, content} of the solution's README.md, read alongside the files
    "git": None,  # see read_git()
    "project": None,  # {path, name, vsName}: the folder being watched, so the app can show a wrong one
}
VS_PROJECT_EXTENSIONS = (".slnx", ".sln", ".vcxproj")  # solutions first; find_vs_project relies on it


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
                "mtime": os.path.getmtime(path),  # same clock as runTime/build.time: spots stale results
            })
            if len(files) >= MAX_FILES:
                return files
    return files


def read_readme(project_dir):
    """README.md (any case) in the solution folder, else in one of its subfolders; it
    tells the coach what the pair is building. Cut to MAX_README_CHARS."""
    def find_in(folder):
        try:
            names = sorted(os.listdir(folder))
        except OSError:
            return None
        return next((os.path.join(folder, n) for n in names
                     if n.lower() == "readme.md" and os.path.isfile(os.path.join(folder, n))), None)

    path = find_in(project_dir)
    if path is None:
        for name in sorted(os.listdir(project_dir)):
            sub = os.path.join(project_dir, name)
            if os.path.isdir(sub) and name not in SKIP_DIRS and not name.startswith("."):
                path = find_in(sub)
                if path:
                    break
    if path is None:
        return None
    return {
        "path": os.path.relpath(path, project_dir).replace("\\", "/"),
        "content": read_text(path)[:MAX_README_CHARS],
    }


def find_vs_project(project_dir):
    """The solution (.slnx/.sln) nearest the top of the folder, looking up to 2 levels
    below it, else the nearest C++ project (.vcxproj); None if there is neither."""
    for extensions in (VS_PROJECT_EXTENSIONS[:2], VS_PROJECT_EXTENSIONS[2:]):
        for depth in range(3):
            pattern = os.path.join(project_dir, *["*"] * depth, "*")
            found = sorted(p for p in glob.glob(pattern) if p.lower().endswith(extensions) and os.path.isfile(p))
            if found:
                return found[0]
    return None


class GitError(Exception):
    pass


def run_git(project_dir, *args):
    """Run a read-only git command in the project; return its stdout or raise GitError."""
    try:
        result = subprocess.run(
            ["git", "--no-optional-locks", *args], cwd=project_dir, capture_output=True,
            timeout=GIT_TIMEOUT_SECONDS, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
    except FileNotFoundError:
        raise GitError("git is not installed")
    except subprocess.TimeoutExpired:
        raise GitError("git took too long")
    except OSError as e:
        raise GitError(str(e))
    if result.returncode != 0:
        raise GitError(result.stderr.decode("utf-8", errors="replace").strip() or f"git {args[0]} failed")
    return result.stdout.decode("utf-8", errors="replace")


def is_source_path(path):
    """Same rule as read_sources: a .cpp/.h outside build output, packages and dot folders."""
    *dirs, name = path.split("/")
    return (os.path.splitext(name)[1].lower() in SOURCE_EXTENSIONS and not SKIP_FILES.match(name)
            and not any(d in SKIP_DIRS or d.startswith(".") for d in dirs))


def read_git(project_dir):
    """{repo: true, branch, head, headTime, headMessage, dirty, dirtySource} or {repo: false, error}.

    Paths are relative to the project folder (like files[].path) and only cover files inside it.
    branch is None when HEAD is detached; head/headTime/headMessage are None before the first commit.
    """
    try:
        # the project folder's path inside the repo, e.g. "Bowling/" ("" at the top); status
        # paths start with it. Safer than relpath against --show-toplevel, which can differ
        # in drive-letter case or 8.3 short names on Windows.
        prefix = run_git(project_dir, "rev-parse", "--show-prefix").strip()
    except GitError as e:
        not_repo = "not a git repository" in str(e)
        return {"repo": False, "error": None if not_repo else str(e)}
    try:
        # -uall lists files inside new folders; "." keeps it to the project folder
        status = run_git(project_dir, "status", "--porcelain=v1", "-z", "-uall", "--", ".")
        try:
            branch = run_git(project_dir, "symbolic-ref", "--short", "-q", "HEAD").strip() or None
        except GitError:
            branch = None  # detached HEAD
        try:
            head, head_time, head_message = run_git(
                project_dir, "log", "-1", "--format=%H%x00%ct%x00%s").rstrip("\n").split("\0")
            head_time = int(head_time)
        except GitError:
            head = head_time = head_message = None  # no commits yet
    except (GitError, ValueError) as e:
        return {"repo": False, "error": str(e)}

    dirty = []
    entries = status.split("\0")
    i = 0
    while i < len(entries):
        entry = entries[i]
        i += 1
        if len(entry) < 4:
            continue
        if entry[0] in "RC":
            i += 1  # a rename/copy is followed by its old path
        path = entry[3:]
        dirty.append(path[len(prefix):] if path.startswith(prefix) else path)
    dirty.sort()
    return {
        "repo": True,
        "branch": branch,
        "head": head,
        "headTime": head_time,
        "headMessage": head_message,
        "dirty": dirty[:MAX_DIRTY],
        "dirtySource": [p for p in dirty if is_source_path(p)][:MAX_DIRTY],
    }


def update_git(git):
    """Publish a new git status on its own, but only if it changed."""
    with changed:
        if state["git"] == git:
            return
        state["git"] = git
        state["version"] += 1
        changed.notify_all()


def beep(runs):
    try:
        import winsound
    except ImportError:
        return
    all_passed = all(r["status"] != "failed" for _, results in runs for r in results)
    winsound.MessageBeep(winsound.MB_OK if all_passed else winsound.MB_ICONHAND)


def publish(runs, build, files, readme, git):
    """Apply new results/build/files as one change, so the app never sees a half-updated state."""
    with changed:
        state["git"] = git
        for mtime, results in runs:
            state["run"] += 1
            state["runTime"] = mtime
            for r in results:
                state["tests"][r["name"]] = {**r, "run": state["run"]}
        if build:
            state["build"] = build
        state["files"] = files
        state["readme"] = readme
        state["version"] += 1
        changed.notify_all()
    if runs:
        have_results.set()


def expand(patterns):
    return [path for pattern in patterns for path in glob.glob(pattern, recursive=True)]


def find_inputs():
    """The result files and build logs to read, from --results/--build-log or auto-detected."""
    result_files = expand(config["results"]) if config["results"] else find_result_files(config["project"])
    logs = expand(config["build_logs"]) if config["build_logs"] else find_build_logs(config["project"])
    return result_files, logs


def reload_from_disk(clear):
    """Re-read every result file and the newest build log whether or not they changed, so
    the state matches what is on disk now. Used on reset (clear=True: forget the previous
    game first) and whenever the app asks for the state; the watch loop keeps its own
    mtimes for spotting new runs."""
    result_files, logs = find_inputs()
    runs = check_result_files(result_files, {})
    build = check_build_logs(logs, {})
    with changed:  # an RLock, so publish() can take it again; the app sees one change
        if clear:
            state["tests"] = {}
            state["build"] = None
            state["runTime"] = None
        publish(runs, build, read_sources(config["project"]), read_readme(config["project"]),
                read_git(config["project"]))


def watch(beep_on_results):
    """Poll result files and build logs. Whatever is on disk at startup is reported too:
    it is the project's latest state, and the app can tell its age from the times."""
    seen_mtimes = {}
    result_files, logs, next_scan = [], [], 0
    while True:
        try:
            rescan = time.time() >= next_scan
            if rescan:
                result_files, logs = find_inputs()
                next_scan = time.time() + RESCAN_SECONDS

            runs = check_result_files(result_files, seen_mtimes)
            build = check_build_logs(logs, seen_mtimes)

            if runs or build:
                publish(runs, build, read_sources(config["project"]), read_readme(config["project"]),
                        read_git(config["project"]))
                for _, results in runs:
                    print("tests: " + ", ".join(f'{r["name"]}={r["status"]}' for r in results), flush=True)
                if build:
                    print(f'build {build["status"]}: {len(build["errors"])} error(s)', flush=True)
                if runs and beep_on_results:
                    beep(runs)
            elif rescan:
                update_git(read_git(config["project"]))  # e.g. a commit made in VS between test runs
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
            "readme": state["readme"],
            "git": state["git"],
            "project": state["project"],
        }


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
        path = self.path.split("?")[0]
        if path in ("/", "/index.html"):
            # A top-level navigation sends no Origin; the Host check still applies.
            if self.allowed():
                self.send_body(GAME_PAGE.encode("utf-8"), "text/html; charset=utf-8")
            return
        if not self.allowed():
            return
        if path == "/rgg_server.py":
            with open(__file__, "rb") as f:
                self.send_body(f.read(), "text/x-python; charset=utf-8",
                               {"Content-Disposition": 'attachment; filename="rgg_server.py"'})
        elif path == "/events":
            self.stream_events()
        elif path == "/results":
            reload_from_disk(clear=False)
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
        reload_from_disk(clear=True)
        print("reset: re-read results from disk", flush=True)
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
        self.send_body(json.dumps(data).encode("utf-8"), "application/json")

    def send_body(self, body, content_type, headers=None):
        self.send_response(200)
        self.send_cors_headers()
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        for name, value in (headers or {}).items():
            self.send_header(name, value)
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
    """If the project has tests, wait for their first results (up to RESULTS_WAIT_SECONDS)
    so the game starts from a real test run; a project with no tests yet opens straight
    away. Then open the game unless a game tab is already connected."""
    with changed:
        has_tests = any(f["kind"] == "test" for f in state["files"])
    if has_tests and not have_results.wait(timeout=1):
        print("Waiting for your first test run in Test Explorer...", flush=True)
        if not have_results.wait(timeout=RESULTS_WAIT_SECONDS):
            print(f"No test results after {RESULTS_WAIT_SECONDS} s - opening the game anyway.", flush=True)
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
    parser.add_argument("--class-code", "--class", dest="class_code", metavar="CODE",
                        help='your class code, for the coach (default: a "Class code: X" line in README.md)')
    parser.add_argument("--dev", action="store_true", help=f"open {DEV_GAME_URL} instead of {GAME_URL}")
    parser.add_argument("--remote", action="store_true",
                        help=f"open {REMOTE_GAME_URL} instead (Chrome may block it from reaching the helper)")
    parser.add_argument("--no-browser", action="store_true", help="don't open the game")
    parser.add_argument("--beep", action="store_true", help="beep when new test results arrive")
    args = parser.parse_args()

    project_dir = os.path.abspath(args.project)
    config.update(project=project_dir, results=args.results, build_logs=args.build_log)

    with changed:
        state["files"] = read_sources(project_dir)
        state["readme"] = read_readme(project_dir)
        state["git"] = read_git(project_dir)
        vs_project = find_vs_project(project_dir)
        state["project"] = {
            "path": project_dir,
            "name": os.path.basename(project_dir.rstrip("\\/")) or project_dir,
            "vsName": os.path.splitext(os.path.basename(vs_project))[0] if vs_project else None,
        }
        state["version"] = 1

    vs_name = state["project"]["vsName"]
    print(f"Project: {project_dir}{f' ({vs_name})' if vs_name else ''}, {len(state['files'])} source files")
    if not vs_project:
        print("  WARNING: No Visual Studio solution or project found here. Run the helper from your project folder.")
    if state["readme"]:
        print(f"  Problem description: {state['readme']['path']}")
    git = state["git"]
    if git["repo"]:
        print(f"  Git: {git['branch'] or 'detached HEAD'}, {len(git['dirtySource'])} uncommitted source file(s)")
    else:
        print(f"  Git: {git['error'] or 'not a git repository'}")
    if not (args.results or find_result_files(project_dir)):
        print("  No test results yet - run your tests in Visual Studio's Test Explorer.")
    class_code, source = args.class_code, "--class-code"
    if not class_code and state["readme"]:
        found = CLASS_CODE_LINE.search(state["readme"]["content"])
        class_code, source = (found.group(1), state["readme"]["path"]) if found else (None, None)
    if class_code:
        print(f"  Class code: {class_code} (from {source})")
    else:
        print("  No class code: the game will ask for one")
    print(f"Open http://127.0.0.1:{PORT}/ to play  (Ctrl+C to stop)", flush=True)

    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    threading.Thread(target=watch, args=(args.beep,), daemon=True).start()
    if not args.no_browser:
        url = DEV_GAME_URL if args.dev else REMOTE_GAME_URL if args.remote else GAME_URL
        if class_code:
            url += "&" + urlencode({"class": class_code})
        threading.Thread(target=open_game_unless_connected, args=(url,), daemon=True).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("Stopped.")


if __name__ == "__main__":
    main()
