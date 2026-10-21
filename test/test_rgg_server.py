"""Tests for the helper (rgg_server.py): how test results from GoogleTest XML files are merged.

  python -m unittest discover -s test -p "test_rgg_server.py" -v      (from the repo root)
"""

import os
import shutil
import sys
import tempfile
import time
import unittest
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


class WaitTests(unittest.TestCase):
    def test_the_game_opens_after_at_most_10_seconds(self):
        self.assertLessEqual(h.RESULTS_WAIT_SECONDS, 10)
        self.assertLess(h.FIRST_RESCAN_SECONDS, h.RESCAN_SECONDS)


if __name__ == "__main__":
    unittest.main()
