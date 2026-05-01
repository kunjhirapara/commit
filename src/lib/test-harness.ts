/**
 * test-harness.ts
 * Builds runnable code from user solution + test cases for each language.
 * The generated code is sent to the Docker runner as-is.
 */

export interface TestCase {
  args: unknown[];
  expected: unknown;
  inPlace?: boolean;
  /** Human-readable input shown in the UI (e.g. "nums = [2,7,11,15]\ntarget = 9") */
  inputLabel: string;
  /** Human-readable expected value shown in the UI (e.g. "[0,1]") */
  expectedLabel: string;
}

/** One test case result parsed from the harness stdout */
export interface ParsedTestResult {
  index: number;   // 0-based
  pass: boolean;
  got?: string;    // the raw value the function returned
  error?: string;
}

/**
 * Parses the human-readable harness output into structured per-test results.
 * Matches lines like:
 *   "Test 1: ✓ PASS"  →  { index:0, pass:true }
 *   "Test 2: ✗ FAIL"  →  { index:1, pass:false }
 *   "  Got:      [0,2]" →  appended to last result
 */
export function parseTestOutput(stdout: string): ParsedTestResult[] {
  const results: ParsedTestResult[] = [];
  let last: ParsedTestResult | null = null;

  for (const line of stdout.split("\n")) {
    const passMatch = line.match(/^Test (\d+): ✓ PASS/);
    const failMatch = line.match(/^Test (\d+): ✗ (FAIL|ERROR)/);
    const gotMatch = line.match(/^  Got:\s+(.+)$/);
    const errMatch = line.match(/^  Error:\s+(.+)$/);

    if (passMatch) {
      last = { index: parseInt(passMatch[1]) - 1, pass: true };
      results.push(last);
    } else if (failMatch) {
      last = { index: parseInt(failMatch[1]) - 1, pass: false };
      results.push(last);
    } else if (gotMatch && last) {
      last.got = gotMatch[1];
    } else if (errMatch && last) {
      last.error = errMatch[1];
    }
  }
  return results;
}

export interface QuestionRunMeta {
  /** JS function name, Python function name, Java method name */
  functionNames: { javascript: string; python: string; java: string };
  testCases: TestCase[];
  /** Hand-written Java statements pasted into a generated main() */
  javaMainBody: string;
}

// ─── JavaScript ───────────────────────────────────────────────────────────────

export function buildJavaScriptCode(userCode: string, meta: QuestionRunMeta): string {
  const testsJson = JSON.stringify(
    meta.testCases.map((t) => ({ args: t.args, expected: t.expected, inPlace: !!t.inPlace }))
  );
  const fnName = meta.functionNames.javascript;

  return `${userCode}

// ─── Auto Test Runner ─────────────────────────────────────────────────────────
;(function () {
  function __eq__(a, b) {
    if (a === b) return true;
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every(function (v, i) { return __eq__(v, b[i]); });
    }
    return JSON.stringify(a) === JSON.stringify(b);
  }

  var __tests__ = ${testsJson};
  var __fn__ = ${fnName};
  var __passed__ = 0;

  __tests__.forEach(function (t, i) {
    var result, error;
    try {
      var argsCopy = JSON.parse(JSON.stringify(t.args));
      if (t.inPlace) {
        __fn__.apply(null, argsCopy);
        result = argsCopy[0];
      } else {
        result = __fn__.apply(null, JSON.parse(JSON.stringify(t.args)));
      }
    } catch (e) { error = e.message; }

    var ok = !error && __eq__(result, t.expected);
    if (ok) __passed__++;
    console.log('Test ' + (i + 1) + ': ' + (ok ? '✓ PASS' : (error ? '✗ ERROR' : '✗ FAIL')));
    if (!ok) {
      if (error) console.log('  Error:    ' + error);
      else {
        console.log('  Expected: ' + JSON.stringify(t.expected));
        console.log('  Got:      ' + JSON.stringify(result));
      }
    }
  });

  var n = __tests__.length;
  console.log('\\n' + __passed__ + '/' + n + ' test' + (n !== 1 ? 's' : '') + ' passed');
})();
`;
}

// ─── Python ───────────────────────────────────────────────────────────────────

export function buildPythonCode(userCode: string, meta: QuestionRunMeta): string {
  const testsJson = JSON.stringify(
    meta.testCases.map((t) => ({
      args: t.args,
      expected: t.expected,
      in_place: !!t.inPlace
    }))
  )
    .replace(/true/g, "True")
    .replace(/false/g, "False");
  const fnName = meta.functionNames.python;

  return `${userCode}

# ─── Auto Test Runner ─────────────────────────────────────────────────────────
import json as __json__
import copy as __copy__

def __eq__(a, b):
    return __json__.dumps(a, sort_keys=True) == __json__.dumps(b, sort_keys=True)

__tests__ = ${testsJson}
__fn__ = ${fnName}
__passed__ = 0

for i, t in enumerate(__tests__):
    try:
        args = __copy__.deepcopy(t["args"])
        if t.get("in_place"):
            __fn__(*args)
            result = args[0]
        else:
            result = __fn__(*__copy__.deepcopy(t["args"]))
        error = None
    except Exception as e:
        result = None
        error = str(e)

    ok = not error and __eq__(result, t["expected"])
    if ok:
        __passed__ += 1
    status = "✓ PASS" if ok else ("✗ ERROR" if error else "✗ FAIL")
    print(f"Test {i + 1}: {status}")
    if not ok:
        if error:
            print(f"  Error:    {error}")
        else:
            print(f"  Expected: {__json__.dumps(t['expected'])}")
            print(f"  Got:      {__json__.dumps(result)}")

n = len(__tests__)
print(f"\\n{__passed__}/{n} test{'s' if n != 1 else ''} passed")
`;
}

// ─── Java ─────────────────────────────────────────────────────────────────────
// Strategy: strip the closing `}` of the user's Solution class and inject a
// public static void main() method, then close with `}`.

export function buildJavaCode(userCode: string, meta: QuestionRunMeta): string {
  // We need to inject the main method INSIDE the Solution class.
  // We look for the LAST closing brace '}' and inject before it.
  const lastBraceIndex = userCode.lastIndexOf("}");
  if (lastBraceIndex === -1) return userCode; // Should not happen with valid starter code

  const beforeBrace = userCode.slice(0, lastBraceIndex);
  const afterBrace = userCode.slice(lastBraceIndex + 1);

  return `${beforeBrace}
    // ─── Auto Test Runner ─────────────────────────────────────────────────
    public static void main(String[] args) {
        Solution __sol__ = new Solution();
        int __passed__ = 0;
        int __total__ = 0;
${meta.javaMainBody}
        System.out.println("\\n" + __passed__ + "/" + __total__ + " tests passed");
    }
}${afterBrace}`;
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export function buildTestCode(
  language: "javascript" | "python" | "java",
  userCode: string,
  meta: QuestionRunMeta
): string {
  switch (language) {
    case "javascript": return buildJavaScriptCode(userCode, meta);
    case "python": return buildPythonCode(userCode, meta);
    case "java": return buildJavaCode(userCode, meta);
  }
}
