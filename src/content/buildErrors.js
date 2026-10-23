// The MSVC compiler and linker errors beginners hit most, each in one plain
// sentence: what it usually means and what to check. Beginners can't read
// "error C2065: 'x': undeclared identifier", so the card shows the first
// error's file and line with this sentence. Works without the coach.
//
// The helper (rgg_server.py BUILD_ERROR) sends the build log's error lines as
// they are, e.g.
//   C:\Users\me\FizzBuzz\test.cpp(5,3): error C3861: 'fizzBuzz': identifier not found [C:\...\FizzBuzz.vcxproj]
//   test.obj : error LNK2019: unresolved external symbol "..." referenced in function "..."
//   LINK : fatal error LNK1104: cannot open file 'C:\...\FizzBuzz.exe'
// sometimes with Visual Studio's "1>" project prefix in front.

const MISSING_TYPE =
  "A type name the compiler doesn't know: a typo, or a missing #include for it (e.g. <string>) above this line.";
const NO_OPERATOR =
  "There's no ==, < or << for these types: often comparing or printing an object of your own class, or two different types.";
const MUST_RETURN = "This function doesn't return a value on every path: add a return at the end of it.";

export const BUILD_ERRORS = {
  // names the compiler hasn't seen
  C2065: "You used a name the compiler hasn't seen: a typo, or a missing #include or declaration.",
  C3861:
    "You called a function the compiler hasn't seen: check the spelling, and that its header is #included. In Red that's fine if the function doesn't exist yet.",
  C2039: "You used a member the class (or namespace) doesn't have: check the spelling, or declare it in the class.",
  C2061: MISSING_TYPE,
  C4430: MISSING_TYPE,
  C2146: MISSING_TYPE,
  C3646: MISSING_TYPE,
  C2079: "This uses a class the compiler only knows by name: #include the header that defines the class.",
  C1083: "An #include names a file the compiler can't find: check the file name, and that the file is in the project folder.",
  // syntax: brackets and semicolons
  C2143: "A syntax error: usually a missing ; at the end of the line before, or a missing bracket.",
  C2059: "A syntax error: something on this line is out of place, often a missing or extra bracket, comma or ;.",
  C2447: "A { with no function in front of it: usually a ; after the function's ) that shouldn't be there.",
  C2628: "A missing ; after a class: the class's closing } needs a ; after it.",
  C1075: "A { has no matching }: count the braces in this file.",
  C2601: "A function inside another function: a } is probably missing above this line.",
  C2181: "An else without a matching if: often a ; straight after the if (...), or a missing { }.",
  // calls and types
  C2660: "A call with the wrong number of arguments: compare the call with the function's declaration.",
  C2664: "An argument has the wrong type for the function: compare what you pass with the parameter types.",
  C2440: "A value of the wrong type: e.g. returning a number from a function that returns std::string.",
  C2676: NO_OPERATOR,
  C2678: NO_OPERATOR,
  C2512: "The class has no constructor that takes no arguments: pass the arguments it needs, or add one.",
  C4716: MUST_RETURN,
  C2561: MUST_RETURN,
  C2562: "A void function returns a value: remove the value, or change void to the type it returns.",
  // defined twice
  C2084: "This function has two bodies: it's defined twice, maybe in the header and in a .cpp file.",
  C2011: "This class is defined twice: add #pragma once at the top of its header.",
  C2086: "A variable declared twice in the same block: remove one, or give it another name.",
  C2374: "A variable declared twice in the same block: remove one, or give it another name.",
  // the linker
  LNK2019:
    "A function is declared but its body is missing: write the body, or check its name and parameters match the declaration exactly.",
  LNK1120: "The linker is missing some function bodies: see the LNK2019 error that comes before this one.",
  LNK2005:
    "Something is defined twice: a function body in a header needs inline in front, or a .cpp file is #included somewhere.",
  LNK1168: "The program is still running, so it can't be rebuilt: close it (or stop debugging), then build again.",
  LNK1104: "The linker can't open a file: if it's your .exe, the program is still running, so close it and build again.",
};

// [prefix "1>"] where[(line[,col])] : [fatal ]error CODE: message [project]
const ERROR_LINE =
  /^\s*(?:\d+>)?\s*(.*?)(?:\((\d+)(?:,\d+)?\))?\s*:\s*(?:fatal\s+)?error\s+([A-Z]+\d+)\s*:\s*(.*?)\s*(?:\[[^\]]*\.vcxproj\])?\s*$/;
// the linker's "where" is an .obj, an .exe or LINK: no source line to point at
const NOT_SOURCE = /\.(?:obj|exe|lib|dll)$|^LINK$/i;
const MAX_MESSAGE = 160;

const baseName = (path) => path.split(/[\\/]/).pop();

// One error line as {code, file, line, message, help}: file "" when it isn't
// a source file, line null without one, help "" for a code the table doesn't
// have. Null when the line isn't a build error.
export function explainBuildError(text) {
  const m = ERROR_LINE.exec(String(text || ""));
  if (!m) return null;
  const [, where, line, code, message] = m;
  const file = where && !NOT_SOURCE.test(baseName(where.trim())) ? baseName(where.trim()) : "";
  return {
    code,
    file,
    line: file && line ? Number(line) : null,
    message: message.length > MAX_MESSAGE ? message.slice(0, MAX_MESSAGE - 1) + "…" : message,
    help: BUILD_ERRORS[code] || "",
  };
}

// The first error worth fixing (later ones are often caused by it), plus how
// many more there are; null when there's nothing to explain.
export function firstBuildError(errors) {
  const lines = errors || [];
  for (const text of lines) {
    const error = explainBuildError(text);
    if (error) return { ...error, more: lines.length - 1 };
  }
  return null;
}

// "test.cpp line 5", "test.cpp", or "" for the linker.
export const errorPlace = (error) => (error?.file ? error.file + (error.line ? ` line ${error.line}` : "") : "");
