"""Tests for the helper (rgg_server.py): how test results from GoogleTest XML files are merged.

  python -m unittest discover -s test -p "test_rgg_server.py" -v      (from the repo root)
"""

import os
import shutil
import sys
import tempfile
import time
import unittest
import unittest.mock
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import rgg_server as h  # noqa: E402


def xml(*tests):
    """A GoogleTest results file: (name, failed) pairs, all in suite S."""
    cases = "".join(
        f'<testcase classname="S" name="{name}">' + ('<failure message="boom"/>' if failed else "") + "</testcase>"
        for name, failed in tests
    )
    return f'<?xml version="1.0"?><testsuites><testsuite name="S">{cases}</testsuite></testsuites>'


class MergeTests(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        h.config["project"] = self.dir
        h.state.update(tests={}, run=0, runTime=None, version=0)
        self.seen = {}

    def tearDown(self):
        shutil.rmtree(self.dir, ignore_errors=True)

    def run_tests(self, relpath, *tests):
        """Write a results file as VS would, then let the helper read it."""
        path = Path(self.dir, relpath)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(xml(*tests))
        past = time.time() - 5  # older than SETTLE_SECONDS, and newer on each call
        os.utime(path, (past + h.state["run"], past + h.state["run"]))
        runs = h.check_result_files([str(path)], self.seen)
        h.publish(runs, None, [], None, None)
        return runs

    def result(self, name):
        return h.state["tests"]["S." + name]

    def test_runs_carry_their_file(self):
        runs = self.run_tests("Debug/XMLGoogleTestResults.xml", ("A", False))
        self.assertEqual(Path(runs[0][2]).name, "XMLGoogleTestResults.xml")
        self.assertEqual(self.result("A")["file"], "Debug/XMLGoogleTestResults.xml")

    def test_a_partial_run_keeps_the_other_results_but_marks_them_not_latest(self):
        self.run_tests("Debug/XMLGoogleTestResults.xml", ("A", False), ("B", True))
        self.run_tests("Debug/XMLGoogleTestResults.xml", ("A", True))  # only A run in Test Explorer
        a, b = self.result("A"), self.result("B")
        self.assertEqual((a["status"], a["latest"]), ("failed", True))
        self.assertEqual((b["status"], b["latest"]), ("failed", False), "B's last result is kept")
        self.assertLess(b["run"], a["run"])

    def test_a_run_of_one_exe_leaves_another_exes_tests_alone(self):
        self.run_tests("One/XMLGoogleTestResults.xml", ("A", False))
        self.run_tests("Two/XMLGoogleTestResults.xml", ("B", False))
        self.run_tests("One/XMLGoogleTestResults.xml", ("A", False))
        self.assertTrue(self.result("A")["latest"])
        self.assertTrue(self.result("B")["latest"])

    def test_a_test_seen_again_is_latest_again(self):
        self.run_tests("Debug/XMLGoogleTestResults.xml", ("A", False), ("B", False))
        self.run_tests("Debug/XMLGoogleTestResults.xml", ("A", False))
        self.run_tests("Debug/XMLGoogleTestResults.xml", ("A", False), ("B", False))
        self.assertTrue(self.result("B")["latest"])

    def test_snapshot_lists_the_new_fields(self):
        self.run_tests("Debug/XMLGoogleTestResults.xml", ("A", False))
        test = h.snapshot()["tests"][0]
        self.assertEqual({k: test[k] for k in ("name", "status", "file", "latest")},
                         {"name": "S.A", "status": "passed", "file": "Debug/XMLGoogleTestResults.xml", "latest": True})


# What gtest_discover_tests(... XML_OUTPUT_DIR ...) writes for one failing test (CMake 3.28, GoogleTest 1.15).
CTEST_FAILURE = """<?xml version="1.0" encoding="UTF-8"?>
<testsuites tests="1" failures="1" disabled="0" errors="0" time="0." name="AllTests">
  <testsuite name="PlayTest" tests="1" failures="1" disabled="0" skipped="0" errors="0" time="0.">
    <testcase name="DropsPieceToBottomRow" file="test.cpp" line="30" status="run" result="completed" time="0." classname="PlayTest">
      <failure message="test.cpp:33&#x0A;Expected: (after.getBoard()) != (rows())" type=""><![CDATA[test.cpp:33
Expected: (after.getBoard()) != (rows())]]></failure>
    </testcase>
  </testsuite>
</testsuites>"""


class CMakeTests(unittest.TestCase):
    """A CMake project: CTest writes one GoogleTest file per test into <build>/test-results."""

    def setUp(self):
        self.dir = tempfile.mkdtemp()
        h.config["project"] = self.dir

    def tearDown(self):
        shutil.rmtree(self.dir, ignore_errors=True)

    def write(self, relpath, text, age=5.0):
        path = Path(self.dir, relpath)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)
        past = time.time() - age
        os.utime(path, (past, past))
        return str(path)

    def test_result_files_are_found_in_each_ides_build_folder(self):
        for build in ("build", "out/build/x64-Debug", "cmake-build-debug"):
            self.write(f"{build}/test-results/S.A.xml", xml(("A", False)))
        self.write("build/Testing/20261102-0951/Test.xml", "<Site/>")  # CTest's own: not GoogleTest's
        found = sorted(Path(p).relative_to(self.dir).as_posix() for p in h.find_result_files(self.dir))
        self.assertEqual(found, ["build/test-results/S.A.xml", "cmake-build-debug/test-results/S.A.xml",
                                 "out/build/x64-Debug/test-results/S.A.xml"])

    def test_a_failure_from_ctest_keeps_its_line_and_message(self):
        path = self.write("build/test-results/PlayTest.DropsPieceToBottomRow.xml", CTEST_FAILURE)
        [(_, results, _)] = h.check_result_files([path], {})
        self.assertEqual(results[0]["name"], "PlayTest.DropsPieceToBottomRow")
        self.assertEqual(results[0]["status"], "failed")
        self.assertIn("test.cpp:33", results[0]["message"])

    def test_a_run_still_being_written_is_read_only_once_the_folder_is_quiet(self):
        done = self.write("build/test-results/S.A.xml", xml(("A", False)))
        writing = self.write("build/test-results/S.B.xml", xml(("B", True)), age=0.2)
        seen = {}
        self.assertEqual(h.check_result_files([done, writing], seen), [], "half a run is never read")
        self.assertEqual(seen, {})
        os.utime(writing, (time.time() - 2, time.time() - 2))
        runs = h.check_result_files([done, writing], seen)
        self.assertEqual(sorted(r["name"] for _, results, _ in runs for r in results), ["S.A", "S.B"])

    def test_one_file_per_test_merges_into_one_set_of_results(self):
        h.state.update(tests={}, run=0, runTime=None, version=0)
        paths = [self.write(f"build/test-results/S.{n}.xml", xml((n, n == "B"))) for n in "ABC"]
        h.publish(h.check_result_files(paths, {}), None, [], None, None)
        self.assertEqual({n: t["status"] for n, t in h.state["tests"].items()},
                         {"S.A": "passed", "S.B": "failed", "S.C": "passed"})
        self.assertTrue(all(t["latest"] for t in h.state["tests"].values()))

    def test_clions_build_folder_is_not_the_students_source(self):
        self.write("src/game.cpp", "int f() { return 1; }")
        self.write("cmake-build-debug/_deps/googletest-src/googletest/test/gtest_unittest.cc", "TEST(A, B) {}")
        self.assertEqual([f["path"] for f in h.read_sources(self.dir)], ["src/game.cpp"])
        self.assertFalse(h.is_source_path("cmake-build-debug/_deps/x.cc"))

    def test_any_cmake_build_folder_is_skipped_whatever_its_name(self):
        self.write("Connect4-Tests/test.cpp", "TEST(A, B) {}")
        self.write("build-autograde/CMakeCache.txt", "")
        self.write("build-autograde/_deps/googletest-src/googletest/test/gtest_unittest.cc", "TEST(A, B) {}")
        self.write("build-autograde/CMakeFiles/3.28.3/CompilerIdCXX/CMakeCXXCompilerId.cpp", "int main() {}")
        self.write("third_party/_deps/x.cc", "int x;")
        self.assertEqual([f["path"] for f in h.read_sources(self.dir)], ["Connect4-Tests/test.cpp"])

    def test_a_cmake_project_is_named_and_checked_for_saved_results(self):
        self.assertIsNone(h.find_cmake_project(self.dir))
        self.write("CMakeLists.txt", "cmake_minimum_required(VERSION 3.20)\nproject(ConnectFour LANGUAGES CXX)\n"
                                     "gtest_discover_tests(connect4_tests)\n")
        self.assertEqual({k: v for k, v in h.find_cmake_project(self.dir).items() if k != "path"},
                         {"name": "ConnectFour", "xmlOutput": False})
        self.write("CMakeLists.txt", "project(ConnectFour)\n"
                                     "gtest_discover_tests(connect4_tests XML_OUTPUT_DIR ${CMAKE_BINARY_DIR}/test-results)\n")
        self.assertTrue(h.find_cmake_project(self.dir)["xmlOutput"])

    def build_folder(self, build, client=None, compiler="GNU"):
        """A CMake build folder as an IDE leaves it, with one test result in it."""
        self.write(f"{build}/CMakeCache.txt", "CMAKE_GENERATOR:INTERNAL=Ninja\n")
        self.write(f"{build}/CMakeFiles/3.28.3/CMakeCXXCompiler.cmake", f'set(CMAKE_CXX_COMPILER_ID "{compiler}")\n')
        if client:
            Path(self.dir, build, ".cmake/api/v1/query", client).mkdir(parents=True)
        return self.write(f"{build}/test-results/S.A.xml", xml(("A", False)))

    def test_the_ide_is_where_the_latest_results_came_from(self):
        cases = [
            (self.build_folder("build", "client-vscode"), {"name": "vscode", "compiler": "gcc"}),
            (self.build_folder("cmake-build-debug", compiler="Clang"), {"name": "clion", "compiler": "clang"}),
            (self.build_folder("out/build/x64-Debug", compiler="MSVC"), {"name": "visualstudio", "compiler": "msvc"}),
            (self.build_folder("cli"), {"name": "commandline", "compiler": "gcc"}),
            (self.write("x64/Debug/XMLGoogleTestResults.xml", xml(("A", False))),
             {"name": "visualstudio", "compiler": "msvc"}),
        ]
        for path, expected in cases:
            self.assertEqual(h.detect_ide(self.dir, path), expected, path)

    def test_before_any_results_the_project_folders_tell(self):
        self.assertEqual(h.detect_ide(self.dir), {"name": None, "compiler": None})
        Path(self.dir, ".vscode").mkdir()
        self.assertEqual(h.detect_ide(self.dir)["name"], "vscode")
        Path(self.dir, ".idea").mkdir()
        self.assertEqual(h.detect_ide(self.dir)["name"], "clion")
        self.write("Game.sln", "")
        self.assertEqual(h.detect_ide(self.dir)["name"], "visualstudio")

    def test_a_run_tells_the_game_its_ide(self):
        h.state.update(tests={}, run=0, runTime=None, version=0, ide=None)
        path = self.build_folder("cmake-build-debug")
        h.publish(h.check_result_files([path], {}), None, [], None, None)
        self.assertEqual(h.snapshot()["ide"], {"name": "clion", "compiler": "gcc"})

    def test_a_labs_smells_md_is_read_like_the_readme(self):
        self.assertIsNone(h.read_smells(self.dir))
        self.write("Smells.md", "# Smell log\nline 12  Magic number\n")
        self.assertEqual(h.read_smells(self.dir), {"path": "Smells.md", "content": "# Smell log\nline 12  Magic number\n"})
        h.publish([], None, [], None, None, h.read_smells(self.dir))
        self.assertEqual(h.snapshot()["smells"]["path"], "Smells.md")

    def test_a_class_code_may_have_an_underscore(self):
        self.assertEqual(h.CLASS_CODE_LINE.search("Class code: REFACTORING_26\nLab: refactor").group(1),
                         "REFACTORING_26")


class BrowserConnectionTests(unittest.TestCase):
    class ClosedTab:
        """The event stream's socket, for a tab that has already gone."""

        def write(self, _):
            raise ConnectionAbortedError("tab closed")

        def flush(self):
            pass

    def open_tab(self):
        """One game tab's event stream, from connect until the helper sees it closed."""
        handler = h.Handler.__new__(h.Handler)
        handler.send_response = handler.send_header = handler.end_headers = lambda *a: None
        handler.send_cors_headers = lambda: None
        handler.wfile = self.ClosedTab()
        handler.stream_events()

    def test_a_lost_tab_and_its_reconnect_are_both_reported(self):
        h.sse_clients, h.browser_lost = 0, False
        with unittest.mock.patch("builtins.print") as said:
            self.open_tab()  # the first tab: no "reconnected"
            self.open_tab()  # reloaded
        lines = [c.args[0] for c in said.call_args_list]
        self.assertEqual(len(lines), 3)
        self.assertTrue(lines[0].startswith("Lost the browser connection"))
        self.assertEqual(lines[1], "Browser reconnected.")
        self.assertTrue(lines[2].startswith("Lost the browser connection"))
        self.assertEqual(h.sse_clients, 0)

    def test_one_of_two_tabs_closing_is_not_a_lost_connection(self):
        h.sse_clients, h.browser_lost = 1, False  # another tab stays open
        with unittest.mock.patch("builtins.print") as said:
            self.open_tab()
        said.assert_not_called()
        self.assertEqual(h.sse_clients, 1)


class RescanTests(unittest.TestCase):
    """Between builds: a saved change reaches the app without a build or a test run."""

    def setUp(self):
        self.dir = tempfile.mkdtemp()
        h.config["project"] = self.dir
        h.state.update(tests={}, run=0, runTime=None, version=0, files=[], smells=None, git=None, build=None)
        self.code = Path(self.dir, "ConnectFour.cpp")
        self.save("int play() { return 0; }")
        h.rescan_sources(self.dir)

    def tearDown(self):
        shutil.rmtree(self.dir, ignore_errors=True)

    def save(self, content, path=None):
        (path or self.code).write_text(content)

    def test_a_saved_change_is_published_without_a_build(self):
        h.state["build"] = {"status": "succeeded", "errors": [], "time": 1}
        version = h.state["version"]
        self.save("int play() { return NoMove; }")
        self.assertTrue(h.rescan_sources(self.dir))
        self.assertEqual(h.state["files"][0]["content"], "int play() { return NoMove; }")
        self.assertGreater(h.state["version"], version)
        self.assertEqual(h.state["build"]["status"], "succeeded")  # kept: no new build

    def test_nothing_saved_publishes_nothing(self):
        version = h.state["version"]
        self.assertFalse(h.rescan_sources(self.dir))
        self.assertEqual(h.state["version"], version)

    def test_smells_md_being_written_is_published(self):
        self.save("- line 3: magic number", Path(self.dir, "smells.md"))
        self.assertTrue(h.rescan_sources(self.dir))
        self.assertIn("magic number", h.state["smells"]["content"])


class WaitTests(unittest.TestCase):
    def test_the_game_opens_after_at_most_10_seconds(self):
        self.assertLessEqual(h.RESULTS_WAIT_SECONDS, 10)
        self.assertLess(h.FIRST_RESCAN_SECONDS, h.RESCAN_SECONDS)


class GamePageTests(unittest.TestCase):
    def test_the_page_keeps_its_base_and_fonts(self):
        self.assertIn(f'<base href="{h.PUBLISHED_URL}">', h.GAME_PAGE)
        self.assertIn("fonts.googleapis.com/css2?family=Source+Code+Pro", h.GAME_PAGE)
        self.assertIn("href='global.css'", h.GAME_PAGE)

    def test_the_bundle_is_loaded_by_the_version_script_only(self):
        # not by a static tag, which the browser could serve from its 10-minute cache
        self.assertNotIn("<script defer", h.GAME_PAGE)
        self.assertNotIn("<link rel='stylesheet' href='build/bundle.css'>", h.GAME_PAGE)
        self.assertIn("fetch('build/version.txt', { cache: 'no-store' })", h.GAME_PAGE)
        self.assertIn("'build/bundle.js' + q", h.GAME_PAGE)
        self.assertIn("'build/bundle.css' + q", h.GAME_PAGE)

    def test_the_bundle_still_loads_if_the_version_cannot_be_fetched(self):
        self.assertIn("function () { load(''); }", h.GAME_PAGE)  # fetch rejected
        self.assertIn("r.ok ? r.text() : ''", h.GAME_PAGE)  # 404 and the like

    def test_the_script_is_valid_javascript_text(self):
        # the f-string must not leave doubled braces behind
        self.assertNotIn("{{", h.GAME_PAGE)
        self.assertNotIn("}}", h.GAME_PAGE)
        self.assertIn(r"/^[\w.-]{1,40}$/", h.GAME_PAGE)


if __name__ == "__main__":
    unittest.main()
