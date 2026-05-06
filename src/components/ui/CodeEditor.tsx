"use client";

import { CODING_QUESTIONS, LANGUAGES } from "@/constants";
import { buildTestCode, parseTestOutput, type ParsedTestResult } from "@/lib/test-harness";
import { useState, useCallback, useMemo, useEffect } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "./resizable";
import { ScrollArea, ScrollBar } from "./scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import {
  AlertCircleIcon,
  BookIcon,
  CheckCircle2Icon,
  CircleXIcon,
  ClockIcon,
  LightbulbIcon,
  Loader2Icon,
  PlayIcon,
} from "lucide-react";
import { Editor } from "@monaco-editor/react";
import { Button } from "./button";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";

/* ─────────────────────────────────────────────────────────── types ── */

interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  executionMs: number;
}

type RunStatus = "idle" | "running" | "success" | "error";
type ActiveTab = "cases" | "result";

/* ─────────────────────────────────────────── sub-components ── */

/** A single labelled value box (Input / Output / Expected) */
function ValueBox({ label, value, accent }: { label: string; value: string; accent?: "green" | "red" }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <pre
        className={cn(
          "rounded-lg border px-3 py-2.5 text-sm font-mono whitespace-pre-wrap break-words",
          "bg-muted/30",
          accent === "green" && "border-emerald-700/60 text-emerald-300",
          accent === "red"   && "border-red-700/60 text-red-300",
          !accent && "text-foreground",
        )}>
        {value}
      </pre>
    </div>
  );
}

/* ─────────────────────────────────────────────────── main component ── */

interface CodeEditorProps {
  streamCallId?: string;
}

function CodeEditor({ streamCallId }: CodeEditorProps) {
  const { resolvedTheme } = useTheme();
  const [selectedQuestion, setSelectedQuestion] = useState(CODING_QUESTIONS[0]);
  const [language, setLanguage] = useState<"javascript" | "python" | "java">(LANGUAGES[0].id);
  const [code, setCode] = useState(selectedQuestion.starterCode[language]);

  const [runStatus, setRunStatus] = useState<RunStatus>("idle");
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("cases");
  const [selectedCase, setSelectedCase] = useState(0);

  // Switch to result tab after every run
  useEffect(() => {
    if (runStatus === "success" || runStatus === "error") setActiveTab("result");
  }, [runStatus]);

  // Parse per-test results from stdout
  const parsedResults = useMemo<ParsedTestResult[]>(() => {
    if (!result?.stdout) return [];
    return parseTestOutput(result.stdout);
  }, [result?.stdout]);

  // Overall summary
  const summary = useMemo(() => {
    if (!parsedResults.length) return null;
    const passed = parsedResults.filter((r) => r.pass).length;
    return { passed, total: parsedResults.length, allPass: passed === parsedResults.length };
  }, [parsedResults]);

  const currentTC  = selectedQuestion.testCases[selectedCase];
  const currentRes = parsedResults[selectedCase] ?? null;
  const editorTheme = resolvedTheme === "light" ? "vs" : "vs-dark";

  /* ── handlers ─────────────────────────────────────── */

  const handleQuestionChange = (questionId: string) => {
    const q = CODING_QUESTIONS.find((q) => q.id === questionId)!;
    setSelectedQuestion(q);
    setCode(q.starterCode[language]);
    setResult(null);
    setRunStatus("idle");
    setActiveTab("cases");
    setSelectedCase(0);
  };

  const handleLanguageChange = (lang: "javascript" | "python" | "java") => {
    setLanguage(lang);
    setCode(selectedQuestion.starterCode[lang]);
    setResult(null);
    setRunStatus("idle");
    setActiveTab("cases");
  };

  const handleRunCode = useCallback(async () => {
    if (runStatus === "running") return;
    setRunStatus("running");
    setResult(null);

    const fullCode = buildTestCode(language, code, {
      functionNames: selectedQuestion.functionNames,
      testCases:     selectedQuestion.testCases,
      javaMainBody:  selectedQuestion.javaMainBody,
    });

    try {
      const res  = await fetch("/api/execute", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ language, code: fullCode, streamCallId }),
      });
      const data: ExecutionResult = await res.json();
      setResult(data);
      setRunStatus(data.exitCode === 0 ? "success" : "error");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error.";
      setResult({ stdout: "", stderr: msg, exitCode: 1, timedOut: false, executionMs: 0 });
      setRunStatus("error");
    }
  }, [code, language, runStatus, selectedQuestion]);

  /* ── render ───────────────────────────────────────── */

  return (
    <ResizablePanelGroup orientation="vertical" className="min-h-[calc(100vh-4rem-1px)]">

      {/* ── Top panel: problem description ── */}
      <ResizablePanel defaultSize={40}>
        <ScrollArea className="h-full">
          <div className="p-6">
            <div className="max-w-4xl mx-auto space-y-6">

              {/* Header row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h2 className="text-2xl font-semibold tracking-tight">{selectedQuestion.title}</h2>
                  <p className="text-sm text-muted-foreground">Choose your language and solve the problem</p>
                </div>
                <div className="flex items-center gap-3">
                  <Select value={selectedQuestion.id} onValueChange={handleQuestionChange}>
                    <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CODING_QUESTIONS.map((q) => (
                        <SelectItem key={q.id} value={q.id}>{q.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={language} onValueChange={handleLanguageChange}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue>
                        <div className="flex items-center gap-2">
                          <img src={`/${language}.png`} alt={language} className="w-5 h-5 object-contain" />
                          {LANGUAGES.find((l) => l.id === language)?.name}
                        </div>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((lang) => (
                        <SelectItem key={lang.id} value={lang.id}>
                          <div className="flex items-center gap-2">
                            <img src={`/${lang.id}.png`} alt={lang.name} className="w-5 h-5 object-contain" />
                            {lang.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Description */}
              <Card>
                <CardHeader className="flex flex-row items-center gap-2">
                  <BookIcon className="h-5 w-5 text-primary/80" />
                  <CardTitle>Problem Description</CardTitle>
                </CardHeader>
                <CardContent className="text-sm leading-relaxed">
                  <p className="whitespace-pre-line">{selectedQuestion.description}</p>
                </CardContent>
              </Card>

              {/* Examples */}
              <Card>
                <CardHeader className="flex flex-row items-center gap-2">
                  <LightbulbIcon className="h-5 w-5 text-yellow-500" />
                  <CardTitle>Examples</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-full w-full rounded-md border">
                    <div className="p-4 space-y-4">
                      {selectedQuestion.examples.map((ex, i) => (
                        <div key={i} className="space-y-2">
                          <p className="font-medium text-sm">Example {i + 1}:</p>
                          <pre className="bg-muted/50 p-3 rounded-lg text-sm font-mono">
                            <div>Input: {ex.input}</div>
                            <div>Output: {ex.output}</div>
                            {ex.explanation && <div className="pt-2 text-muted-foreground">Explanation: {ex.explanation}</div>}
                          </pre>
                        </div>
                      ))}
                    </div>
                    <ScrollBar />
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Constraints */}
              {selectedQuestion.constraints && (
                <Card>
                  <CardHeader className="flex flex-row items-center gap-2">
                    <AlertCircleIcon className="h-5 w-5 text-blue-500" />
                    <CardTitle>Constraints</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc list-inside space-y-1.5 text-sm marker:text-muted-foreground">
                      {selectedQuestion.constraints.map((c, i) => (
                        <li key={i} className="text-muted-foreground">{c}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
          <ScrollBar />
        </ScrollArea>
      </ResizablePanel>

      <ResizableHandle withHandle />

      {/* ── Bottom: editor + test panel ── */}
      <ResizablePanel defaultSize={60} minSize={35}>
        <ResizablePanelGroup orientation="vertical">

          {/* Editor */}
          <ResizablePanel defaultSize={60} minSize={25}>
            <div className="h-full flex flex-col">
              {/* Toolbar */}
              <div className="flex items-center justify-between border-b px-4 py-2 bg-muted/30 shrink-0">
                <span className="text-sm text-muted-foreground font-mono">solution.{language === "java" ? "java" : language === "python" ? "py" : "js"}</span>
                <Button
                  id="run-code-btn"
                  size="sm"
                  onClick={handleRunCode}
                  disabled={runStatus === "running"}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
                  {runStatus === "running"
                    ? <Loader2Icon className="h-4 w-4 animate-spin" />
                    : <PlayIcon className="h-4 w-4 fill-white" />}
                  {runStatus === "running" ? "Running…" : "Run Code"}
                </Button>
              </div>
              <div className="flex-1 min-h-0">
                <Editor
                  height="100%"
                  language={language}
                  theme={editorTheme}
                  value={code}
                  onChange={(v) => setCode(v || "")}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 18,
                    lineNumbers: "on",
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    padding: { top: 16, bottom: 16 },
                    wordWrap: "on",
                  }}
                />
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* ── Test panel (LeetCode-style) ── */}
          <ResizablePanel defaultSize={40} minSize={20}>
            <div className="h-full flex flex-col bg-background">

              {/* Tab bar */}
              <div className="flex items-center border-b shrink-0 px-1">
                {(["cases", "result"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                      activeTab === tab
                        ? "border-primary text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground",
                    )}>
                    {tab === "cases" ? "Testcases" : "Test Result"}
                    {tab === "result" && summary && (
                      summary.allPass
                        ? <CheckCircle2Icon className="h-3.5 w-3.5 text-emerald-500" />
                        : <CircleXIcon className="h-3.5 w-3.5 text-red-500" />
                    )}
                  </button>
                ))}

                {/* Right: timing */}
                <div className="ml-auto flex items-center gap-2 pr-3 text-xs text-muted-foreground">
                  {runStatus === "running" && <Loader2Icon className="h-3.5 w-3.5 animate-spin" />}
                  {result && !result.timedOut && (
                    <span className="flex items-center gap-1">
                      <ClockIcon className="h-3 w-3" />{result.executionMs} ms
                    </span>
                  )}
                  {result?.timedOut && <span className="text-red-400">Timed out</span>}
                </div>
              </div>

              {/* Case selector (shared between tabs) */}
              <div className="flex items-center gap-2 px-4 py-2 border-b shrink-0">
                {selectedQuestion.testCases.map((_, i) => {
                  const res = parsedResults[i];
                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedCase(i)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                        selectedCase === i
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground hover:bg-muted/60",
                      )}>
                      {/* coloured dot after running */}
                      {res && (
                        <span className={cn(
                          "inline-block h-2 w-2 rounded-full",
                          res.pass ? "bg-emerald-500" : "bg-red-500",
                        )} />
                      )}
                      Case {i + 1}
                    </button>
                  );
                })}
              </div>

              {/* Tab body */}
              <ScrollArea className="flex-1 min-h-0">
                <div className="p-4 space-y-4">

                  {/* ── TESTCASES tab ── */}
                  {activeTab === "cases" && (
                    <ValueBox label="Input" value={currentTC.inputLabel} />
                  )}

                  {/* ── RESULT tab ── */}
                  {activeTab === "result" && (
                    <>
                      {/* Running spinner */}
                      {runStatus === "running" && (
                        <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                          <Loader2Icon className="h-4 w-4 animate-spin" />
                          Executing in Docker sandbox…
                        </div>
                      )}

                      {/* Idle state */}
                      {runStatus === "idle" && (
                        <p className="text-sm text-muted-foreground italic py-4">
                          Press <strong>Run Code</strong> to execute your solution against all test cases.
                        </p>
                      )}

                      {/* Summary banner */}
                      {summary && (
                        <div className={cn(
                          "flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold",
                          summary.allPass
                            ? "bg-emerald-950/60 border border-emerald-700 text-emerald-300"
                            : "bg-red-950/50 border border-red-800 text-red-300",
                        )}>
                          {summary.allPass
                            ? <CheckCircle2Icon className="h-4 w-4" />
                            : <CircleXIcon className="h-4 w-4" />}
                          {summary.allPass
                            ? `Accepted — ${summary.passed}/${summary.total} tests passed`
                            : `Wrong Answer — ${summary.passed}/${summary.total} tests passed`}
                        </div>
                      )}

                      {/* Per-case detail */}
                      {currentRes && (
                        <div className="space-y-3">
                          <ValueBox label="Input" value={currentTC.inputLabel} />

                          <ValueBox
                            label="Output"
                            value={
                              currentRes.error
                                ? `Error: ${currentRes.error}`
                                : (currentRes.got ?? (currentRes.pass ? currentTC.expectedLabel : "—"))
                            }
                            accent={currentRes.pass ? "green" : "red"}
                          />

                          <ValueBox
                            label="Expected Output"
                            value={currentTC.expectedLabel}
                            accent="green"
                          />
                        </div>
                      )}

                      {/* stderr (compile errors, crashes) */}
                      {result?.stderr && (
                        <div className="space-y-1.5 mt-2">
                          <p className="text-xs font-medium text-red-400/80">stderr / compile error</p>
                          <pre className="rounded-lg border border-red-800/50 bg-red-950/30 px-3 py-2.5 text-sm font-mono text-red-300 whitespace-pre-wrap break-words">
                            {result.stderr}
                          </pre>
                        </div>
                      )}
                    </>
                  )}
                </div>
                <ScrollBar />
              </ScrollArea>
            </div>
          </ResizablePanel>

        </ResizablePanelGroup>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

export default CodeEditor;
