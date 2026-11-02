// A lab worksheet: the README's numbered steps, so the game can say which step
// is next and show its details (the refactor lab, lab.js). Two step formats:
//   - [ ] **2.1 [Refactor]** text...        a checklist item; indented lines are its body
//   ### Step 3.4 [Develop]: title           a heading; its body runs to the next heading
// under numbered sections ("## 2. Easy changes"). A section titled "... (if you
// have time)" or "... (take-home)" makes its steps optional, as does a step
// title ending so. Headings and items inside code blocks don't count.

const SECTION = /^##\s+(\d+)\.\s+(.+?)\s*$/;
const OTHER_HEADING = /^#{1,2}\s/;
const CHECK_STEP = /^[-*]\s+\[[ xX]\]\s+\*\*(\d+\.\d+)\s+\[(Refactor|Develop)\]\*\*\s*(.*)$/i;
const HEADING_STEP = /^###\s+Step\s+(\d+\.\d+)\s+\[(Refactor|Develop)\]\s*:?\s*(.*?)\s*$/i;
const ANY_H3 = /^###\s/;
const OPTIONAL = /\((if you have time|take-home)\)\s*$/i;

const optionalOf = (title) => title.match(OPTIONAL)?.[1].toLowerCase() || null;
const dedent = (lines) => {
  const indents = lines.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length);
  const cut = indents.length ? Math.min(...indents) : 0;
  return lines.map((l) => l.slice(cut));
};
const trimBlank = (lines) => {
  const out = [...lines];
  while (out.length && !out[0].trim()) out.shift();
  while (out.length && !out[out.length - 1].trim()) out.pop();
  return out;
};

// {sections: [{number, title, optional, intro}], steps: [{id, section, hat, title, body, optional}]};
// no steps when the README has none in these formats.
export function parseWorksheet(readme) {
  const lines = String(readme || "").replace(/\r\n?/g, "\n").split("\n");
  const sections = [];
  const steps = [];
  let section = null; // the numbered section we're in
  let step = null; // the step whose body we're collecting
  let fence = false;
  const close = () => {
    if (!step) return;
    step.body = trimBlank(step.kind === "check" ? dedent(step.lines) : step.lines).join("\n");
    delete step.lines;
    delete step.kind;
    steps.push(step);
    step = null;
  };
  for (const line of lines) {
    const isFence = /^\s*```/.test(line);
    if (!fence && !isFence) {
      const sec = line.match(SECTION);
      const check = line.match(CHECK_STEP);
      const head = line.match(HEADING_STEP);
      if (sec || (OTHER_HEADING.test(line) && !ANY_H3.test(line))) {
        close();
        section = sec ? { number: Number(sec[1]), title: sec[2], optional: optionalOf(sec[2]), intro: [] } : null;
        if (section) sections.push(section);
        continue;
      }
      if (section && (check || head)) {
        close();
        const [, id, hat, title] = check || head;
        step = {
          id,
          section: section.number,
          hat: hat.toLowerCase(),
          title: title.trim(),
          optional: optionalOf(title) || section.optional,
          kind: check ? "check" : "heading",
          lines: [],
        };
        continue;
      }
      if (ANY_H3.test(line)) {
        close(); // another ### heading (e.g. "Further stretch") ends a step: not a step itself
        continue;
      }
      // a checklist item's body is its indented lines (and the blank lines between them)
      if (step?.kind === "check" && line.trim() && !/^\s/.test(line)) close();
    }
    if (isFence) fence = !fence;
    if (step) step.lines.push(line);
    else if (section && !steps.some((s) => s.section === section.number)) section.intro.push(line);
  }
  close();
  for (const s of sections) s.intro = trimBlank(s.intro).join("\n");
  return { sections, steps };
}

// Markdown without its marks, for one line of plain text ("`move()` doesn't..." -> "move() doesn't...").
// A code span keeps what's in it: "`r * 7 + c`" -> "r * 7 + c".
export const plainText = (md) =>
  String(md || "")
    .split(/(`[^`]*`)/)
    .map((part, i) => (i % 2 ? part.slice(1, -1) : part.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[*_]/g, "")))
    .join("")
    .replace(/\s+/g, " ")
    .trim();

// The step's one-line headline: the heading title, or a checklist item's text.
export const stepHeadline = (step) => plainText(step?.title || "");

// What the coach is told about the lab: every step's headline, and the current
// step in full. Much shorter than the README (the coach's problem text is at
// most 8000 characters).
export function worksheetProblem(worksheet, current, max = 8000) {
  const list = worksheet.steps
    .map((s) => `${s.id} [${s.hat === "develop" ? "Develop" : "Refactor"}]${s.optional ? ` (${s.optional})` : ""} ${stepHeadline(s)}`)
    .join("\n");
  const step = worksheet.steps.find((s) => s.id === current);
  const now = step
    ? `\n\nThe pair is on step ${step.id} [${step.hat === "develop" ? "Develop" : "Refactor"}]: ${stepHeadline(step)}\n${step.body}`
    : "";
  return `The lab's worksheet steps, in order:\n${list}${now}`.slice(0, max);
}

// ---- A small, safe Markdown renderer for a step's body: HTML is escaped first,
// then code blocks, > notes, tables, lists, paragraphs, `code`, **bold**, *italic*.
const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const inline = (s) =>
  escape(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*\w])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
const cells = (row) => row.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

export function renderMarkdown(md) {
  const lines = String(md || "").split("\n");
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*```/.test(line)) {
      const code = [];
      for (i++; i < lines.length && !/^\s*```/.test(lines[i]); i++) code.push(lines[i]);
      i++;
      out.push(`<pre><code>${escape(code.join("\n"))}</code></pre>`);
    } else if (/^\s*>/.test(line)) {
      const note = [];
      for (; i < lines.length && /^\s*>/.test(lines[i]); i++) note.push(lines[i].replace(/^\s*>\s?/, ""));
      out.push(`<blockquote>${renderMarkdown(note.join("\n"))}</blockquote>`);
    } else if (/^\s*\|/.test(line)) {
      const rows = [];
      for (; i < lines.length && /^\s*\|/.test(lines[i]); i++) rows.push(lines[i]);
      const body = rows.filter((r, k) => !(k === 1 && /^\s*\|[\s|:-]+\|?\s*$/.test(r)));
      const [head, ...rest] = body.map(cells);
      out.push(
        `<table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>` +
          rest.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("") +
          "</tbody></table>"
      );
    } else if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const items = [];
      for (; i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i]); i++)
        items.push(`<li>${inline(lines[i].replace(/^\s*([-*]|\d+\.)\s+(\[[ xX]\]\s+)?/, ""))}</li>`);
      out.push(`<ul>${items.join("")}</ul>`);
    } else if (line.trim()) {
      const para = [];
      for (; i < lines.length && lines[i].trim() && !/^\s*(```|>|\||[-*]\s|\d+\.\s)/.test(lines[i]); i++) para.push(lines[i].trim());
      out.push(`<p>${inline(para.join(" "))}</p>`);
    } else i++;
  }
  return out.join("");
}
