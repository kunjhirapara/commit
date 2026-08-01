# Interview integrity monitoring

**Date:** 2026-08-01
**Status:** Design approved, not yet implemented

## Context

Commit runs live technical interviews with a shared Monaco editor and a sandboxed
runner. Nothing currently observes whether the candidate is doing the work
themselves. Interviewers see a video tile and a code buffer; a candidate reading
a solution on a second monitor, or pasting from another tab, is invisible.

This adds monitoring of a small set of browser signals during an interview, an
integrity report the interviewer can read during and after the call, and a
per-candidate history for recruiters and admins.

## Decisions taken

Confirmed with the owner before design:

- **Silent logging, no in-call intervention.** Signals are recorded; the
  candidate is not warned, blocked, or interrupted when one fires.
- **No webcam analysis.** No face presence, face count, or gaze. Browser signals
  only, so no biometric data and no GDPR Article 9 special-category processing.
- **Disclosure before the interview, nothing during.** The candidate is told what
  is monitored before they join and sees none of it afterwards.
- **Multi-monitor detection is in scope**, added at the owner's request.

The combination of "silent" and "disclosure" is deliberate and matters: this is
**disclosed but non-interruptive** monitoring, not covert monitoring. The
pre-join disclosure is what makes it defensible, so it is a hard requirement of
this design rather than a nicety. Shipping the detectors without the disclosure
gate would change the character of the feature.

## Trust model

Everything here is client-reported, and the candidate controls the browser.
State this plainly in the UI as well as the code, because a report that looks
authoritative will be treated as authoritative.

- **Signals are evidence, not proof.** A tab switch might be a notification.
- **Absence of events is not absence of cheating.** Anyone willing to use a
  second device defeats all of this, and no browser-based scheme can see it.
- **Nothing decides automatically.** No auto-fail, no auto-flag that blocks a
  hire. A human reads the report.

Two design consequences follow.

**Heartbeat.** The monitor emits a heartbeat every 30s while the call is live. A
gap in heartbeats while the Stream call is still connected is itself recorded as
an event. Without this, disabling JavaScript or blocking the mutation produces a
*clean* report — the best possible outcome for a cheat. With it, tampering looks
like tampering.

**Clock skew.** Events carry both a client timestamp and the server's
`Date.now()`. Ordering and durations always use the server value. A client clock
that disagrees by more than a few seconds is recorded as skew, since a forged
clock is itself a signal.

## Scope: the candidate only

Proctoring events are recorded only when
`interview.candidateId === currentUser.clerkId`.

Interviewers switch away constantly — notes, the scorecard, the candidate's CV.
Recording them would bury the signal in noise and would amount to surveilling
staff. The client checks this before starting any detector, and the server
rejects proctoring writes from a non-candidate for that interview.

## Signals

### Tier A — recorded and surfaced

| Signal | Source | Why it earns its place |
| --- | --- | --- |
| Tab hidden | `document.visibilitychange` | The candidate switched tabs. Duration matters far more than count. |
| Window unfocused | `window` `blur` / `focus` | Switched to another application. Catches what `visibilitychange` misses. |
| Fullscreen exited | `fullscreenchange` | Only meaningful if the session started fullscreen; see below. |
| Editor paste | `paste` on the Monaco DOM node | Character count and whether it landed in the editor. |
| Bulk insert | Monaco `onDidChangeModelContent` | A single change above 120 characters. **The most important signal here** — it catches pasted code even when the DOM paste event is suppressed, and it is specific to a coding interview rather than generic proctoring. |
| Extended display | `screen.isExtended` | See the dedicated section below. |
| Monitor gap | Missing heartbeat | Reporting stopped while the call was live. |

### Tier B — recorded, weighted low, shown only in the detailed timeline

Window geometry change, page reload mid-call, and input idle while the call is
live. These have benign explanations often enough that they should never drive a
conclusion on their own.

### Deliberately excluded

- **DevTools detection.** Every technique is a heuristic — window dimension
  deltas, `debugger` timing, `console.log` getter tricks. All produce false
  positives on ordinary window resizes and docked panels, all are trivially
  bypassed, and a false accusation here is far more costly than a miss.
- **Clipboard reading.** Not detectable. `navigator.clipboard.readText()` is the
  *page's* read, not the user's.
- **Keystroke biometrics / typing cadence.** Behavioural biometrics, which
  reintroduces exactly the special-category data problem the webcam decision
  avoided.
- **Screen recording or screenshots of the candidate's desktop.** Disproportionate.

## Multi-monitor detection

Two APIs are involved and they behave differently. The distinction drives the
design.

**`screen.isExtended`** returns a boolean and requires **no permission prompt**,
which is what makes it usable under a silent-monitoring policy. It needs a secure
context; the deployment is HTTPS, so that is satisfied.

**`window.getScreenDetails()`** returns per-screen detail but requires the
`window-management` permission, which prompts. A prompt contradicts silent
operation and a denial is uninformative. Not used.

Three practical problems, each of which must be handled or the signal is worse
than useless:

**1. A Permissions-Policy silently disables it.** Per MDN, if a
`window-management` Permissions-Policy blocks the API, `isExtended` returns
`false` — not an error. `next.config.mjs` currently sets `Permissions-Policy` on
`/meeting/*` without naming `window-management`, so it defaults to allowed today.
That is fragile: a later tightening of that header would turn the signal off in
the **false-negative** direction, reporting every candidate as single-screen, and
nothing would surface the change. The header must therefore name
`window-management=(self)` explicitly on `/meeting/*`, and the value must be
treated as load-bearing rather than boilerplate.

**2. Browser support is partial.** The API is Chromium-only; Firefox and Safari
return `undefined`. Recording that as `false` would mean a Safari user with three
monitors looks identical to an honest Chrome user with one — and the interviewer
could not tell which they were reading. The stored value is therefore a
three-state `"extended" | "single" | "unsupported"`, and the report says
"unsupported on this browser" rather than showing a clean result. **A missing
signal must never render as a passed check.**

**3. It changes mid-interview.** A monitor plugged in after joining is more
interesting than one present at the start. Sampled at join and on the `change`
event, with transitions recorded.

**Cross-browser fallback.** Because Tier A coverage is Chromium-only, a
permission-free positional heuristic runs everywhere: comparing `window.screenX`
/ `screenY` and `outerWidth` / `outerHeight` against `screen.availWidth` /
`availHeight` reveals a window sitting outside the primary display's bounds. It
is noisier than `isExtended` and is recorded as Tier B, but it gives Firefox and
Safari sessions something rather than nothing.

## Fullscreen

Fullscreen exit is only meaningful if the session entered fullscreen. The
browser will not let a page force fullscreen without a user gesture, and fighting
that produces a worse experience than it prevents.

So: the pre-join screen offers a "start in fullscreen" action as part of joining.
If taken, exits are recorded. If not, no fullscreen events are recorded at all,
and the report says fullscreen was not in use — again, never an empty pass.

## Data model

A new table rather than reusing `interviewSessionEvents`.

```ts
proctoringEvents: defineTable({
  interviewId: v.id("interviews"),
  streamCallId: v.string(),
  candidateClerkId: v.string(),
  kind: v.string(),              // "focus.lost" | "tab.hidden" | "editor.bulkInsert" | ...
  tier: v.union(v.literal("a"), v.literal("b")),
  startedAt: v.number(),         // server-authoritative
  durationMs: v.optional(v.number()),
  magnitude: v.optional(v.number()), // chars pasted, ms absent
  clientReportedAt: v.optional(v.number()),
  clockSkewMs: v.optional(v.number()),
  metadata: v.optional(v.string()),
})
  .index("by_interview", ["interviewId"])
  .index("by_candidate", ["candidateClerkId"])
  .index("by_created_at", ["startedAt"])
```

`interviewSessionEvents` is deliberately left alone. `getSessionEvents` does
`.take(50)`; proctoring is a far higher-volume stream and would swamp the
existing session timeline, which is a real regression rather than a theoretical
one. Separate volumes also want separate retention.

A companion `proctoringSessions` row per interview holds the session-level facts
that are not events: whether fullscreen was used, browser and support status, and
the heartbeat window. This is what lets the report distinguish "checked and
clean" from "never checked".

## Volume and cost

This is the part most likely to go wrong in production. A candidate glancing at a
second monitor could generate hundreds of raw events an hour, and Convex function
calls are a metered resource on a deployment already being watched for quota.

- **Intervals, not edges.** `blur` starts a span; `focus` closes it and emits one
  event carrying a duration. Two events become one.
- **Debounce.** Focus changes shorter than `MIN_ABSENCE_MS` (1000ms) are dropped
  as window-manager noise — clicking a notification, a transient dialog.
- **Buffer and flush.** Events queue client-side and flush every 15s, on a full
  buffer, or on unload via `sendBeacon`. One mutation carries a batch.
- **Server-side rate limit.** The batch mutation is rate-limited per candidate
  per interview, reusing `consumeRateLimit` in `src/lib/rateLimit.ts`. A client
  that floods is throttled, and the throttling is itself recorded.
- **Retention.** 90 days, matching `interviewSessionEvents`, added to the
  existing `pruneExpiredRecords` cron in `convex/metrics.ts`.

## Authorization

- **Write:** only the candidate on their own interview, via a new
  `recordProctoringBatch` mutation. It derives identity from the verified token
  and rejects a mismatch. Append-only — no update or delete path exists.
- **Read:** `requireInterviewReviewAccess`, which already excludes candidates and
  covers the interviewer on the interview plus recruiters and admins.
- **Candidate-history read:** admin and recruiter only.

The candidate can write events but never read them back, which prevents probing
for thresholds.

## Disclosure gate

Shown in `MeetingSetup` before joining, and required — this is the lawful basis
given that logging is silent. It states plainly what is recorded (focus changes,
pastes, extended displays), what is not (no webcam analysis, no screen capture,
no keystroke content), who can see it, and for how long it is kept. It matches
the tone already set in `/recording-disclosure`.

Acknowledgement is recorded as a `proctoringSessions` field with a timestamp. An
interview with no acknowledgement shows as such on the report.

## Reporting

**During the call.** A panel in `MeetingRoom`, rendered only for the interviewer,
driven by a Convex reactive query — live updates cost nothing extra. Shows the
running summary and the last few events.

**After.** An integrity section on the interview review page alongside feedback,
with the full timeline.

**Per candidate.** A history view for admin and recruiter, aggregating across that
candidate's interviews.

### What the report says

No single "cheat score". A composite number reads as a verdict and invites a
rejection on "73/100" without anyone reading why. Instead, concrete measures:

- total time unfocused, and the longest single absence
- count of tab switches and window switches
- largest single insert, and total characters pasted
- extended display: extended / single / unsupported
- fullscreen: used / not used
- monitor gaps and clock skew

Above these sits a severity band — **clear**, **minor**, **notable** — derived
from thresholds stated in the UI next to the band, so an interviewer can disagree
with the rule rather than the number.

Starting thresholds, defined once in a single exported constant so the UI can
render the rule it actually applied:

- **clear** — under 30s total unfocused, no bulk insert over 120 characters, no
  monitor gap.
- **minor** — up to 2 minutes total unfocused, or a single bulk insert between
  120 and 400 characters.
- **notable** — beyond either of those, or any monitor gap, clock skew over 30s,
  or an extended display appearing mid-interview.

These are a starting point chosen to be forgiving, not a calibrated model. They
should be revisited once there is real data, and the constant is deliberately
one edit away. Every screen carries the same caveat: these are signals, not
proof, and a determined candidate on a second device produces a clean report.

**Per-candidate history carries a fairness risk** worth naming: a flag from one
interview following someone across every future application is prejudicial,
especially given the false-positive rate of focus signals. The history view is
therefore scoped to admin and recruiter, shows per-interview context rather than
a running total, and is subject to the same 90-day retention.

## Phasing

Stoppable after any phase, each independently useful.

1. **Foundation** — schema, `recordProctoringBatch`, the buffering client
   reporter, heartbeat, disclosure gate, `window-management` header. No detectors
   yet; verifies the pipeline end to end with a synthetic event.
2. **Tier A detectors** — visibility, focus, fullscreen, paste, Monaco bulk
   insert.
3. **Multi-monitor** — `isExtended` with three-state recording, change events,
   positional fallback.
4. **Reporting** — summary query, post-interview section, live interviewer panel.
5. **Per-candidate history** — admin and recruiter view.

## Verification

- `npm run ci:validate` after each phase.
- Unit tests for the pure logic, following `src/lib/rateLimit.test.ts`: interval
  collapsing, debounce threshold, severity banding, and three-state display
  resolution. These are the parts where an off-by-one silently changes what an
  interviewer is told.
- Manual, in a real interview between two accounts, checking each in turn:
  switch tabs for 5s and confirm one event with a duration rather than two;
  paste 500 characters and confirm the bulk-insert event; disconnect a monitor
  mid-call; and **verify the interviewer sees events while the candidate sees
  nothing**, which is the whole premise.
- Deliberately verify the negative cases, since they are the ones that mislead:
  load the interview in Firefox and confirm the report says "unsupported" rather
  than showing a clean multi-monitor result; and block the batch mutation in
  devtools and confirm a monitor gap appears.

## Out of scope

- Any enforcement or blocking behaviour.
- Webcam, screen capture, or keystroke biometrics.
- Proctoring in `/practice`, which is unscheduled solo work with nothing to cheat.
- Detecting a second physical device, which is not solvable in a browser and
  should not be implied to interviewers.
