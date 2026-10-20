// The hint ladder (DESIGN-coach-flow.md section 6): how much help the pair
// sees, chosen by the app from how much they are struggling. The coach fills
// every rung of a verdict, so a higher rung needs no new call.
//   1  the coach's question (hint_question)
//   2  + the kind of thing to look at (hint_kind)
//   3  + the explicit driver and navigator actions; step details name code and values
//   4  the code itself (rescue): only on request, after RESCUE_AFTER holds (gameState)

export const AUTO_RUNS = 2; // fresh runs on a step with the live goal lines unchanged...
export const AUTO_MINUTES = 5; // ...or this long on the step: one rung more, by itself
export const TOP_RUNG = 3;

// The rung for a hold: 1, one more for each "More help" click, and one more
// once the pair has made 2 runs without progress or spent 5 minutes on the step.
export function hintRung({ moreHelp = 0, runsWithoutProgress = 0, minutesOnStep = 0 } = {}) {
  const auto = runsWithoutProgress >= AUTO_RUNS || minutesOnStep >= AUTO_MINUTES ? 1 : 0;
  return Math.min(TOP_RUNG, 1 + Math.max(0, moreHelp) + auto);
}

// The rung for the step card's details and the carried-over advice: novices
// (the guided cycles) always get the specific details; others follow the hold rung.
export const detailRung = (rung, novice) => (novice ? TOP_RUNG : rung);

// What a held step shows of the coach's verdict at a rung: the question, then
// the kind, then (rung 3) the actions, which Game puts in the Driver/Navigator lines.
export function ladderFor(verdict, rung) {
  if (!verdict) return { question: "", kind: "", actions: false, more: false };
  const question = rung >= 1 ? verdict.hint_question || "" : "";
  const kind = rung >= 2 ? verdict.hint_kind || "" : "";
  const actions = rung >= 3 && !!(verdict.driver_action || verdict.navigator_action);
  return { question, kind, actions, more: rung < TOP_RUNG };
}

// The live goal lines as a key: a fresh run that leaves it unchanged made no progress.
export const progressKey = (live) => JSON.stringify((live?.lines || []).map((l) => [l.text, l.ok]));
