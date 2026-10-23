// The navigator's prediction (optional, never a hold): before a test run, say
// whether it will come back all green or with something red. The next fresh
// run settles it (gameState.settlePrediction). Guessing first makes the run
// a test of their understanding, not just of the code.
import { buildFailed, changedSinceRun, currentTests, failingTests, staleResults } from "./rules.js";

// What a run showed: "green", "red" (a failing test or a failed build), or
// null when there's nothing fresh to judge.
export function outcomeOf(snapshot) {
  if (!snapshot) return null;
  if (buildFailed(snapshot)) return "red";
  if (staleResults(snapshot) || !currentTests(snapshot).length) return null;
  return failingTests(snapshot).length ? "red" : "green";
}

// A run is coming: the code changed since the last one, or a test hasn't run yet.
export const predictionDue = (snapshot) => !!snapshot && (changedSinceRun(snapshot) || staleResults(snapshot));

export const GUESSES = { green: "All green", red: "Something red" };
