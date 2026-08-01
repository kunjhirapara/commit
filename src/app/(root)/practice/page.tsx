import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon, InfoIcon } from "lucide-react";
import CodeEditor from "@/components/ui/CodeEditor";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Practice",
  description:
    "Work through coding problems on your own in a sandboxed runner — JavaScript, Python or Java, checked against real test cases.",
};

/**
 * Solo practice mode.
 *
 * CodeEditor, the question bank and /api/execute were already role-agnostic; they
 * were just unreachable outside a live Stream call. This gives every signed-in
 * user — including a brand-new candidate with no interviews — something to do.
 *
 * Intentionally absent from PROTECTED_ROUTES: no role gate, any signed-in user.
 */
export default function PracticePage() {
  return (
    <div className="container mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="text-3xl font-bold tracking-tight">Practice</h1>
          <p className="max-w-2xl text-muted-foreground">
            Pick a problem and a language, then run your solution against the
            test cases. This is the same editor used in live interviews.
          </p>
        </div>

        <Button variant="outline" asChild>
          <Link href="/" className="gap-2">
            <ArrowLeftIcon className="size-4" />
            Back home
          </Link>
        </Button>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-border/70 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        <InfoIcon className="mt-0.5 size-4 shrink-0" />
        <p>
          Your code runs in an isolated container with no network access, capped
          at 10 seconds and 128&nbsp;MB. Nothing is saved between sessions.
        </p>
      </div>

      {/* No height constraint here: CodeEditor's ResizablePanelGroup sets its own
          min-height, so boxing it in would double-scroll the editor. */}
      <div className="overflow-hidden rounded-xl border">
        <CodeEditor />
      </div>
    </div>
  );
}
