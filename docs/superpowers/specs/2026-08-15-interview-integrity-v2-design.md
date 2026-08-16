# Interview integrity v2 — prevention, authorship telemetry, and analytics

**Date:** 2026-08-15
**Status:** Design drafted, awaiting review
**Supersedes nothing.** Extends
`docs/superpowers/specs/2026-08-01-interview-proctoring-design.md`, which is
implemented and shipped. Read that first; this document assumes it.

---

## Why this exists

v1 monitors an interview silently: it records browser signals, never interrupts
the candidate, and hands the interviewer a report. It works, and everything it
claims about itself is true.

It is also blind to the way people actually cheat now.

An analysis of 19,368 interviews published in 2026 found 38.5% of candidates
exhibiting cheating behaviour, rising to 48% among technical candidates.
Dedicated invisible assistants — Cluely, Interview Coder, Final Round AI —
accounted for roughly 45% of detected cases, and LLM voice mode for another 34%.
These tools render an answer as an overlay that the candidate reads and types
out. They produce **no tab switch, no window blur, no paste event, and no
focus loss.** Every signal Commit records today would show a spotless session.

So the honest summary of v1 is: it catches the careless, and reports the
determined as clean. That gap is what this design addresses — not by pretending
a browser can see a desktop overlay, but by changing which paths are available
and instrumenting the one path that remains.

### The central idea

Prevention and detection are usually presented as alternatives. Here they
compose, and the composition is the whole argument:

> Blocking paste does not stop a candidate from using an AI assistant. It forces
> them to **type** the answer instead of pasting it — and typing is the one
> channel this application can observe in detail.

A blocked paste is not a defeated cheat. It is a cheat pushed out of a blind
spot and into the field of view of a detector. Every prevention below is chosen
on that basis: does it narrow the attack surface *into* something we can
measure? Measures that merely inconvenience honest candidates without redirecting
dishonest ones are rejected, and several are named explicitly in
[Deliberately not built](#12-deliberately-not-built).

### Decisions taken

Confirmed with the owner before this design was written:

| Question | Decision |
| --- | --- |
| Enforcement posture | **Deterrent mode, as a per-interview toggle.** Visible rules, never auto-fail. Off by default. |
| AI-assistant detection | **Full authorship telemetry plus replay.** Edit history, not keystroke biometrics. |
| Analytics reach | **All four surfaces**: richer per-interview report, per-candidate profile, org-wide dashboard, live in-call alerts. |
| Screen sharing | **Interviewer-requested mid-call**, not required to join. |
| Composite score | **No.** Bands and concrete measures, as in v1. |
| Compliance depth | **Portfolio-grade.** Real engineering, honest UI copy, no DPIA or appeals machinery. |
| Document scope | **Integrity v2 only.** The broader `production-readiness.md` backlog gets its own plan. |

The v1 principles carry forward unchanged and are not reopened here: candidate
only, never the interviewer; write-only for the candidate; server-authoritative
time; no webcam; no auto-fail; signals are evidence, not proof.

---

## 1. Integrity modes

Everything visible in this design hangs off one per-interview setting.

```ts
// convex/schema.ts — interviews
integrityMode: v.optional(
  v.union(v.literal("off"), v.literal("observe"), v.literal("deterrent")),
),
```

| Mode | Candidate sees | Recorded |
| --- | --- | --- |
| `off` | Nothing. No disclosure gate. | Nothing. No session row is created. |
| `observe` | The v1 disclosure gate. Nothing during the call. | Everything v1 records, plus authorship telemetry. |
| `deterrent` | A rules screen before joining, a fullscreen requirement, a masking overlay if they leave it, and a blocked-paste message. | Everything in `observe`, plus enforcement events. |

`observe` is the default when the field is absent, so **every existing interview
keeps behaving exactly as it does today** and no migration is required.

`off` matters more than it looks. A culture-fit round or a debrief has nothing
to cheat at, and monitoring it produces noise that dilutes the signal in rounds
that matter. Offering a real way to turn it off is what keeps the feature from
becoming ambient surveillance.

**The mode is copied onto the `proctoringSessions` row when the session opens.**
Without this, a clean report from `observe` is indistinguishable from a clean
report from `deterrent`, and the two mean completely different things. Every
report header states the mode that was in force.

**The mode cannot change once the interview is live.** Changing the rules
mid-session would make the report describe a set of conditions that never
existed as a whole. Pre-interview changes are appended to the interview's
existing `lifecycleEvents` array with the actor, so the change is attributable.

**Where it is set.** At schedule time in the existing scheduling modal, editable
afterwards by anyone holding `editInterviews`, and defaultable per
`templateId` — a "final technical round" template can ship with `deterrent`
while "intro call" ships with `off`.

**Rollout.** Gated behind a new `integrityDeterrentMode` entry in
`FEATURE_FLAG_DEFAULTS` (`src/lib/featureFlags.ts`), defaulting off, so
enforcement can be dark-launched and switched on per deployment without a
redeploy of the schema.

---

## 2. Deterrent mode: what is actually enforced

### 2.1 Fullscreen

**At join.** In `deterrent` mode the existing optional "start in fullscreen"
switch in `ProctoringDisclosure` becomes a requirement, with copy explaining
why. The request still has to happen inside the click handler that starts the
join — browsers will not grant fullscreen outside a user gesture, and
`MeetingSetup` already does this correctly today.

If the request is refused by the browser, the candidate is not blocked from
being interviewed. They are dropped straight into the exemption path below,
with the reason recorded as `browser-refused`. An integrity feature must never
be the reason someone cannot attend their interview.

**On exit.** `fullscreenchange` firing with no `document.fullscreenElement`:

1. `fullscreen.exited` is recorded (this already exists in v1).
2. A blocking overlay appears: what the rule is, why it exists, and a **Return
   to fullscreen** button. The button is required because the page cannot
   re-enter fullscreen programmatically — that too needs a gesture.
3. **The interview content is masked.** The problem statement and the code
   editor are blurred and made inert beneath the overlay.
4. The interviewer's live panel updates immediately and an alert fires.

Masking is the part that does real work. A candidate who leaves fullscreen to
read the problem on a second screen finds the problem is no longer on the
screen they left. A warning banner would not have achieved that.

**Implementation.** `CodeEditor` gains a `masked?: boolean` prop. When true it
applies `filter: blur(10px)`, `pointer-events: none`, `user-select: none` and
`aria-hidden="true"` to the problem and editor panels, and the overlay above it
holds focus. `CodeEditor` stays unaware of proctoring — it is told to mask, not
told why — which preserves the separation that already keeps `/practice`
entirely unmonitored.

Blur is a visual barrier, not a security boundary: the text remains in the DOM
and anyone with devtools can read it. That is fine and should be stated in the
spec rather than discovered later. The purpose is to remove the *effortless*
path, and someone in devtools has already left the population this measure
targets.

**Duration is the measure, not the count.** A `content.masked` event opens when
masking engages and closes when it lifts, carrying `durationMs` — the same
interval-not-edges pattern v1 already uses for absences. "Content was hidden for
four minutes" is a fact an interviewer can weigh. "Left fullscreen three times"
is not.

### 2.2 The exemption path

The overlay carries a second, quieter button: **I can't use fullscreen.**

This is not a loophole, it is a requirement. Screen magnifiers, some screen
readers, tiling window managers, and anyone working across two windows for
legitimate accessibility reasons are all genuinely broken by a hard fullscreen
rule. A rule with no escape hatch does not produce compliance, it produces
candidates who cannot participate.

Taking it opens a short form (a free-text reason, optional). On submit:

- `fullscreen.exempted` is recorded with the reason.
- `proctoringSessions.fullscreenExemptedAt` and
  `fullscreenExemptionReason` are set.
- Masking stops for the rest of the session; the mode degrades to warn-only.
- The interviewer is alerted immediately, not silently.
- **The report states the exemption, when it was taken, and the reason given.**

The last point is what makes this safe to offer. The exemption is not hidden and
it is not free — it is on the record, and an interviewer can ask about it. That
is a far better outcome than either blocking the candidate or letting the rule
be silently disabled.

### 2.3 Paste blocking

In `deterrent` mode, pasting into the code editor is rejected with an inline
message: *"Pasting is disabled for this interview. Type your solution."*
A `paste.blocked` event records the character count that was rejected.

Interception is a capture-phase `paste` listener on the Monaco container with
`preventDefault()`, covering `Ctrl/Cmd+V` and `Shift+Insert`. Monaco routes
paste through a hidden textarea, so the container listener sees it before the
editor model does.

**What is deliberately not blocked:**

- **Copy.** A candidate copying their own code out harms nobody, and blocking it
  is pure hostility.
- **Selecting or copying the problem statement.** Same reasoning.
- **Middle-click paste on Linux.** A known gap; `auxclick` handling is
  unreliable across window managers and the bypass is recorded by bulk-insert
  detection anyway.

**`editor.bulkInsert` detection stays on regardless**, exactly as in v1. Paste
blocking is trivially bypassed — devtools, a userscript, retyping — and the
model-level change detector catches the result either way. Blocking is the
deterrent; bulk-insert detection is the backstop; authorship telemetry is what
sees the path blocking leaves open.

---

## 3. Authorship telemetry

The largest new component, and the only one that touches the dominant cheat
vector.

### 3.1 What is captured, and the line that is not crossed

We capture **the document's edit history** — how the solution came to exist.
We do not capture a keystroke biometric template.

That distinction is doing real work and is deliberate. Keystroke biometrics
identify or authenticate a person from their typing rhythm, which is GDPR
Article 9 special-category data and is exactly why v1 excluded it. An edit
history is a property of the document, of the same family as a version control
history, and identifies nobody.

The line is enforced mechanically, not by intention:

> **Raw inter-keystroke timings are computed in the browser, reduced to summary
> statistics, and discarded. Only the statistics are transmitted.** A mean and a
> standard deviation cannot be inverted into an identification template.

Any future change that transmits the raw timing vector reopens the Article 9
question and must be treated as a new design decision, not a refactor. This
sentence exists so that whoever considers it finds the reason already written
down.

### 3.2 Coalescing

Naively, one row per keystroke means several thousand Convex writes per
interview. That is unacceptable on a metered deployment and would dwarf the
event volume v1 was already careful about.

The client coalesces changes into **segments**. A segment closes when any of:

- idle for longer than `SEGMENT_IDLE_MS` (2,000 ms)
- the edit position jumps non-contiguously
- the operation flips between insert and delete
- the segment reaches `MAX_SEGMENT_CHARS` (500)

Each closed segment carries:

| Field | Meaning |
| --- | --- |
| `tOffsetMs` | Start, relative to session start. Server-anchored via the offset established when the session opened. |
| `op` | `"insert"` \| `"delete"` \| `"replace"` |
| `charCount` | Characters added or removed |
| `keystrokeCount` | Discrete change events in the segment |
| `backspaceCount` | Deletions of one character |
| `durationMs` | Wall time from first to last change |
| `meanInterKeyMs`, `stdDevInterKeyMs` | Cadence summary. **The raw vector never leaves the browser.** |
| `text` | Inserted text, capped at `MAX_SEGMENT_TEXT` (2,000 chars). Inserts only; deletes need only a length. |
| `viaPaste` | Whether the segment originated in a paste event |
| `language`, `questionId` | Which problem and language this belonged to |

A 45-minute session yields roughly 100–400 segments. Batched at 50 segments per
row, that is **under a dozen rows per interview** — comparable to the existing
event volume rather than a new order of magnitude.

Storing the inserted text is not new exposure: the code is already visible to
the interviewer in the live call, and the replay is worthless without it.

### 3.3 Schema

```ts
proctoringAuthorship: defineTable({
  interviewId: v.id("interviews"),
  streamCallId: v.string(),
  candidateClerkId: v.string(),
  /** Batch ordering. Server-assigned so a client cannot reorder its own history. */
  sequence: v.number(),
  recordedAt: v.number(),
  segments: v.array(
    v.object({
      tOffsetMs: v.number(),
      op: v.string(),
      charCount: v.number(),
      keystrokeCount: v.number(),
      backspaceCount: v.number(),
      durationMs: v.number(),
      meanInterKeyMs: v.number(),
      stdDevInterKeyMs: v.number(),
      text: v.optional(v.string()),
      viaPaste: v.boolean(),
      language: v.string(),
      questionId: v.string(),
    }),
  ),
})
  .index("by_interview", ["interviewId"])
  .index("by_interview_sequence", ["interviewId", "sequence"])
  .index("by_created_at", ["recordedAt"]),
```

Capped at `MAX_AUTHORSHIP_SEGMENTS_PER_SESSION` (3,000), using the same durable
counter on the session row that v1 uses for events — the in-memory limiter in
`src/lib/rateLimit.ts` cannot bound anything across Convex isolates, as the
existing code already notes. Hitting the cap is recorded, not silent.

Retention: 90 days, added to `pruneExpiredRecords` in `convex/metrics.ts`
alongside `proctoringEvents`, keyed on `recordedAt`.

### 3.4 The detectors

Pure functions in `src/lib/proctoring/authorship.ts`, unit tested, with the
thresholds living in `thresholds.ts` next to the existing ones so the UI can
render the rule it actually applied.

| Detector | Fires when | Tier | Why it earns its place |
| --- | --- | --- | --- |
| `typing.transcription` | An insert segment over 150 chars with `stdDevInterKeyMs / meanInterKeyMs` below 0.35 and a backspace rate under 2% | A | Transcribing from an overlay is metronomic. Original composition is not — it stutters, pauses, and corrects. |
| `typing.burstAfterIdle` | Silence over 20 s followed within 2 s by a segment over 200 chars with a backspace rate under 2% | A | The signature of reading an answer, then typing it out. |
| `typing.impossibleSpeed` | Sustained throughput above 900 chars/min over a segment of at least 200 chars | A | A fast typist reaches ~600 cpm. 900 is deliberately generous. |
| `edit.noRefinement` | Session-level: final solution over 400 chars with total deletions under 5% of total insertions | A | Real coding is iterative. A solution that arrives correct and is never revised was composed somewhere else. |
| `paste.blocked` | Deterrent mode, paste rejected | A | Direct evidence of intent, though not of success. |
| `window.blurBeforeBurst` | Focus loss followed within 5 s by an insert over 200 chars | B | Correlational and easily coincidental. Timeline only. |

Every threshold is a starting guess, exactly as v1's were, and §6.3 describes
the feedback loop built to replace guesses with data.

### 3.5 Replay

`src/components/interviews/AuthorshipReplay.tsx` — a scrubber that reconstructs
the buffer at any point in the session by applying segments in sequence, shown
read-only with a timeline beneath marking events and flagged segments. Clicking a
flag jumps to it. Playback runs at 1×, 4×, or 16×.

Replay granularity is segment-level, not keystroke-level, and the UI says so:
*"Reconstructed from edit history — not a recording."* An interviewer who
believes they are watching a video will over-trust the gaps.

This component is the point of the whole section. A flag says "this looks like
transcription"; the replay lets a human decide whether it does, in about fifteen
seconds. Detection without a way to check the detection is just an accusation
with extra steps.

### 3.6 Honest limits

These belong in the spec and in the UI, not in a footnote:

- Published accuracy for keystroke-based approaches sits between **75% and 86%
  in controlled conditions**. Ours is coarser — statistics rather than raw
  timings — so assume less.
- A slow, deliberate typist copying from **their own legitimate notes** is
  indistinguishable from one copying from an overlay. This detector cannot tell
  the difference and must never claim to.
- Someone using a **second physical device** produces a flawless authorship
  record. No browser-based scheme reaches them.
- The most reliable detector available is **a human asking the candidate to
  explain and modify their own code**, which is why the report generates probe
  suggestions rather than verdicts.

---

## 4. Live in-call alerts

`IntegrityReport` already renders inside `MeetingRoom` for interviewers, driven
by a reactive Convex query, so live updates cost nothing extra.

Added on top: a `useIntegrityAlerts` hook that watches the same query and raises
a `sonner` toast when a new Tier A event arrives while the call is live. Each
toast states the signal in plain words and offers a probe:

> **Large block typed after a 40-second pause.**
> Consider asking the candidate to walk through what they just wrote.

Three constraints keep this useful rather than corrosive:

1. **Rate-limited to one toast per 60 seconds**, aggregating the remainder
   ("3 further signals"). An interviewer buried in toasts stops reading them,
   which is worse than no alerts.
2. **Interviewers only.** Never the candidate, in any mode. Deterrent mode tells
   the candidate the rules up front; it does not narrate their score back to
   them mid-interview.
3. **Suppressible for the session** with one click, because an interviewer
   mid-question should be able to silence the tooling.

---

## 5. Interviewer-requested screen share

Not required to join. A button in the interviewer's panel: **Request screen
share.**

Flow:

1. The interviewer clicks; a `proctoringRequests` row is written.
2. The candidate's client, watching that row, shows a modal explaining what is
   being asked and by whom, with **Share** and **Decline**.
3. On accept: `getDisplayMedia({ video: { displaySurface: "monitor" } })`, then
   `track.getSettings().displaySurface` is validated. A tab or window instead of
   a monitor is re-requested once, then recorded as `screenshare.partial`.
4. The track is published through the existing Stream call — the video SDK
   already supports screen sharing, so no new transport is introduced.
5. Declining records `screenshare.declined` and is shown on the report. **It is
   never punished automatically**, and the report says so next to it.

Not recorded or persisted; the interviewer sees it live only. Recording it would
pull in retention, storage, and disclosure questions disproportionate to a
portfolio-scope build.

**What this is and is not.** Overlay assistants are explicitly engineered to be
invisible to `getDisplayMedia`, so this does not catch the main threat. Its real
value is reliable monitor enumeration, seeing a second window in use, and the
deterrent effect of the request being available at all. The UI states this
rather than implying screen share is proof of anything.

---

## 6. Analytics

### 6.1 Per-interview report, v2

`IntegrityReport` grows from a summary card into the primary artefact.

- **Header** — band, the mode that was in force, and the caveats that change how
  a clean result should be read (display check unsupported, fullscreen exempted,
  monitoring never started).
- **Measures** — the v1 grid plus: time content was masked, blocked pastes,
  characters typed vs pasted vs deleted, mean typing cadence, authorship flags.
- **Timeline** — a horizontal session track combining events and authorship
  segments, zoomable, with flags marked.
- **Replay** — embedded, §3.5.
- **Suggested probes** — generated from the flags that fired. This turns the
  report from a judgement into an interview aid, which is the correct role for
  it.
- **Export** — JSON, plus a print stylesheet for the hiring file. No PDF
  dependency.

### 6.2 Per-candidate profile

Extends the existing `CandidateIntegrityHistory` on the team page. Admin and
recruiter only, unchanged from v1.

Per-interview rows showing band, mode, and flags — **never a running total and
never an aggregate verdict.** A standing banner states the reason:

> Patterns across interviews are context, not evidence. These signals carry a
> real false-positive rate, and a flag in one interview says nothing about
> another.

v1 named this fairness risk and the same reasoning applies with more force now
that there are more detectors to be wrong.

### 6.3 Org-wide integrity dashboard

New page at `/dashboard/integrity`, behind a new `viewIntegrityAnalytics`
permission added to `PERMISSION_VALUES` in `convex/lib/permissions.ts` and
granted to **recruiter and admin**. Interviewers are excluded: they see the
interviews they run, not the population.

Panels:

- **Band distribution over time** — is the population drifting, or did a
  threshold change?
- **Flag frequency by detector** — which detectors actually fire. A detector
  that never fires is dead weight; one that fires on everything is broken.
- **Mode adoption** — how many interviews run `off`, `observe`, `deterrent`.
- **Detector health** — sessions where the display check was unsupported,
  sessions with no monitoring at all, throttled sessions, heartbeat gaps. This is
  the panel that reveals the feature quietly breaking.
- **Explained-rate per detector** — see below.

**The false-positive feedback loop.** On any report, a reviewer can mark a flag
as *explained* or *concerning*, with a note:

```ts
proctoringFlagReviews: defineTable({
  interviewId: v.id("interviews"),
  flagKind: v.string(),
  reviewerClerkId: v.string(),
  verdict: v.union(v.literal("explained"), v.literal("concerning")),
  note: v.optional(v.string()),
  reviewedAt: v.number(),
}).index("by_interview", ["interviewId"])
  .index("by_flag_kind", ["flagKind"]),
```

The dashboard shows the explained-rate per detector. A detector explained away
80% of the time is producing noise and its threshold needs moving — and now
there is evidence for which way.

v1 said its thresholds "should be revisited once there is real data." This is
the mechanism that produces the data. Without it, the numbers stay guesses
forever and nobody can tell.

**Aggregation.** Read-time aggregation over a bounded window (90 days, capped
`.take()`), using the existing `by_created_at` indexes. If volume ever makes
that too slow, the answer is a materialised daily rollup written by the existing
cron — noted here so it is a known next step rather than a rediscovery.

**No composite score anywhere**, per the decision above. Dashboards rank and
chart by band and by individual measures. A 0–100 number would get someone
rejected on "73" without anyone reading why, and given a detection ceiling in
the low 80s at best, it would be dressing uncertainty up as precision.

---

## 7. Disclosure

The v1 disclosure gate describes what is *recorded*. Deterrent mode also
constrains what the candidate may *do*, and a gate that omits the rules it is
about to enforce is not disclosure.

Two variants, keyed off the mode and defined immediately next to the mode
constant so they cannot drift apart:

- **`observe`** — v1's text, plus one sentence on edit history being recorded.
- **`deterrent`** — the above, plus: fullscreen is required; leaving it hides
  the problem and editor until you return; pasting into the editor is disabled;
  the interviewer may ask you to share your screen; and how to get an exemption
  if fullscreen does not work for you.

Acknowledgement remains required to join, as today. In `off` mode no gate is
shown at all, because there is nothing to disclose.

---

## 8. Authorization

Unchanged in shape from v1; the new surfaces slot into the existing gates.

| Path | Rule |
| --- | --- |
| Write events, authorship, heartbeat | Candidate only, own interview. Derived from the verified token. Append-only. |
| Read report and replay | `requireInterviewReviewAccess` — excludes candidates, covers the interviewer on the interview plus recruiter and admin. |
| Candidate history | Admin and recruiter only. |
| Org dashboard | New `viewIntegrityAnalytics` permission. |
| Request screen share | Interviewer on that interview only. |
| Write flag review | Anyone who can read the report. |

The v1 invariant holds throughout: **the candidate writes but never reads.**
Reading their own signals back would let them probe for thresholds.

---

## 9. Volume and cost

Authorship telemetry is the new cost driver, and the mitigation is coalescing
rather than throttling after the fact.

| | Naive | This design |
| --- | --- | --- |
| Rows per 45-min session | ~5,000 (one per keystroke) | ~8–60 (batched segments) |
| Mutations per session | thousands | tens |

Reused from v1 without change: batching on a flush interval, `sendBeacon` on
`pagehide`, durable per-session counters as the rate limit, recording the fact
that a cap was hit, and 90-day retention on the existing cron.

---

## 10. Phasing

Stoppable after any phase; each is independently useful and independently
shippable.

1. **Modes and disclosure** — `integrityMode` on interviews and on the session
   row, mode-aware disclosure copy, the schedule-time toggle, the feature flag.
   No behaviour change for existing interviews.
2. **Deterrent enforcement** — fullscreen requirement, masking overlay,
   exemption path, paste blocking, the new events.
3. **Authorship capture** — segment coalescer, `proctoringAuthorship`, the batch
   mutation, caps and retention. No UI; verified end to end with a synthetic
   session, as v1's phase 1 was.
4. **Detectors and replay** — the pure functions with tests, the replay
   component, report v2.
5. **Live alerts and screen-share request.**
6. **Dashboard and flag reviews.**

Phases 1–2 deliver the prevention half. Phases 3–4 deliver the detection half.
Neither is worth much alone, which is why they are adjacent rather than split
across the plan.

---

## 11. Verification

`npm run ci:validate` after every phase, matching the existing convention.

**Unit tests** (`node --test`, `src/**/*.test.ts`, following the existing
`rateLimit.test.ts` and `severity.test.ts`):

- Segment coalescer — boundary conditions on idle, position jump, op flip, and
  max length.
- Each detector, at and either side of its threshold.
- Severity v2 banding with the new inputs.
- Mode → disclosure copy mapping.
- **Replay reconstruction** — segments applied in sequence produce the expected
  buffer at time *t*. This is the most important test in the set: if
  reconstruction is wrong, the interviewer is reading fiction and has no way to
  tell.

**Manual, two accounts, deterrent mode:**

- Exit fullscreen → masking engages, event recorded, interviewer alerted, and a
  `durationMs` appears when it lifts.
- Take the exemption → masking stops, reason recorded, interviewer alerted,
  report states it.
- Paste → blocked, `paste.blocked` recorded, bulk-insert backstop still fires if
  the block is bypassed via devtools.
- Type 300 characters at deliberate even cadence → `typing.transcription` fires.
- Type 300 characters naturally with corrections → it does **not** fire. The
  negative case is the one that matters; a detector that fires on honest work is
  worse than none.
- Request screen share → candidate prompted, decline recorded and visibly not
  punished.

**Regression, and non-negotiable:**

- `observe` mode behaves **exactly** as today — no overlay, no blocking, no
  candidate-visible change.
- `off` mode writes nothing at all: no session row, no events, no disclosure.
- `/practice` remains entirely unmonitored, as v1 requires.
- Firefox still reports the display check as `unsupported` rather than showing a
  clean result.

---

## 12. Deliberately not built

Carried forward from v1 and still excluded: webcam, face or gaze analysis,
screen recording of the desktop, DevTools detection, clipboard reading,
keystroke biometrics, auto-fail, and any proctoring in `/practice`.

Newly considered and rejected:

- **Process-level monitoring.** This is what actually detects Cluely and
  Interview Coder, and it requires an installed desktop agent. A web application
  cannot do it, and no combination of browser APIs approximates it. Named here
  so nobody concludes the browser signals cover this ground.
- **Blocking copy, right-click, or text selection.** Hostile to honest
  candidates, breaks assistive technology, and redirects no cheat into view.
  Fails the composition test in the opening section.
- **Mandatory screen share.** Rejected during design: overlay tools evade screen
  capture by construction, so the cost buys deterrence already obtained more
  cheaply elsewhere.
- **A composite risk score.** §6.3.
- **MOSS-style similarity scoring against a corpus.** Genuinely valuable and
  genuinely a separate project — it needs a solution corpus, a similarity
  pipeline, and its own false-positive policy.
- **Audio analysis of the candidate speaking.** Reintroduces biometrics.

---

## 13. What this does not solve

Stated plainly here because every screen in the feature will repeat a version of
it:

A candidate with a phone, a second laptop, or an invisible desktop overlay
produces a **clean report under every mode in this design.** Nothing here
changes that, and no browser-based scheme can.

What this design does is narrow the cheap paths, raise the cost of the rest, and
instrument the one channel that remains observable — while being explicit,
everywhere it surfaces, about the size of the gap that is left. A tool that
overstates its reach does more damage than one that admits its limits, because
someone will act on the overstatement in a hiring decision.

The strongest integrity control available to this platform is still an
interviewer having a real conversation about the code. Everything above exists
to tell them where to point that conversation.

---

## Sources

Research consulted while writing this design:

- [State of AI interview cheating in 2026 — 19,368 interviews analysed](https://fabrichq.ai/blogs/state-of-ai-interview-cheating-in-2026-insights-from-19-368-interviews)
- [Interview cheating in 2026: Cluely, Interview Coder](https://fabrichq.ai/blogs/interview-cheating-in-2026-the-rise-of-ai-tools-like-cluely-and-interview-coder)
- [Detecting invisible interview assistants](https://fabrichq.ai/blogs/how-to-detect-interview-coder-detecting-invisible-interview-assistants)
- [HackerRank plagiarism detection](https://www.hackerrank.com/features/plagiarism-detection)
- [How companies detect AI-assisted interview cheating](https://incruiter.com/blog/how-companies-detect-ai-assisted-interview-cheating/)
- [AI proctoring ethics: privacy and EU AI Act risks](https://fluxhuman.com/en/blog/ai-proctoring-ethics-privacy-eu-ai-act-risks)
- [Beyond keystroke biometrics: privacy-first alternatives](https://www.proctorsafe.eu/articles/beyond-keystroke-biometrics-privacy-first-alternatives-remote-exam-authentication)
- [EU AI Act regulatory framework](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai)
