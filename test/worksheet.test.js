import { parseWorksheet, worksheetProblem, renderMarkdown, stepHeadline, plainText, stepWarnings } from "../src/worksheet.js";

describe("stepWarnings: a step's warnings, shown again at its top", () => {
  test("⚠️ notes, Careful! and 'Leave … for now' paragraphs; not code, not ordinary text", () => {
    const body = [
      "Simplify to a single result variable:",
      "",
      "```cpp",
      "// careful: not a warning, it's code",
      "",
      "int result = NoMove;",
      "```",
      "",
      "> ⚠️ **Start `result` at `NoMove`**, not at `0`.",
      "> On a full board no column is playable.",
      "",
      "> **Careful!** Is that `4` the same thing as `WinLength`?",
      "",
      "Leave the `r` and `c` in `winner()` for now.",
      "",
      "Run the tests: green? Commit.",
    ].join("\n");
    expect(stepWarnings(body)).toEqual([
      "> ⚠️ **Start `result` at `NoMove`**, not at `0`.\n> On a full board no column is playable.",
      "> **Careful!** Is that `4` the same thing as `WinLength`?",
      "Leave the `r` and `c` in `winner()` for now.",
    ]);
    expect(stepWarnings("Rename it.\n\nRun the tests.")).toEqual([]);
    expect(stepWarnings(undefined)).toEqual([]);
  });
});

// A small worksheet in both step formats, like the Connect Four lab's README.
const README = `Class code: X
Lab: refactor

# Refactoring Lab

## 0. Setup (before the lab)

Build and run the tests.

## 1. Smells

Read the code. Write the smells in smells.md.

## 2. Easy changes

Every step here is **[Refactor]**.

- [ ] **2.1 [Refactor]** \`move()\` doesn't say what it does. Rename it to \`bestMoveFor()\`.

  A body paragraph after a blank line, still the same item.

- [ ] **2.2 [Refactor]** Two values are flags. Add a constant for each:

  \`\`\`cpp
  static constexpr int NoMove = -1;
  ## 9. Not a section: it's in code
  \`\`\`

  > Use \`constexpr\`.

---

## 3. Fuse the loops

Both loops visit the same seven columns.

### Step 3.1 [Refactor]: loop 2 records its answer

\`\`\`cpp
### Step 9.9 [Refactor]: not a step, it's in code
\`\`\`

Run the tests: green? Commit.

### Step 3.4 [Develop]: change of hat

Delete the guard.

## 4. More (if you have time)

### Step 4.1 [Develop]: tests first

Write four tests.

### Step 4.2 [Refactor]: tidy up (take-home)

Tidy.

### Further stretch [Develop] (pick any)

Not a numbered step.

## Wrap-up

Fill in smells.md.
`;

describe("parseWorksheet: the README's numbered steps", () => {
  const w = parseWorksheet(README);

  test("both step formats, in order, with their hat", () => {
    expect(w.steps.map((s) => [s.id, s.hat, s.section])).toEqual([
      ["2.1", "refactor", 2],
      ["2.2", "refactor", 2],
      ["3.1", "refactor", 3],
      ["3.4", "develop", 3],
      ["4.1", "develop", 4],
      ["4.2", "refactor", 4],
    ]);
  });

  test("a checklist item's body is its indented lines; headings in code don't count", () => {
    const [s21, s22] = w.steps;
    expect(s21.title).toBe("`move()` doesn't say what it does. Rename it to `bestMoveFor()`.");
    expect(s21.body).toBe("A body paragraph after a blank line, still the same item.");
    expect(s22.body).toBe("```cpp\nstatic constexpr int NoMove = -1;\n## 9. Not a section: it's in code\n```\n\n> Use `constexpr`.");
    expect(w.sections.map((s) => s.number)).toEqual([0, 1, 2, 3, 4]);
  });

  test("a heading step's body runs to the next heading; another ### heading isn't a step", () => {
    const s31 = w.steps[2];
    expect(s31.title).toBe("loop 2 records its answer");
    expect(s31.body).toMatch(/^```cpp\n### Step 9\.9/);
    expect(s31.body).toMatch(/green\? Commit\.$/);
    expect(w.steps.at(-1).body).toBe("Tidy."); // stops at "### Further stretch"
  });

  test("optional: from the section's title, or the step's own", () => {
    expect(w.steps.map((s) => s.optional)).toEqual([null, null, null, null, "if you have time", "take-home"]);
  });

  test("each section's intro, for Section 1's smells", () => {
    expect(w.sections.find((s) => s.number === 1).intro).toBe("Read the code. Write the smells in smells.md.");
  });

  test("a README without steps has none", () => {
    expect(parseWorksheet("# FizzBuzz\n\nWrite fizzBuzz.").steps).toEqual([]);
    expect(parseWorksheet(null).steps).toEqual([]);
  });

  test("the coach's problem text: every step's headline, then the current step in full", () => {
    const text = worksheetProblem(w, "2.2");
    expect(text).toMatch(/^The lab's worksheet steps, in order:\n2\.1 \[Refactor\] move\(\) doesn't say/);
    expect(text).toMatch(/\n4\.1 \[Develop\] \(if you have time\) tests first\n/);
    expect(text).toMatch(/The pair is on step 2\.2 \[Refactor\]: Two values are flags[\s\S]*NoMove = -1/);
    expect(worksheetProblem(w, null)).not.toMatch(/The pair is on/);
    expect(worksheetProblem(w, "2.2", 100)).toHaveLength(100);
  });

  test("headlines are plain text", () => {
    expect(stepHeadline(w.steps[0])).toBe("move() doesn't say what it does. Rename it to bestMoveFor().");
    expect(plainText("see [smells.md](smells.md), **now**")).toBe("see smells.md, now");
    expect(plainText("Extract `r * 7 + c` into `indexOf()`, *now*")).toBe("Extract r * 7 + c into indexOf(), now");
    expect(plainText("keep `snake_case` and `a[i](j)`")).toBe("keep snake_case and a[i](j)");
  });
});

describe("renderMarkdown: a step's body on the card", () => {
  test("code blocks, notes, tables, lists and inline marks", () => {
    const html = renderMarkdown(
      "Add `x` **now**, *carefully*.\n\n```cpp\nif (a < b) {}\n```\n\n> 💡 **Hint:** look\n\n|A|B|\n|-|-|\n|`c`|d|\n\n- one\n- two"
    );
    expect(html).toBe(
      "<p>Add <code>x</code> <strong>now</strong>, <em>carefully</em>.</p>" +
        "<pre><code>if (a &lt; b) {}</code></pre>" +
        "<blockquote><p>💡 <strong>Hint:</strong> look</p></blockquote>" +
        "<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td><code>c</code></td><td>d</td></tr></tbody></table>" +
        "<ul><li>one</li><li>two</li></ul>"
    );
  });

  test("HTML in the README is shown, never run", () => {
    const html = renderMarkdown('<script>alert(1)</script> <img src=x onerror="y">\n\n```\n<b>\n```');
    expect(html).not.toMatch(/<script|<img|<b>/);
    expect(html).toMatch(/&lt;script&gt;/);
  });

  test("a link shows its text only", () => {
    expect(renderMarkdown("see [BUILD.md](BUILD.md)")).toBe("<p>see BUILD.md</p>");
  });
});
