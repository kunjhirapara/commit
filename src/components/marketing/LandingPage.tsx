"use client";

import Link from "next/link";
import { SignUpButton } from "@clerk/nextjs";
import {
  CalendarClockIcon,
  ClipboardCheckIcon,
  Code2Icon,
  PlayIcon,
  ShieldCheckIcon,
  VideoIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LANGUAGES } from "@/constants";

const FEATURES = [
  {
    icon: VideoIcon,
    title: "Live video rooms",
    description:
      "HD calls with device checks before you join, host controls, and recording with an upfront disclosure.",
  },
  {
    icon: Code2Icon,
    title: "Shared code editor",
    description:
      "A Monaco editor sits beside the call, so you can watch someone think instead of reading a screen share.",
  },
  {
    icon: PlayIcon,
    title: "Sandboxed runner",
    description:
      "Run JavaScript, Python and Java against real test cases. Every run is an isolated container with no network.",
  },
  {
    icon: ClipboardCheckIcon,
    title: "Structured scorecards",
    description:
      "Weighted competencies, private notes, and feedback hidden until you submit your own.",
  },
  {
    icon: CalendarClockIcon,
    title: "Scheduling that holds up",
    description:
      "Timezone-aware slots, reschedules, reminders, and a calendar view of everything upcoming.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Role-based access",
    description:
      "Candidates, interviewers, recruiters and admins each see only their own slice of the data.",
  },
];

const STEPS = [
  {
    title: "Sign up",
    description:
      "You start as a candidate. No approval step, no waiting on anyone.",
  },
  {
    title: "Open the practice sandbox",
    description:
      "Pick a problem, pick a language, and run it against the test cases straight away.",
  },
  {
    title: "Get invited to interviews",
    description:
      "Interviewers schedule rounds with you; they land on your home page and calendar.",
  },
];

export default function LandingPage() {
  return (
    <div className="mx-auto w-full max-w-6xl">
      {/* Hero */}
      <section className="flex flex-col items-center gap-6 pb-20 pt-10 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-4 py-1.5 text-xs font-medium text-muted-foreground">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60" />
            <span className="relative inline-flex size-2 rounded-full bg-primary" />
          </span>
          Open to the public — free to try
        </span>

        <h1 className="max-w-3xl text-balance text-4xl font-bold tracking-tight sm:text-6xl">
          Technical interviews with a{" "}
          <span className="text-primary">live code editor</span>
        </h1>

        <p className="max-w-2xl text-balance text-lg text-muted-foreground">
          Commit puts video, a shared editor and a sandboxed code runner in one
          room — then gives you structured scorecards for the debrief. Sign up
          and try the practice sandbox on your own, no interview needed.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row">
          <SignUpButton mode="modal">
            <Button size="lg" className="gap-2">
              <PlayIcon className="size-4" />
              Try the practice sandbox
            </Button>
          </SignUpButton>
          <Button size="lg" variant="outline" asChild>
            <Link href="#how-it-works">See how it works</Link>
          </Button>
        </div>

        <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
          <span>Runs</span>
          {LANGUAGES.map((language) => (
            <span key={language.id} className="font-mono text-foreground">
              {language.name}
            </span>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="pb-20">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;

            return (
              <Card key={feature.title} className="h-full">
                <CardContent className="space-y-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <h2 className="font-semibold">{feature.title}</h2>
                  <p className="text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-24 pb-20">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          How it works
        </h2>

        <ol className="mt-8 grid gap-6 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="relative">
              <div className="flex size-9 items-center justify-center rounded-full border border-border bg-muted/50 font-mono text-sm font-semibold">
                {index + 1}
              </div>
              <h3 className="mt-4 font-semibold">{step.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {step.description}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* Closing CTA */}
      <section className="mb-20 rounded-2xl border border-border/70 bg-muted/30 px-6 py-12 text-center sm:px-12">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Have a go at a problem
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Three problems, three languages, real test cases. It runs in a locked
          down container, so nothing you write can reach the network.
        </p>
        <SignUpButton mode="modal">
          <Button size="lg" className="mt-6">
            Create a free account
          </Button>
        </SignUpButton>
      </section>
    </div>
  );
}
