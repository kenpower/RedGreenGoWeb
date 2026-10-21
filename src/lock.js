// Why Done is locked, in one line next to it (Step.svelte, which shows it in
// red after "Not yet: "). Never empty while Done is locked: lab 2026-10-21,
// pairs saw every checklist item ticked and a Done that wouldn't go, with
// nothing saying why.
//   items:     the visible checklist (next steps' "Needed to move on", or the guide)
//   liveLines: the step's live goal lines (rules.liveStatus), hidden while a checklist shows
export function lockReason({ helperMissing = false, items = [], liveLines = [] } = {}) {
  if (helperMissing) return "waiting for the helper";
  const current = items.find((i) => i.current && i.done !== true);
  if (current) return `see "${current.short || current.text}" above`;
  // every visible item is ticked: say which hidden rule still holds Done
  const unmet = liveLines.find((l) => l.ok !== true);
  if (unmet) return unmet.text;
  return "run your tests so the game can check this step";
}
