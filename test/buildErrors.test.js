import { BUILD_ERRORS, explainBuildError, firstBuildError, errorPlace } from "../src/content/buildErrors.js";

const COMPILE =
  "C:\\Users\\me\\source\\repos\\FizzBuzz\\FizzBuzz\\test.cpp(5,3): error C3861: 'fizzBuzz': identifier not found [C:\\Users\\me\\source\\repos\\FizzBuzz\\FizzBuzz\\FizzBuzz.vcxproj]";

describe("explainBuildError: one line of the build log", () => {
  test("a compiler error: the file, line, code, message and the plain sentence", () => {
    expect(explainBuildError(COMPILE)).toEqual({
      code: "C3861",
      file: "test.cpp",
      line: 5,
      message: "'fizzBuzz': identifier not found",
      help: BUILD_ERRORS.C3861,
    });
  });

  test("a line without a column, with Visual Studio's project prefix", () => {
    const e = explainBuildError("1>D:\\pair\\Stack\\stack.h(12): error C2143: syntax error: missing ';' before '}'");
    expect([e.file, e.line, e.code, e.message]).toEqual(["stack.h", 12, "C2143", "syntax error: missing ';' before '}'"]);
  });

  test("a fatal error, and a path with brackets in it", () => {
    const e = explainBuildError(
      "C:\\Program Files (x86)\\work\\test.cpp(1,10): fatal error C1083: Cannot open include file: 'fizz.h': No such file or directory"
    );
    expect([e.file, e.line, e.code]).toEqual(["test.cpp", 1, "C1083"]);
    expect(e.help).toMatch(/can't find/);
  });

  test("the linker: no source file or line to point at", () => {
    const e = explainBuildError(
      'test.obj : error LNK2019: unresolved external symbol "class std::basic_string<char> __cdecl fizzBuzz(int)" (?fizzBuzz@@YA?AV?$basic_string@D@std@@H@Z) referenced in function "private: virtual void __cdecl FizzBuzz_One_Test::TestBody(void)"'
    );
    expect([e.code, e.file, e.line]).toEqual(["LNK2019", "", null]);
    expect(e.message.length).toBeLessThanOrEqual(160); // the mangled names are cut short
    expect(explainBuildError("LINK : fatal error LNK1104: cannot open file 'C:\\x\\FizzBuzz.exe'").file).toBe("");
    expect(explainBuildError("C:\\x\\Debug\\FizzBuzz.exe : fatal error LNK1120: 1 unresolved externals").file).toBe("");
  });

  test("a code the table doesn't have: no sentence, the compiler's message still shown", () => {
    const e = explainBuildError("a.cpp(3,1): error C2999: something rare");
    expect([e.code, e.help, e.message]).toEqual(["C2999", "", "something rare"]);
  });

  test("not an error line", () => {
    expect(explainBuildError("Build succeeded.")).toBeNull();
    expect(explainBuildError("a.cpp(3,1): warning C4100: unreferenced parameter")).toBeNull();
    expect(explainBuildError(undefined)).toBeNull();
  });
});

describe("the table", () => {
  test("covers the errors beginners hit most, one short sentence each", () => {
    for (const code of ["C2065", "C3861", "C2039", "C2143", "C2059", "C2660", "C2664", "C2084", "C2011", "C2447",
      "C4430", "C2146", "C2628", "LNK2019", "LNK2005"])
      expect(BUILD_ERRORS[code]).toBeTruthy();
    for (const [code, text] of Object.entries(BUILD_ERRORS)) {
      expect(text.split(" ").length).toBeLessThanOrEqual(30);
      expect(text).toMatch(/\.$/);
      expect(code).toMatch(/^(C|LNK)\d{4}$/);
    }
  });
});

describe("firstBuildError: the error to fix first", () => {
  test("the first line that is an error, and how many more there are", () => {
    const e = firstBuildError(["garbage", COMPILE, "test.cpp(6,1): error C2065: 'x': undeclared identifier"]);
    expect([e.code, e.more]).toEqual(["C3861", 2]);
  });

  test("nothing to explain", () => {
    expect(firstBuildError([])).toBeNull();
    expect(firstBuildError(null)).toBeNull();
    expect(firstBuildError(["unknown error"])).toBeNull();
  });

  test("errorPlace names the file and line, or nothing for the linker", () => {
    expect(errorPlace(explainBuildError(COMPILE))).toBe("test.cpp line 5");
    expect(errorPlace({ file: "a.h", line: null })).toBe("a.h");
    expect(errorPlace({ file: "", line: null })).toBe("");
    expect(errorPlace(null)).toBe("");
  });
});
