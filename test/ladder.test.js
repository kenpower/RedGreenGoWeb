import {
  hintRung, detailRung, ladderFor, progressKey, refactorCard, AUTO_RUNS, AUTO_MINUTES, REVEAL_MINUTES,
} from "../src/ladder.js";

const VERDICT = {
  decision: "redo",
  note: "Your new test fails for the wrong reason.",
  hint_question: "Which of your tests says the opposite of its own name?",
  hint_kind: "a backwards assertion",
  driver_action: "Fix the assertion in DifferentArtistNotEqual.",
  navigator_action: "Check its name and its assertion agree.",
};

describe("the hint rung", () => {
  test("a hold starts at rung 1: the question only", () => {
    expect(hintRung()).toBe(1);
    expect(ladderFor(VERDICT, 1)).toEqual({ question: VERDICT.hint_question, kind: "", actions: false, more: true });
  });

  test("each More help click is one rung more, up to rung 3 (the actions)", () => {
    expect(hintRung({ moreHelp: 1 })).toBe(2);
    expect(ladderFor(VERDICT, 2)).toEqual({ question: VERDICT.hint_question, kind: "a backwards assertion", actions: false, more: true });
    expect(hintRung({ moreHelp: 2 })).toBe(3);
    expect(hintRung({ moreHelp: 9 })).toBe(3);
    expect(ladderFor(VERDICT, 3)).toEqual({ question: VERDICT.hint_question, kind: "a backwards assertion", actions: true, more: false });
  });

  test("by itself, one rung more after 2 runs without progress or 5 minutes, whichever first", () => {
    expect(hintRung({ runsWithoutProgress: AUTO_RUNS - 1, minutesOnStep: AUTO_MINUTES - 0.5 })).toBe(1);
    expect(hintRung({ runsWithoutProgress: AUTO_RUNS })).toBe(2);
    expect(hintRung({ minutesOnStep: AUTO_MINUTES })).toBe(2);
    expect(hintRung({ runsWithoutProgress: AUTO_RUNS, minutesOnStep: 60 })).toBe(2); // one rung, not two
    expect(hintRung({ runsWithoutProgress: AUTO_RUNS, moreHelp: 1 })).toBe(3);
  });

  test("novices get the specific step details from the start; others follow the hold rung", () => {
    expect(detailRung(1, true)).toBe(3);
    expect(detailRung(1, false)).toBe(1);
    expect(detailRung(3, false)).toBe(3);
  });

  test("no verdict, no ladder; a missing rung field just isn't shown", () => {
    expect(ladderFor(null, 3)).toEqual({ question: "", kind: "", actions: false, more: false });
    expect(ladderFor({ decision: "redo", hint_question: "Why?" }, 3).actions).toBe(false);
  });

  test("the progress key changes when a live goal line does", () => {
    const live = { lines: [{ text: "Exactly one test fails", ok: false }] };
    expect(progressKey(live)).toEqual(progressKey({ lines: [{ text: "Exactly one test fails", ok: false }] }));
    expect(progressKey({ lines: [{ text: "Exactly one test fails", ok: true }] })).not.toEqual(progressKey(live));
    expect(progressKey(null)).toEqual("[]");
  });
});

describe("Refactor: the smell the Green verdict spotted", () => {
  const SMELL = { question: "There's one bit of duplication worth tidying. Can you spot it?", detail: "The three ifs in toRoman each return a run of 'I'." };

  test("the question first, with [Show me where]; where it is only once asked", () => {
    expect(refactorCard({ smell: SMELL })).toEqual({
      question: SMELL.question, detail: "", showWhere: true, nothingToTidy: "link", none: false,
    });
    expect(refactorCard({ smell: SMELL, clicked: true })).toMatchObject({ detail: SMELL.detail, showWhere: false });
  });

  test("where it is shows by itself after 2 minutes, or at rung 2", () => {
    expect(refactorCard({ smell: SMELL, minutesOnStep: REVEAL_MINUTES - 0.1 }).detail).toBe("");
    expect(refactorCard({ smell: SMELL, minutesOnStep: REVEAL_MINUTES }).detail).toBe(SMELL.detail);
    expect(refactorCard({ smell: SMELL, rung: 2 }).detail).toBe(SMELL.detail);
  });

  test("[Nothing to tidy yet] is a button while the guide runs, a quiet link after", () => {
    expect(refactorCard({ smell: SMELL, novice: true }).nothingToTidy).toBe("button");
    expect(refactorCard({ smell: SMELL, novice: false }).nothingToTidy).toBe("link");
  });

  test("no smell: one line, nothing to tidy", () => {
    expect(refactorCard({ smell: null })).toMatchObject({ none: true, question: "", showWhere: false });
    expect(refactorCard({ smell: { question: " ", detail: "" } }).none).toBe(true);
  });

  test("a held Refactor's ladder is about the smell: its question, then where it is", () => {
    const verdict = { decision: "redo", hint_question: "Which line adds behaviour?", hint_kind: "added behaviour", driver_action: "Take out the Buzz branch." };
    expect(ladderFor(verdict, 1, SMELL).question).toBe(SMELL.question);
    expect(ladderFor(verdict, 2, SMELL).kind).toBe(SMELL.detail);
    expect(ladderFor(verdict, 3, SMELL).actions).toBe(true);
    expect(ladderFor(verdict, 2, null)).toMatchObject({ question: "Which line adds behaviour?", kind: "added behaviour" });
  });
});
