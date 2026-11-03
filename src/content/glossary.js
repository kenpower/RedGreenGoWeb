// A fixed glossary of the refactorings and smells beginners meet: one plain
// line and a tiny generic C++ before/after each (never the pair's own code).
// Names are matched forgivingly (glossaryFor): case, "Method" vs "Function",
// "Constant" vs "Symbolic Constant", punctuation. Unknown names give null.

export const GLOSSARY = [
  // ---- Refactorings ----
  {
    names: ["Rename Variable", "Rename Function", "Rename"],
    line: "Give something a name that says what it is or does, everywhere it is used.",
    before: "int d = days(a, b);",
    after: "int daysBetween = days(start, end);",
  },
  {
    names: ["Extract Function"],
    line: "Move a few lines with one clear job into a function of their own, named after that job.",
    before: "double total = price * qty;\ntotal += total * 0.2;",
    after: "double total = withTax(price * qty);",
  },
  {
    names: ["Replace Magic Number with Constant", "Introduce Constant"],
    line: "Replace a bare number with a named constant, so a reader knows what it means.",
    before: "if (age >= 18) { ... }",
    after: "const int AdultAge = 18;\nif (age >= AdultAge) { ... }",
  },
  {
    names: ["Decompose Conditional"],
    line: "Turn a long or confusing condition into a call to a function whose name says what it checks.",
    before: "if (month >= 6 && month <= 8) { ... }",
    after: "if (isSummer(month)) { ... }",
  },
  {
    names: ["Split Loop"],
    line: "A loop doing two jobs becomes two loops, one job each.",
    before: "for (int x : v) { sum += x; if (x > big) big = x; }",
    after: "for (int x : v) sum += x;\nfor (int x : v) if (x > big) big = x;",
  },
  {
    names: ["Inline Variable", "Inline Function"],
    line: "Remove a variable or function whose name says no more than its body, and use the body directly.",
    before: "bool ok = (n > 0);\nreturn ok;",
    after: "return n > 0;",
  },
  {
    names: ["Introduce Explaining Variable"],
    line: "Put part of a hard-to-read expression in a variable whose name explains it.",
    before: "return qty * price - qty * price * 0.1;",
    after: "double subtotal = qty * price;\nreturn subtotal - subtotal * 0.1;",
  },
  {
    names: ["Consolidate Duplicate Conditional Fragments"],
    line: "When every branch of an if ends with the same code, move it out so it is written once.",
    before: "if (big) { fee = 5; send(fee); }\nelse { fee = 2; send(fee); }",
    after: "if (big) fee = 5;\nelse fee = 2;\nsend(fee);",
  },
  {
    names: ["Replace Loop with Algorithm", "Replace Loop with Pipeline"],
    line: "Swap a hand-written loop for a standard library call that says what the loop is for.",
    before: "int n = 0;\nfor (int x : v) if (x > 0) n++;",
    after: "int n = std::count_if(v.begin(), v.end(),\n  [](int x) { return x > 0; });",
  },
  {
    names: ["Replace Nested Conditional with Guard Clauses"],
    line: "Handle the odd cases first and return early, so the main path is not buried in ifs.",
    before: "if (ok) {\n  if (n > 0) { return n; }\n}\nreturn 0;",
    after: "if (!ok) return 0;\nif (n <= 0) return 0;\nreturn n;",
  },
  {
    names: ["Merge Loops", "Fuse Loops", "Combine Loops", "Loop Fusion"],
    line: "Two loops over the same range, with no early exit, become one loop doing both jobs.",
    before: "for (int x : v) sum += x;\nfor (int x : v) if (x > big) big = x;",
    after: "for (int x : v) { sum += x; if (x > big) big = x; }",
  },
  {
    names: ["Replace Primitive with Object", "Replace Data Value with Object", "Introduce Value Object"],
    line: "Give a plain int or string its own small class, so the idea it stands for has a name and a home.",
    before: "int price = 1999;  // cents? euro?",
    after: "Money price = Money::euro(19.99);",
  },
  {
    names: ["Remove Dead Code"],
    line: "Delete code nothing uses. Version control remembers it if you ever need it.",
    before: "int f() { return 1; }  // never called",
    after: "(deleted)",
  },
  // ---- Smells ----
  {
    names: ["Poor name", "Mysterious name", "Unclear name"],
    line: "A name that does not tell the reader what the thing is or does.",
    before: "int d = calc(a, b);",
    after: "int daysBetween = countDays(start, end);",
  },
  {
    names: ["Magic number"],
    line: "A bare number in the code whose meaning the reader has to guess.",
    before: "if (age >= 18) { ... }",
    after: "if (age >= AdultAge) { ... }",
  },
  {
    names: ["Duplicated code", "Duplicate code"],
    line: "The same code written in more than one place, so every fix has to be made more than once.",
    before: "a = x * 0.2;\nb = y * 0.2;",
    after: "a = tax(x);\nb = tax(y);",
  },
  {
    names: ["Long or tangled method", "Long method", "Tangled method"],
    line: "A function that does several jobs or is hard to follow in one read.",
    before: "void run() { /* read, check, total, print */ }",
    after: "void run() { read(); check(); total(); print(); }",
  },
  {
    names: ["Primitive obsession"],
    line: "Plain ints and strings standing in for an idea that deserves its own type.",
    before: "void book(std::string phone);",
    after: "void book(PhoneNumber phone);",
  },
];

// "Replace Magic Number with (Symbolic) Constant" and its cousins to one key:
// lower case, letters and digits only, "method" is "function", "symbolic",
// "named", "a" and "the" dropped.
const WORD_FIX = { method: "function", methods: "function", functions: "function", constants: "constant", variables: "variable" };
const DROPPED = new Set(["symbolic", "named", "a", "the", "an"]);
export function key(name) {
  return String(name || "")
    .replace(/\([^)]*\)/g, " ") // "Rename (everywhere)"
    .split(":")[0] // "Extract Function: priceFor"
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !DROPPED.has(w))
    .map((w) => WORD_FIX[w] || w)
    .join(" ");
}

const BY_KEY = new Map();
for (const entry of GLOSSARY) for (const name of entry.names) if (!BY_KEY.has(key(name))) BY_KEY.set(key(name), entry);

// The entry for a refactoring or smell name, or null: {names, line, before, after}.
export const glossaryFor = (name) => BY_KEY.get(key(name)) || null;

// One spelling per refactoring, so the teacher's count of kinds isn't split by
// "Extract Method" vs "extract function": the lab's own spelling (`preferred`,
// its README's Refactorings line), else the glossary's, else the name as given
// (without a ": where" part). Only the same name in other words, never another
// refactoring: Rename Function and Rename Variable stay two. "" for no name.
const ALL_NAMES = GLOSSARY.flatMap((entry) => entry.names);
export function canonicalRefactoring(name, preferred = []) {
  const k = key(name);
  if (!k) return "";
  return (
    preferred.find((p) => key(p) === k) ||
    ALL_NAMES.find((n) => key(n) === k) ||
    String(name).split(":")[0].replace(/\s+/g, " ").trim().slice(0, 60)
  );
}

// Whether a commit message names a refactoring anywhere in its first line, from
// `preferred` (the lab's list) or the glossary's refactorings (not its smells):
// "Extract Function: indexOf", "2.4 extract function indexOf", "Rename move to
// bestMoveFor" (a one-word name only at the start). "fixed stuff" doesn't.
const REFACTORING_NAMES = GLOSSARY.slice(0, GLOSSARY.findIndex((e) => e.names.includes("Poor name"))).flatMap((e) => e.names);
export function namesRefactoring(message, preferred = []) {
  const words = ` ${key(String(message || "").split("\n")[0].replace(/:/g, " "))} `;
  return [...preferred, ...REFACTORING_NAMES].some((n) => {
    const k = key(n);
    if (!k) return false;
    return k.includes(" ") ? words.includes(` ${k} `) : words.startsWith(` ${k} `);
  });
}

// The refactoring a commit message names first ("Extract Function: indexOf",
// "Rename Variable t to afterMove"), from `preferred` or the glossary; "" if none.
// A one-word alias ("Rename move to bestMoveFor") only with `loose`: it says
// less than the coach's review of the change does.
export function refactoringInMessage(message, preferred = [], { loose = false } = {}) {
  const words = key(String(message || "").split("\n")[0].replace(/:/g, " "));
  const names = [...preferred, ...ALL_NAMES].filter((n) => key(n) && (loose || key(n).includes(" ")));
  const found = names
    .filter((n) => words === key(n) || words.startsWith(key(n) + " "))
    .sort((a, b) => key(b).length - key(a).length)[0];
  return found ? canonicalRefactoring(found, preferred) : "";
}
