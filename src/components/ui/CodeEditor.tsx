"use client";

import { CODING_QUESTIONS, LANGUAGES } from "@/constants";
import {
  buildTestCode,
  parseTestOutput,
  type ParsedTestResult,
} from "@/lib/test-harness";
import { useState, useCallback, useMemo, useEffect, useRef } from "react";
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
import { toast } from "sonner";
import type { EditorChange } from "@/lib/proctoring/authorship";

/* ─────────────────────────────────────────────────────────── types ── */

interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  executionMs: number;
  infraError?: boolean;
}

type RunStatus = "idle" | "running" | "success" | "error";
type ActiveTab = "cases" | "result";

function ValueBox({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "green" | "red";
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <pre
        className={cn(
          "rounded-lg border px-3 py-2.5 text-sm font-mono whitespace-pre-wrap break-words",
          "bg-muted/30",
          accent === "green" && "border-emerald-700/60 text-emerald-300",
          accent === "red" && "border-red-700/60 text-red-300",
          !accent && "text-foreground",
        )}>
        {value}
      </pre>
    </div>
  );
}

export type EditorSignal = {
  kind: "editor.paste" | "editor.bulkInsert" | "paste.blocked";
  chars: number;
};

/** The shape Monaco reports each edit in. Narrowed to what is actually read. */
type MonacoChange = {
  text?: string;
  rangeOffset?: number;
  rangeLength?: number;
};

/**
 * How long after a DOM paste a model change is still attributed to that paste.
 *
 * Monaco applies the change synchronously after the event, so this only has to
 * span one turn of the event loop. Generous enough to survive a slow frame,
 * short enough that the next character typed is not mislabelled as pasted.
 */
const PASTE_WINDOW_MS = 100;

interface CodeEditorProps {
  streamCallId?: string;
  /**
   * Reports editing activity that a caller may care about — currently large
   * single insertions, used by interview integrity monitoring.
   *
   * The editor deliberately knows nothing about proctoring: it says what
   * happened and the caller decides what it means. That keeps the practice
   * sandbox, which passes no callback, entirely unmonitored.
   */
  onEditorSignal?: (signal: EditorSignal) => void;
  /**
   * Reports every edit, so a caller can reconstruct how the code was written.
   *
   * Separate from `onEditorSignal` because it is a different kind of thing: one
   * is a handful of notable moments, this is the raw stream. The editor still
   * knows nothing about what either is for, and /practice passes neither.
   */
  onEditorChange?: (change: EditorChange) => void;
  /**
   * Hides the problem and the code behind a blur and makes them inert.
   *
   * The editor is told to mask, never told why. Keeping the reason out of here
   * is what lets the same component serve /practice with none of this attached.
   *
   * Worth being honest about in the one place someone will read it: blur is a
   * visual barrier, not a security boundary. The text is still in the DOM and
   * anyone with devtools can read it. The purpose is to remove the effortless
   * path — reading the problem on a second screen — and someone in devtools has
   * already left the population this is aimed at.
   */
  masked?: boolean;
  /** Refuses pastes into the editor and reports the attempt. */
  blockPaste?: boolean;
}

function CodeEditor({
  streamCallId,
  onEditorSignal,
  onEditorChange,
  masked = false,
  blockPaste = false,
}: CodeEditorProps) {
  const { resolvedTheme } = useTheme();
  const [selectedQuestion, setSelectedQuestion] = useState(CODING_QUESTIONS[0]);
  const [language, setLanguage] = useState<"javascript" | "python" | "java">(
    LANGUAGES[0].id,
  );
  const [code, setCode] = useState(selectedQuestion.starterCode[language]);

  const [editorNode, setEditorNode] = useState<HTMLElement | null>(null);
  const lastPasteAtRef = useRef(0);
  /**
   * Monaco's change listener is registered once at mount, so reading `language`
   * or `selectedQuestion` from the closure would report whatever they were when
   * the editor first appeared. Refs keep the labels honest after a switch.
   */
  const contextRef = useRef({
    language,
    questionId: selectedQuestion.id,
    onEditorSignal,
    onEditorChange,
  });
  contextRef.current = {
    language,
    questionId: selectedQuestion.id,
    onEditorSignal,
    onEditorChange,
  };
  const [runStatus, setRunStatus] = useState<RunStatus>("idle");
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("cases");
  const [selectedCase, setSelectedCase] = useState(0);

  useEffect(() => {
    if (runStatus === "success" || runStatus === "error")
      setActiveTab("result");
  }, [runStatus]);

  /**
   * Refuses pastes and drops into the editor.
   *
   * Listens in the capture phase on Monaco's container, which sees the event
   * before the hidden textarea Monaco actually pastes into. Drop is covered too:
   * dragging text in is the same act with a different gesture.
   *
   * This is a deterrent, not a barrier — devtools, a userscript, or simply
   * retyping all defeat it. That is the point rather than a shortcoming. The
   * cheat it cannot prevent gets pushed into typing, which is the one channel
   * the editor can describe in detail, and `editor.bulkInsert` still fires on
   * whatever arrives.
   */
  useEffect(() => {
    if (!editorNode || (!blockPaste && !onEditorChange)) return;

    const handle = (event: ClipboardEvent | DragEvent) => {
      // Stamped whether or not the paste is refused. The DOM event fires before
      // Monaco applies the change, which is the only ordering that lets the
      // resulting model change be attributed to a paste rather than to typing.
      lastPasteAtRef.current = Date.now();

      if (!blockPaste) return;

      event.preventDefault();
      event.stopPropagation();

      const text =
        "clipboardData" in event
          ? (event.clipboardData?.getData("text") ?? "")
          : "";

      onEditorSignal?.({ kind: "paste.blocked", chars: text.length });
      toast.error("Pasting is disabled for this interview", {
        description: "Type your solution. Your interviewer has been told.",
        id: "paste-blocked",
      });
    };

    editorNode.addEventListener("paste", handle as EventListener, true);
    editorNode.addEventListener("drop", handle as EventListener, true);

    return () => {
      editorNode.removeEventListener("paste", handle as EventListener, true);
      editorNode.removeEventListener("drop", handle as EventListener, true);
    };
  }, [editorNode, blockPaste, onEditorSignal, onEditorChange]);

  const parsedResults = useMemo<ParsedTestResult[]>(() => {
    if (!result?.stdout) return [];
    return parseTestOutput(result.stdout);
  }, [result?.stdout]);

  const summary = useMemo(() => {
    if (!parsedResults.length) return null;
    const passed = parsedResults.filter((r) => r.pass).length;
    return {
      passed,
      total: parsedResults.length,
      allPass: passed === parsedResults.length,
    };
  }, [parsedResults]);

  const currentTC = selectedQuestion.testCases[selectedCase];
  const currentRes = parsedResults[selectedCase] ?? null;
  const editorTheme = resolvedTheme === "light" ? "vs" : "vs-dark";

  /* ── handlers ─────────────────────────────────────── */

  /**
   * Reports large single insertions.
   *
   * Monaco's model-change hook is used rather than a DOM `paste` listener
   * because it is the harder signal to evade: suppressing the paste event still
   * leaves the change arriving through the model. Programmatic edits — switching
   * question or language rewrites the whole buffer — are filtered out via
   * `isFlush`, which Monaco sets for `setValue`, so only user-driven insertions
   * are reported.
   */
  const handleEditorMount: NonNullable<
    React.ComponentProps<typeof Editor>["onMount"]
  > = (editor) => {
    // Captured before the early return: paste blocking needs the DOM node even
    // when nothing is listening for signals.
    setEditorNode(editor.getDomNode() ?? null);

    editor.onDidPaste((event: { range: unknown }) => {
      const model = editor.getModel();
      if (!model) return;
      const pasted = model.getValueInRange(event.range as never) ?? "";
      contextRef.current.onEditorSignal?.({
        kind: "editor.paste",
        chars: pasted.length,
      });
    });

    editor.onDidChangeModelContent((event: any) => {
      if (event.isFlush) return;

      const { onEditorSignal: signal, onEditorChange: change } =
        contextRef.current;
      const changes: MonacoChange[] = event.changes ?? [];

      const largest = changes.reduce(
        (max, item) => Math.max(max, item.text?.length ?? 0),
        0,
      );
      if (largest > 0) signal?.({ kind: "editor.bulkInsert", chars: largest });

      if (!change) return;

      // Within this window the DOM paste event that preceded the model update is
      // still the best explanation for it. Beyond it, the same characters
      // arriving are the candidate typing.
      const viaPaste = Date.now() - lastPasteAtRef.current < PASTE_WINDOW_MS;

      for (const item of changes) {
        const inserted = item.text?.length ?? 0;
        const removed = item.rangeLength ?? 0;
        if (inserted === 0 && removed === 0) continue;

        const op =
          inserted > 0 && removed === 0
            ? "insert"
            : inserted === 0
              ? "delete"
              : "replace";

        change({
          at: Date.now(),
          op,
          offset: item.rangeOffset ?? 0,
          // What the change put into the document. For a replacement that is
          // the new text, not the net difference — the history describes what
          // was written, and a net count would report a rewrite as nothing.
          charCount: op === "delete" ? removed : inserted,
          text: op === "delete" ? undefined : item.text,
          viaPaste,
          language: contextRef.current.language,
          questionId: contextRef.current.questionId,
        });
      }
    });
  };

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
      testCases: selectedQuestion.testCases,
      javaMainBody: selectedQuestion.javaMainBody,
    });

    try {
      const res = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, code: fullCode, streamCallId }),
      });
      const data: ExecutionResult = await res.json();
      setResult(data);
      setRunStatus(data.exitCode === 0 ? "success" : "error");
      if (data.infraError || res.status === 503) {
        toast.error("Code runner unavailable", {
          description: data.stderr || "The execution backend is not reachable.",
        });
      } else if (!res.ok) {
        toast.error("Run failed", {
          description: data.stderr || `Server returned ${res.status}.`,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error.";
      setResult({
        stdout: "",
        stderr: msg,
        exitCode: 1,
        timedOut: false,
        executionMs: 0,
      });
      setRunStatus("error");
      toast.error("Run failed", { description: msg });
    }
  }, [code, language, runStatus, selectedQuestion]);

  return (
    <div
      className={cn(
        "h-full",
        masked &&
          "pointer-events-none select-none blur-[10px] transition-[filter] duration-150",
      )}
      // Hidden from assistive technology too. Blurring the pixels while leaving
      // the problem statement readable by a screen reader would hide it from
      // exactly the candidate least able to work around it.
      //
      // No `inert`: React 18 rejects it as a non-boolean attribute and drops it,
      // so it would read as protection that is not there. Keyboard focus can
      // therefore still reach controls underneath — consistent with everything
      // else here, this is a deterrent rather than a boundary, and the editor
      // itself is switched to read-only while masked.
      aria-hidden={masked || undefined}>
      <ResizablePanelGroup
        orientation="vertical"
        className="min-h-[calc(100vh-4rem-1px)]">
      <ResizablePanel defaultSize={40}>
        <ScrollArea className="h-full">
          <div className="p-6">
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h2 className="text-2xl font-semibold tracking-tight">
                    {selectedQuestion.title}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Choose your language and solve the problem
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Select
                    value={selectedQuestion.id}
                    onValueChange={handleQuestionChange}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CODING_QUESTIONS.map((q) => (
                        <SelectItem key={q.id} value={q.id}>
                          {q.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={language} onValueChange={handleLanguageChange}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue>
                        <div className="flex items-center gap-2">
                          <img
                            src={`/${language}.png`}
                            alt={language}
                            className="w-5 h-5 object-contain"
                          />
                          {LANGUAGES.find((l) => l.id === language)?.name}
                        </div>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((lang) => (
                        <SelectItem key={lang.id} value={lang.id}>
                          <div className="flex items-center gap-2">
                            <img
                              src={`/${lang.id}.png`}
                              alt={lang.name}
                              className="w-5 h-5 object-contain"
                            />
                            {lang.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Card>
                <CardHeader className="flex flex-row items-center gap-2">
                  <BookIcon className="h-5 w-5 text-primary/80" />
                  <CardTitle>Problem Description</CardTitle>
                </CardHeader>
                <CardContent className="text-sm leading-relaxed">
                  <p className="whitespace-pre-line">
                    {selectedQuestion.description}
                  </p>
                </CardContent>
              </Card>

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
                          <p className="font-medium text-sm">
                            Example {i + 1}:
                          </p>
                          <pre className="bg-muted/50 p-3 rounded-lg text-sm font-mono">
                            <div>Input: {ex.input}</div>
                            <div>Output: {ex.output}</div>
                            {ex.explanation && (
                              <div className="pt-2 text-muted-foreground">
                                Explanation: {ex.explanation}
                              </div>
                            )}
                          </pre>
                        </div>
                      ))}
                    </div>
                    <ScrollBar />
                  </ScrollArea>
                </CardContent>
              </Card>

              {selectedQuestion.constraints && (
                <Card>
                  <CardHeader className="flex flex-row items-center gap-2">
                    <AlertCircleIcon className="h-5 w-5 text-blue-500" />
                    <CardTitle>Constraints</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc list-inside space-y-1.5 text-sm marker:text-muted-foreground">
                      {selectedQuestion.constraints.map((c, i) => (
                        <li key={i} className="text-muted-foreground">
                          {c}
                        </li>
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

      <ResizablePanel defaultSize={60} minSize={35}>
        <ResizablePanelGroup orientation="vertical">
          <ResizablePanel defaultSize={60} minSize={25}>
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between border-b px-4 py-2 bg-muted/30 shrink-0">
                <span className="text-sm text-muted-foreground font-mono">
                  solution.
                  {language === "java"
                    ? "java"
                    : language === "python"
                      ? "py"
                      : "js"}
                </span>
                <Button
                  id="run-code-btn"
                  size="sm"
                  onClick={handleRunCode}
                  disabled={runStatus === "running"}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
                  {runStatus === "running" ? (
                    <Loader2Icon className="h-4 w-4 animate-spin" />
                  ) : (
                    <PlayIcon className="h-4 w-4 fill-white" />
                  )}
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
                  onMount={handleEditorMount}
                  options={{
                    // Masked means unreadable, so it should also mean
                    // uneditable — otherwise focus can stay in the editor and a
                    // candidate types blindly into code they cannot see.
                    readOnly: masked,
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

          <ResizablePanel defaultSize={40} minSize={20}>
            <div className="h-full flex flex-col bg-background overflow-y-scroll">
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
                    {tab === "result" &&
                      summary &&
                      (summary.allPass ? (
                        <CheckCircle2Icon className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <CircleXIcon className="h-3.5 w-3.5 text-red-500" />
                      ))}
                  </button>
                ))}

                {/* Right: timing */}
                <div className="ml-auto flex items-center gap-2 pr-3 text-xs text-muted-foreground">
                  {runStatus === "running" && (
                    <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
                  )}
                  {result && !result.timedOut && (
                    <span className="flex items-center gap-1">
                      <ClockIcon className="h-3 w-3" />
                      {result.executionMs} ms
                    </span>
                  )}
                  {result?.timedOut && (
                    <span className="text-red-400">Timed out</span>
                  )}
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
                        <span
                          className={cn(
                            "inline-block h-2 w-2 rounded-full",
                            res.pass ? "bg-emerald-500" : "bg-red-500",
                          )}
                        />
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
                          Press <strong>Run Code</strong> to execute your
                          solution against all test cases.
                        </p>
                      )}

                      {/* Summary banner */}
                      {summary && (
                        <div
                          className={cn(
                            "flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-semibold",
                            summary.allPass
                              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                              : "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300",
                          )}>
                          {summary.allPass ? (
                            <CheckCircle2Icon className="h-4 w-4" />
                          ) : (
                            <CircleXIcon className="h-4 w-4" />
                          )}
                          {summary.allPass
                            ? `Accepted — ${summary.passed}/${summary.total} tests passed`
                            : `Wrong Answer — ${summary.passed}/${summary.total} tests passed`}
                        </div>
                      )}

                      {/* Per-case detail */}
                      {currentRes && (
                        <div className="space-y-3">
                          <ValueBox
                            label="Input"
                            value={currentTC.inputLabel}
                          />

                          <ValueBox
                            label="Output"
                            value={
                              currentRes.error
                                ? `Error: ${currentRes.error}`
                                : (currentRes.got ??
                                  (currentRes.pass
                                    ? currentTC.expectedLabel
                                    : "—"))
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
                          <p className="text-xs font-medium text-red-400/80">
                            stderr / compile error
                          </p>
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
    </div>
  );
}

export default CodeEditor;
