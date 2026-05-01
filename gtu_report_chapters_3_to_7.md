# Commit: A Real-Time Technical Interview Management, Evaluation, and Collaboration Platform

## Abstract

Commit is a full-stack web platform developed to support the complete lifecycle of technical interviews through a single integrated system. The application is implemented using **Next.js 16, React 18, TypeScript, Convex, Clerk, Stream Video, Tailwind CSS, and Docker-based code execution**.

The platform provides:

- Role-governed access for:
  - Candidate
  - Interviewer
  - Recruiter
  - Developer
  - Administrator
- Authentication via Clerk
- Hybrid authorization model
- Audit logging for sensitive operations

### Key Features

- Interview lifecycle management:
  - Draft, Scheduled, Live, Completed, Cancelled, No-show, Rescheduled, Passed, Rejected
- Scheduling system:
  - Templates, buffers, timezone support
- Real-time video interviews via Stream
- Secure coding environment:
  - Monaco editor
  - Docker-isolated execution (JS, Python, Java)
- Evaluation system:
  - Scorecards, weighted scoring, feedback controls
- Operational features:
  - Notifications, telemetry, backups, recovery workflows

---

## Chapter 1 - Company/Project Overview

### 1.1 Background

Commit is designed as a modern technical interviewing platform that unifies:

- Scheduling
- Video interviews
- Coding assessments
- Feedback collection
- Operational dashboards

---

### 1.2 Scope of the Project Environment

The system supports:

- Candidate workflows
- Interviewer workflows
- Recruiter workflows
- Admin and developer operations

Features include:

- Interview creation, rescheduling, cancellation
- Notifications (in-app + email)
- Recording governance
- Health monitoring & reliability tracking

---

### 1.3 Team Structure

Defined roles:

- Candidate
- Interviewer
- Recruiter
- Developer
- Administrator

Each role has specific permissions via RBAC and Convex schema.

⚠️ **MANUAL INPUT NEEDED**  
Add company details, mentor info, and organizational structure if required.
"leave them empty i will add them later manually"

## Chapter 2 - Project Introduction

### 2.1 Project Summary

Commit is a workflow-driven platform integrating:

- Video interviews
- Live coding
- Scheduling
- Feedback systems
- Admin dashboards

---

### 2.2 Purpose

To eliminate fragmentation in technical interview processes by consolidating:

- Scheduling
- Meeting tools
- Coding environments
- Feedback systems

---

### 2.3 Objectives

- Secure authentication & authorization
- Real-time video interviews
- Safe code execution
- Structured feedback capture
- Interview lifecycle management
- Notifications & dashboards

---

### 2.4 Scope

Includes:

- Scheduling with timezone handling
- Stream-based meetings
- Docker-based execution
- Scorecards & evaluation
- Notifications & audit logs
- Backup & recovery systems

Limitations:

- No native Google/Outlook sync
- Limited automated restore pipeline

---

## 2.5 Technology and Literature Review

### Core Technologies

#### Next.js 16

- Full-stack React framework
- Supports server routes & actions

#### React 18

- UI layer for dashboards and workflows

#### TypeScript 5

- Type safety across system

#### Convex

- Backend (database + server functions)

#### Clerk

- Authentication and user management

---

### Communication & Execution

#### Stream Video SDK

- Real-time video interviews

#### Monaco Editor

- Code editor interface

#### Docker

- Secure code execution

---

### UI & Styling

- Tailwind CSS
- shadcn/ui + Radix UI
- lucide-react icons
- sonner (toast notifications)

---

### Utilities & Libraries

- Zod → validation
- date-fns → date handling
- react-hook-form → forms
- react-day-picker → calendar
- clsx + tailwind-merge → styling helpers

---

### Backend & Ops

- Nodemailer → email delivery
- node-cron → scheduled jobs
- Svix → webhook verification
- Node test runner → unit tests

---

⚠️ **MANUAL INPUT NEEDED**  
Verify unused dependencies like:

- `@hookform/resolvers`
- `react-player`
- `radix-ui`

---

## Gantt Chart (Estimated)

⚠️ **MANUAL INPUT NEEDED**  
Actual timelines not present; below is an estimate.

| Phase | Work                                    | Weeks |
| ----- | --------------------------------------- | ----- |
| 1     | Requirement analysis & architecture     | 1     |
| 2     | Project setup (Next.js, Tailwind, etc.) | 1     |
| 3     | Backend + Auth + RBAC                   | 1     |
| 4     | Scheduling system                       | 2     |
| 5     | Video integration (Stream)              | 1     |
| 6     | Coding workspace + Docker execution     | 1     |
| 7     | Feedback & admin dashboards             | 1     |
| 8     | Notifications + telemetry + backups     | 1     |
| 9     | Final integration & documentation       | 1     |

---

## 3. Chapter 3 - System Analysis

### 3.1 Introduction

The implemented project is a real-time technical interviewing platform named **Commit**. Based on the codebase, the system combines interview scheduling, role-based access control, video meetings, collaborative coding, structured interviewer feedback, notifications, recordings, and operational monitoring into one web application built with Next.js, Convex, Clerk, Stream, Docker, and TypeScript.

### 3.2 Existing System Problems

The codebase strongly suggests that the project was built to solve a fragmented interview workflow in which multiple disconnected tools are otherwise needed for scheduling, live interviews, note-taking, evaluation, and communication.

`⚠️ MANUAL INPUT NEEDED: organization-specific description of the exact pre-project process is not present in the repository.`

Problems addressed by the implemented system are:

1. Interview scheduling and interview execution are usually separated across different tools.
2. Candidate, interviewer, and recruiter coordination creates manual communication overhead.
3. Traditional video tools do not provide interview-specific lifecycle control, structured notes, or coding evaluation.
4. Feedback collection can become inconsistent, delayed, biased, or incomplete without a standard scorecard workflow.
5. Access to recordings, dashboards, and role management requires strong authorization that ad hoc systems do not provide consistently.
6. Notifications and reminders are easy to miss without in-app and email delivery tracking.
7. Engineering interviews often need secure code execution, but raw local execution is unsafe.
8. Operational failures such as webhook problems, retry handling, and degraded video quality are difficult to trace without observability and audit logging.

### 3.3 Requirement Analysis

#### 3.3.1 Functional Requirements

The implemented system supports the following functional requirements:

1. User authentication through Clerk and automatic user synchronization to Convex.
2. Role-based access for `candidate`, `interviewer`, `recruiter`, `developer`, and `admin`.
3. Custom role definition and permission assignment.
4. Invitation-based onboarding for privileged roles.
5. Interview creation, update, reschedule, cancellation, and lifecycle automation.
6. Conflict-aware interview scheduling with interviewer buffer times.
7. Candidate and interviewer-specific interview retrieval.
8. Calendar event creation and calendar-oriented interview views.
9. Real-time meeting join flow with setup checks for browser, camera, microphone, and network readiness.
10. Real-time Stream meeting room with host controls, layout switching, participant list, reactions, screensharing, and recording controls.
11. Interview session event logging for joins, leaves, reconnects, offline states, host actions, and recording/session events.
12. Secure multi-language code execution through Docker for JavaScript, Python, and Java.
13. Structured feedback capture with draft and submitted states.
14. Weighted competency scoring, recommendations, summary, private/shared notes, and hide-until-submit review flow.
15. Comment creation, editing, visibility control, and interview note history.
16. Hiring packet export from stored feedback, notes, and session events.
17. In-app and email notification creation, delivery processing, retry logic, and read tracking.
18. Notification preference management with timezone support and category-based opt-out.
19. Authorized recording listing with retention-aware access.
20. Dashboard analytics, funnel views, manual overrides, candidate history, team management, developer observability, and reliability operations.
21. Telemetry ingestion, integration health checks, webhook tracking, background jobs, recovery operations, and backup snapshot tracking.

#### 3.3.2 Non-Functional Requirements

The codebase implements or clearly targets the following non-functional requirements:

1. Security through Clerk authentication, Convex authorization helpers, invitation hashing, internal API protection, and rate limiting.
2. Reliability through background jobs, webhook deduplication, retries, recovery operations, and operational event logging.
3. Performance through reactive Convex queries, bounded result sets, and paginated or capped activity panels.
4. Maintainability through modular TypeScript code, separated feature folders, reusable UI components, and centralized utility libraries.
5. Scalability through managed Convex backend services, Stream infrastructure, and componentized application architecture.
6. Usability through role-based dashboards, setup checks before meetings, skeleton loaders, error states, and notification preferences.
7. Auditability through `auditLogs`, `operationalEvents`, `webhookEvents`, and `interviewSessionEvents`.
8. Portability through web-based delivery using Next.js and containerized code execution using Docker.

### 3.4 Feasibility Study

#### 3.4.1 Technical Feasibility

The system is technically feasible because the repository already integrates:

1. Next.js App Router for frontend and API routes.
2. Convex for schema, queries, mutations, actions, and HTTP webhook handling.
3. Clerk for authentication and session identity.
4. Stream Video SDK for live interview calls and recording support.
5. Docker-based sandboxing for code execution.
6. Nodemailer-based email transport for notification delivery.

#### 3.4.2 Operational Feasibility

The system is operationally feasible because each stakeholder role has dedicated or protected interfaces:

1. Candidates can view and join interviews.
2. Interviewers can conduct interviews, view recordings, and submit feedback.
3. Recruiters can schedule, reschedule, and manage interview operations.
4. Developers and admins can access observability, reliability, and platform governance features.

#### 3.4.3 Economic Feasibility

The implemented stack reduces the need to build custom infrastructure for authentication, live video, and real-time data from scratch by using Clerk, Stream, and Convex. This lowers development effort compared to building all services internally.

`⚠️ MANUAL INPUT NEEDED: actual subscription cost, hosting cost, and internship organization budget figures are not available in the repository.`

### 3.5 System Features

Major system features implemented in the codebase are:

1. Secure sign-in and user synchronization.
2. Hybrid RBAC with default and custom permissions.
3. Invitation and role assignment workflow.
4. Interview scheduling with conflict detection and lifecycle events.
5. Interview calendar and workspace filtering.
6. Live video interview room with host moderation tools.
7. Collaborative coding with Monaco editor and isolated code execution.
8. Structured evaluation scorecards and comment history.
9. Notification center with read status and preferences.
10. Email notification dispatch and health monitoring.
11. Recording access control and retention-aware listing.
12. Admin analytics dashboard and hiring funnel tracking.
13. Reliability dashboard, webhook recovery, background job control, and backup tracking.
14. Telemetry capture and integration health dashboards.

### 3.6 System Modules

The implemented modules are:

1. **Authentication and User Sync Module**
   Uses Clerk and `convex/users.ts`.
2. **Role and Access Management Module**
   Uses `convex/authz.ts`, `convex/users.ts`, `src/components/ui/AccessManagementPanel.tsx`, and dashboard role pages.
3. **Interview Management Module**
   Uses `convex/interviews.ts`, schedule pages, and interview workspace components.
4. **Calendar Module**
   Uses `convex/calendarEvents.ts` and `src/features/interviews/calendar/InterviewCalendarPage.tsx`.
5. **Meeting and Collaboration Module**
   Uses Stream providers, `MeetingSetup.tsx`, `MeetingRoom.tsx`, `MeetingModal.tsx`, and `stream.actions.ts`.
6. **Code Execution Module**
   Uses `src/app/api/execute/route.ts`, `src/lib/docker-runner.ts`, and `src/lib/test-harness.ts`.
7. **Evaluation and Feedback Module**
   Uses `convex/feedback.ts`, `convex/comments.ts`, and `src/features/interviews/evaluation/*`.
8. **Notifications Module**
   Uses `convex/notifications.ts`, `convex/emailActions.ts`, settings page, notification bell, and email API routes.
9. **Recording Module**
   Uses `src/actions/stream.actions.ts` and `src/app/(root)/recordings/page.tsx`.
10. **Observability and Reliability Module**
    Uses `convex/observability.ts`, `convex/reliability.ts`, `convex/http.ts`, telemetry route, and developer dashboard pages.

## 4. Chapter 4 - System Design

### 4.1 Architecture Overview

The system follows a modular full-stack web architecture:

1. **Presentation Layer**: Next.js App Router pages, feature components, and reusable UI components in `src/app`, `src/features`, and `src/components`.
2. **Application Layer**: Next.js route handlers, server actions, hooks, and shared utilities in `src/app/api`, `src/actions`, `src/hooks`, and `src/lib`.
3. **Business Logic Layer**: Convex queries, mutations, internal mutations, and actions in `convex/*.ts`.
4. **Data Layer**: Convex database schema defined in `convex/schema.ts`.
5. **External Service Layer**: Clerk for auth, Stream for video/recordings, SMTP via Nodemailer for email, and Docker for code execution.

**Fig 4.1 System Architecture of Commit**: The user accesses the Next.js web interface, which authenticates through Clerk. UI components call Convex queries and mutations for business workflows, Stream APIs for video sessions and recordings, Next.js API routes for execution, telemetry, invitations, and email delivery, while persistent data is stored in Convex tables.

### 4.2 Database Schema

#### 4.2.1 Tables, Fields, and Relations

1. **`users`**
   Fields: `name`, `email`, `image?`, `role`, `customRoleId?`, `clerkId`, `skills?`, `availabilitySummary?`, `permissionTags?`, `isActive?`
   Indexes: `by_clerk_id`, `by_email`
   Relations: `customRoleId -> roleDefinitions._id`; logical reference target for `candidateId`, `interviewerIds`, `userClerkId`, `recipientClerkId`, `actorClerkId`

2. **`roleDefinitions`**
   Fields: `name`, `slug`, `description?`, `permissions[]`, `createdBy`, `updatedBy?`, `createdAt`, `updatedAt`
   Indexes: `by_slug`
   Relations: referenced by `users.customRoleId`

3. **`interviews`**
   Fields: `title`, `description?`, `templateId?`, `templateLabel?`, `startTime`, `scheduledStartTime?`, `scheduledEndTime?`, `endTime?`, `durationMinutes?`, `timezone?`, `status`, `streamCallId`, `candidateId`, `interviewerIds[]`, `meetingInstructions?`, `brandName?`, `browserFallbackInstructions?`, `bufferBeforeMinutes?`, `bufferAfterMinutes?`, `cancellationReason?`, `rescheduleReason?`, `reminderSentAt?`, `feedbackReminderSentAt?`, `recordingDisclosure?`, `recordingRetentionDays?`, `notesRetentionDays?`, `candidateDataRetentionDays?`, `lifecycleEvents?[]`
   Indexes: `by_candidate_id`, `by_stream_call_id`, `by_status`, `by_startTime`
   Relations: logical `candidateId -> users.clerkId`; logical `interviewerIds[] -> users.clerkId[]`; parent for comments, feedback, session events, and notifications

4. **`customCalendarEvents`**
   Fields: `title`, `description?`, `startTime`, `endTime`, `userClerkId`, `createdBy`, `updatedAt`
   Indexes: `by_user_clerk_id`, `by_user_clerk_id_start_time`
   Relations: logical `userClerkId -> users.clerkId`

5. **`comments`**
   Fields: `content`, `rating`, `interviewerId`, `interviewId`, `visibility?`, `updatedAt?`
   Indexes: `by_interview_id`, `by_interview_id_interviewer_id`
   Relations: `interviewId -> interviews._id`; logical `interviewerId -> users.clerkId`

6. **`feedback`**
   Fields: `interviewId`, `interviewerId`, `state`, `visibility`, `roundType?`, `recommendation`, `summary`, `sharedNotes?`, `privateNotes?`, `decisionSummary?`, `weightedScore`, `overallScore`, `hideUntilSubmit`, `competencies[]`, `dueAt?`, `submittedAt?`, `updatedAt`, `editedAt?`
   Indexes: `by_interview_id`, `by_interview_id_interviewer_id`, `by_interviewer_id_state`
   Relations: `interviewId -> interviews._id`; logical `interviewerId -> users.clerkId`

7. **`interviewSessionEvents`**
   Fields: `interviewId`, `streamCallId`, `type`, `actorClerkId?`, `actorRole?`, `detail?`, `metadata?`, `createdAt`
   Indexes: `by_interview_id`, `by_stream_call_id`
   Relations: `interviewId -> interviews._id`; logical `actorClerkId -> users.clerkId`

8. **`invitations`**
   Fields: `email`, `role`, `tokenHash?`, `invitedBy`, `status`, `createdAt`, `expiresAt?`, `lastSentAt?`, `acceptedAt?`, `acceptedBy?`, `revokedAt?`, `revokedBy?`
   Indexes: `by_email`, `by_email_status`, `by_token_hash`, `by_status`
   Relations: logical `invitedBy`, `acceptedBy`, `revokedBy -> users.clerkId`

9. **`auditLogs`**
   Fields: `action`, `actorClerkId?`, `actorEmail?`, `targetType`, `targetId?`, `metadata?`, `createdAt`
   Indexes: `by_target_type`, `by_actor_clerk_id`
   Relations: logical `actorClerkId -> users.clerkId`

10. **`notifications`**
    Fields: `recipientClerkId`, `interviewId?`, `type`, `channel?`, `category?`, `title`, `message`, `status`, `scheduledFor`, `sentAt?`, `readAt?`, `deliveryAttempts?`, `nextRetryAt?`, `lastError?`, `recipientEmail?`, `timezone?`, `providerMessageId?`, `metadata?`
    Indexes: `by_recipient_channel`, `by_recipient_status`, `by_recipient_scheduled_for`, `by_status`
    Relations: logical `recipientClerkId -> users.clerkId`; optional `interviewId -> interviews._id`

11. **`notificationPreferences`**
    Fields: `userClerkId`, `emailEnabled`, `inAppEnabled`, `interviewScheduleEmails`, `interviewReminderEmails`, `feedbackReminderEmails`, `optOutAll`, `timezone?`, `updatedAt`
    Indexes: `by_user_clerk_id`
    Relations: logical `userClerkId -> users.clerkId`

12. **`operationalEvents`**
    Fields: `source`, `scope`, `level`, `message`, `requestId?`, `correlationId?`, `userId?`, `interviewId?`, `streamCallId?`, `provider?`, `status?`, `metadata?`, `createdAt`
    Indexes: `by_created_at`, `by_level_created_at`, `by_scope_created_at`
    Relations: logical `userId -> users.clerkId`; loose reference to interview and call context

13. **`integrationHealthChecks`**
    Fields: `provider`, `status`, `message`, `latencyMs?`, `metadata?`, `checkedAt`
    Indexes: `by_provider_checked_at`, `by_status_checked_at`
    Relations: no direct foreign key

14. **`webhookEvents`**
    Fields: `provider`, `eventId`, `eventType`, `status`, `attemptCount`, `nextRetryAt?`, `lastError?`, `payload?`, `createdAt`, `processedAt?`, `correlationId?`
    Indexes: `by_provider_event_id`, `by_status_created_at`
    Relations: used by Clerk webhook processing and reliability workflows

15. **`backgroundJobs`**
    Fields: `kind`, `status`, `runAt`, `attemptCount`, `maxAttempts`, `payload?`, `lastError?`, `lastAttemptAt?`, `completedAt?`, `createdAt`, `deadLetterReason?`, `relatedId?`
    Indexes: `by_status_run_at`, `by_kind_created_at`
    Relations: `relatedId` is a loose reference, commonly used for interview-related jobs

16. **`recoveryOperations`**
    Fields: `status`, `mode`, `scope`, `summary`, `detail?`, `referenceId?`, `externalId?`, `attempts`, `createdAt`, `resolvedAt?`, `resolution?`
    Indexes: `by_status_created_at`, `by_scope_created_at`
    Relations: loose linkage to failed webhooks/jobs/providers

17. **`backupSnapshots`**
    Fields: `kind`, `status`, `summary`, `scope`, `storageLocation?`, `notes?`, `createdBy?`, `createdAt`, `restoredAt?`
    Indexes: `by_status_created_at`, `by_kind_created_at`
    Relations: logical `createdBy -> users.clerkId`

**Fig 4.2 Entity Relationship View of Commit Database**: `users` is the central identity table. `interviews` references users by `candidateId` and `interviewerIds`, while `comments`, `feedback`, `interviewSessionEvents`, and `notifications` depend on interview records. Administrative and reliability support data is stored in `auditLogs`, `operationalEvents`, `webhookEvents`, `backgroundJobs`, `recoveryOperations`, and `backupSnapshots`.

### 4.3 API Endpoints

| Method | Endpoint                          | Description                                                                       | Auth Required                                                     |
| ------ | --------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `POST` | `/api/execute`                    | Validates `{ language, code }` and runs code inside an ephemeral Docker container | No Clerk auth in route; server-side validation only               |
| `GET`  | `/api/health`                     | Returns application and integration health flags                                  | No                                                                |
| `POST` | `/api/invitations`                | Creates privileged invitation records and sends invitation email                  | Yes, Clerk-authenticated user                                     |
| `POST` | `/api/notifications/email`        | Internal email dispatch endpoint used by Convex actions                           | Internal API key in production; dev bypass if unset               |
| `GET`  | `/api/notifications/email/health` | Returns SMTP/email transport health                                               | No explicit route auth                                            |
| `POST` | `/api/telemetry`                  | Accepts telemetry payload and stores it through Convex mutation                   | Indirect Clerk token used when available; no hard fail if missing |
| `POST` | `/clerk-webhook`                  | Verifies Svix signature and processes Clerk user/session events                   | Webhook secret and Svix headers required                          |

### 4.4 UI Components List

#### 4.4.1 Core Application Components

1. `Navbar`
2. `RoleGuard`
3. `ThemeProvider`
4. `ConvexClerkProvider`
5. `NotificationBell`
6. `NotificationsPanel`
7. `ErrorState`

#### 4.4.2 Meeting and Interview Components

1. `MeetingModal`
2. `MeetingCard`
3. `MeetingSetup`
4. `MeetingRoom`
5. `CodeEditor`
6. `EndCallButton`
7. `RecordingCard`

#### 4.4.3 Evaluation Components

1. `StructuredScorecardSection`
2. `NotesComposerSection`
3. `FeedbackEntriesPanel`
4. `CommentHistoryPanel`
5. `CommentDialog`

#### 4.4.4 Dashboard and Workspace Components

1. `DashboardShell`
2. `DashboardPageHeader`
3. `MetricCard`
4. `SectionIntro`
5. `PipelineFilters`
6. `PipelineInterviewList`
7. `HiringFunnelCard`
8. `ManualOverrideCard`
9. `AccessManagementPanel`
10. `ActionCard`

#### 4.4.5 UI Primitive Components

1. `button`, `card`, `dialog`, `dropdown-menu`, `input`, `label`, `select`, `switch`, `textarea`
2. `avatar`, `badge`, `calendar`, `scroll-area`, `skeleton`, `status-badge`, `resizable`

### 4.5 Data Flow Description

The high-level data flow is as follows:

1. User signs in through Clerk.
2. `ConvexClerkProvider` and `useSyncUser` ensure the Clerk user exists in Convex `users`.
3. Frontend pages call Convex queries and mutations using `convex/react`.
4. Scheduling pages store interview records in `interviews`, queue notifications, and enqueue background jobs.
5. Meeting pages retrieve Stream call details and the linked interview record using `streamCallId`.
6. Meeting actions log session events into `interviewSessionEvents`.
7. Feedback pages store scorecards in `feedback` and notes in `comments`.
8. Notification workflows fan out records into `notifications`, dispatch email via Next.js internal API, and update delivery state.
9. Admin and developer dashboards aggregate data from interviews, feedback, observability, reliability, invitations, and audit tables.

**Fig 4.3 Interview Lifecycle Data Flow**: recruiter/admin creates an interview, Convex stores the schedule, notifications are queued, candidate/interviewer join the Stream meeting, session events are logged, interviewers submit structured feedback, and operational/notification data is retained for dashboard and audit use.

### 4.6 Security Design

The implemented security design includes:

1. Clerk-based authentication at application level.
2. Middleware correlation tracking in `src/middleware.ts`.
3. Role and permission checks through `requirePermission`, `requireAnyPermission`, `requireInterviewAccess`, `requireInterviewReviewAccess`, and `requireRecordingAccess` in `convex/authz.ts`.
4. Invitation token hashing using SHA-256 in `convex/users.ts`.
5. Input validation using Zod in `src/app/api/execute/route.ts`, `src/lib/env.ts`, and feedback schemas.
6. Route-level rate limiting in `src/lib/rateLimit.ts` for email and telemetry APIs.
7. Docker execution sandboxing with `--network none`, memory cap, CPU cap, read-only filesystem, temp directory isolation, timeout, and output limits in `src/lib/docker-runner.ts`.
8. Webhook signature verification using Svix in `convex/http.ts`.
9. Internal API key validation for notification email dispatch in production.
10. Audit logging for sensitive operations through `auditLogs`.

## 5. Chapter 5 - Implementation

### 5.1 Folder Structure with Description

1. `src/app/` - Next.js App Router pages, layouts, and route handlers.
2. `src/app/(root)/` - authenticated end-user pages such as home, calendar, schedule, settings, recordings, meeting, privacy, terms.
3. `src/app/(admin)/dashboard/` - admin, recruiter, and developer workspaces.
4. `src/app/api/` - HTTP route handlers for code execution, health, invitations, telemetry, and email notifications.
5. `src/components/` - shared UI and provider components.
6. `src/components/auth/` - access control wrapper components.
7. `src/components/dashboard/` - dashboard layout and metric primitives.
8. `src/components/providers/` - Clerk, Convex, Stream, and theme integration providers.
9. `src/components/ui/` - reusable application and primitive UI components.
10. `src/features/interviews/` - interview-specific calendar, evaluation, and workspace modules.
11. `src/hooks/` - reusable React hooks for roles, calls, meeting actions, sync, and lifecycle automation.
12. `src/actions/` - server actions, mainly Stream-related operations.
13. `src/lib/` - shared utilities for Docker execution, env validation, feature flags, telemetry, errors, email, and helpers.
14. `src/constants/` - application constants such as templates, statuses, timezones, questions, and quick actions.
15. `convex/` - backend schema, queries, mutations, actions, authorization, observability, reliability, and webhook handling.
16. `public/` - static assets.
17. `scripts/` - standalone runtime script such as backup job execution.
18. `reference/` - report samples and internship report guideline PDFs.
19. `package.json` - dependencies and scripts.
20. `tsconfig.json`, `next.config.mjs`, `postcss.config.mjs`, `components.json` - project configuration files.

### 5.2 Key Technical Implementations

#### 5.2.1 Interview Scheduling with Conflict Detection

Implemented in `convex/interviews.ts` using:

1. `createInterview`
2. `assertNoConflicts`
3. `scheduleInterviewBackgroundWork`
4. `queueInterviewNotifications`

This implementation validates candidate and interviewer roles, calculates end time, checks overlapping schedules with buffer windows, stores lifecycle metadata, queues notifications, and creates reminder/cleanup jobs.

#### 5.2.2 Secure Code Execution through Docker

Implemented in:

1. `src/app/api/execute/route.ts -> POST`
2. `src/lib/docker-runner.ts -> runCodeInDocker`
3. `src/lib/docker-runner.ts -> ensureImage`

The route validates language and source size, then executes code in an ephemeral container with CPU, memory, timeout, read-only filesystem, tmpfs, disabled network, and bounded output.

#### 5.2.3 Real-Time Meeting Room with Session Logging

Implemented in:

1. `src/components/ui/MeetingSetup.tsx -> handleJoin`
2. `src/components/ui/MeetingRoom.tsx`
3. `convex/sessionEvents.ts -> logSessionEvent`
4. `src/actions/stream.actions.ts -> endInterviewMeeting`

The system joins Stream calls, checks permissions and device readiness, tracks participant/network state changes, allows host actions, and persists session event history for later review.

#### 5.2.4 Structured Feedback and Hiring Packet Export

Implemented in:

1. `convex/feedback.ts -> saveFeedback`
2. `convex/feedback.ts -> getInterviewFeedback`
3. `convex/feedback.ts -> exportHiringPacket`
4. `src/features/interviews/evaluation/StructuredScorecardSection.tsx`
5. `src/features/interviews/evaluation/NotesComposerSection.tsx`

This workflow supports draft/submitted states, weighted competency scores, privacy-aware review visibility, due dates, and consolidated export of feedback, notes, and session events.

#### 5.2.5 Notification Delivery, Retry, and Preference Control

Implemented in:

1. `convex/notifications.ts -> processNotificationDelivery`
2. `convex/notifications.ts -> updateMyNotificationPreferences`
3. `convex/emailActions.ts -> dispatchEmailNotification`
4. `src/app/api/notifications/email/route.ts -> POST`
5. `src/app/(root)/settings/page.tsx`

The design creates both in-app and email notification fanout, applies user preferences, performs retry scheduling, stores delivery metadata, and exposes settings controls for timezone and opt-out rules.

### 5.3 End-to-End User Flow

1. User signs in through Clerk.
2. The application syncs the user into Convex `users`.
3. Recruiter or admin opens `/schedule` and creates an interview.
4. `createInterview` stores the interview, queues notifications, and schedules reminder/cleanup jobs.
5. Candidate and interviewers see the interview from home page, calendar, or workspace pages.
6. User opens `/meeting/[id]`, where the linked Stream call and interview record are loaded.
7. `MeetingSetup` checks browser support, permissions, and network readiness.
8. On join, `MeetingRoom` manages live interaction, code collaboration, and session event logging.
9. Interviewers submit scorecards and notes through the evaluation module.
10. Notification records, audit logs, session history, and dashboard analytics become available for later review by authorized roles.

## 6. Chapter 6 - Testing

### 6.1 Test Cases

| Test ID | Module           | Condition                                                       | Expected                                                         | Actual                                                                                                                               | Result                      |
| ------- | ---------------- | --------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------- |
| `TC-01` | Error Handling   | `sanitizeErrorMessage()` receives Convex-formatted server error | Human-readable message should be extracted                       | Verified by `src/lib/errors.test.ts`; extracted conflict message correctly                                                           | Pass                        |
| `TC-02` | Error Handling   | `sanitizeErrorMessage()` receives plain error text              | Plain message should remain unchanged                            | Verified by `src/lib/errors.test.ts`; plain message preserved                                                                        | Pass                        |
| `TC-03` | Feature Flags    | Empty feature flag input                                        | Default flags should be returned                                 | Verified by `src/lib/featureFlags.test.ts`                                                                                           | Pass                        |
| `TC-04` | Feature Flags    | Explicit flag overrides are supplied                            | Parsed booleans should override defaults correctly               | Verified by `src/lib/featureFlags.test.ts`                                                                                           | Pass                        |
| `TC-05` | Feature Flags    | `isServerFeatureEnabled()` reads env flags                      | Named flag should reflect environment override                   | Verified by `src/lib/featureFlags.test.ts`                                                                                           | Pass                        |
| `TC-06` | Rate Limiting    | Requests stay within limit                                      | Requests until threshold should be allowed                       | Verified by `src/lib/rateLimit.test.ts`                                                                                              | Pass                        |
| `TC-07` | Rate Limiting    | Requests exceed limit                                           | Request should be blocked with retry metadata                    | Verified by `src/lib/rateLimit.test.ts`                                                                                              | Pass                        |
| `TC-08` | Rate Limiting    | New time window starts after reset time                         | Bucket should reset and allow request again                      | Verified by `src/lib/rateLimit.test.ts`                                                                                              | Pass                        |
| `TC-09` | Rate Limiting    | Forwarded IP header is present                                  | IP-based key should use forwarded client IP                      | Verified by `src/lib/rateLimit.test.ts`                                                                                              | Pass                        |
| `TC-10` | Rate Limiting    | Headers are generated after consume                             | Standard rate-limit headers should be returned                   | Verified by `src/lib/rateLimit.test.ts`                                                                                              | Pass                        |
| `TC-11` | Type Safety      | Run `npm run typecheck`                                         | TypeScript should compile with no type errors                    | Verified in workspace; command completed without errors                                                                              | Pass                        |
| `TC-12` | Scheduling       | Create interview with overlapping interviewer schedule          | Mutation should reject conflicting slot                          | Code path present in `assertNoConflicts()`; `⚠️ MANUAL INPUT NEEDED: no executed integration trace in repo`                          | Pending manual verification |
| `TC-13` | Execution API    | Submit unsupported or invalid execution payload                 | Route should return validation error or bounded failure response | Code path present in `/api/execute`; `⚠️ MANUAL INPUT NEEDED: endpoint not executed in this session`                                 | Pending manual verification |
| `TC-14` | Meeting Workflow | Join live meeting after setup checks                            | User should enter Stream room and session event should be logged | Code path present in `MeetingSetup.handleJoin()` and `logSessionEvent()`; `⚠️ MANUAL INPUT NEEDED: requires live Stream environment` | Pending manual verification |
| `TC-15` | Notifications    | Dispatch email notification with preferences enabled            | Notification should be sent or tracked with message ID           | Code path present in `processNotificationDelivery()` and email route; `⚠️ MANUAL INPUT NEEDED: requires SMTP/runtime execution`      | Pending manual verification |

### 6.2 Testing Summary

Verified automated evidence from this workspace:

1. `npm test` passed with 3 test files and 9 passing tests.
2. `npm run typecheck` completed successfully.

`⚠️ MANUAL INPUT NEEDED: screenshot evidence, UAT sign-off, and full environment-backed API/meeting/SMTP execution results are not stored in the repository.`

## 7. Chapter 7 - Conclusion

### 7.1 Problems Encountered

The codebase indicates the following practical implementation challenges:

1. Coordinating multiple external services: Clerk, Convex, Stream, SMTP, and Docker.
2. Enforcing authorization across many role-sensitive workflows.
3. Managing real-time meeting failures such as reconnect, offline, and degraded network states.
4. Designing secure code execution without exposing the host system.
5. Tracking notification delivery, retries, and user preference suppression.
6. Handling webhook idempotency, failure recovery, and operational event capture.

### 7.2 Limitations of the Current System

Current limitations visible from the repository are:

1. The secure code execution route depends on Docker availability on the host.
2. Some routes such as `/api/execute` and email health endpoints do not enforce Clerk-based user authentication directly.
3. Automated tests currently cover utility-level logic more strongly than end-to-end interview workflows.
4. Hiring packet export is data export oriented and not a formatted PDF generator.
5. The build validation for this exact workspace was not fully captured during this session.
6. Production readiness notes in `desired_Features.md` show that some enhancements were still planned beyond the implemented baseline.

### 7.3 Future Enhancements

1. Add full end-to-end browser automation for schedule, meeting, and feedback workflows.
2. Generate downloadable formatted hiring packet reports such as PDF.
3. Strengthen route-level authentication and authorization around internal and diagnostic endpoints.
4. Add richer deployment automation and CI/CD reporting around `ci:validate`.
5. Expand code execution language support beyond JavaScript, Python, and Java.
6. Add stronger analytics and reporting views for interview throughput and interviewer performance.
7. Add backup storage integration and restore drill automation beyond metadata tracking.
8. Add waiting-room or backstage admission workflow if Stream/provider configuration is extended.

### 7.4 Summary

Commit is a well-structured, full-stack technical interviewing platform that centralizes scheduling, role management, live interviews, secure coding assessment, structured feedback, notifications, recordings, and platform observability. The repository demonstrates a strong implementation of real-time workflow management with security, auditability, and extensibility in mind. The project is suitable for presentation as an industry-oriented internship system because it combines frontend engineering, backend logic, real-time communication, sandboxed execution, and operational governance in one integrated application.

## References

The following references are formatted in GTU-friendly citation style with direct URLs.

1. Vercel, "Next.js Documentation - App Router," Available: https://nextjs.org/docs/app. Accessed: 29 April 2026.
2. React Team, "React Documentation," Available: https://react.dev/. Accessed: 29 April 2026.
3. Microsoft, "TypeScript Handbook," Available: https://www.typescriptlang.org/docs/handbook/intro. Accessed: 29 April 2026.
4. Convex, "Convex Authentication Documentation," Available: https://docs.convex.dev/auth. Accessed: 29 April 2026.
5. Convex, "Convex with Next.js," Available: https://docs.convex.dev/client/react/nextjs/. Accessed: 29 April 2026.
6. Clerk, "Clerk Next.js SDK Documentation," Available: https://clerk.com/docs/nextjs/overview. Accessed: 29 April 2026.
7. Stream, "React Video and Audio Docs," Available: https://getstream.io/video/docs/react/. Accessed: 29 April 2026.
8. Stream, "React Video UI Components Overview," Available: https://getstream.io/video/docs/react/ui-components/overview/. Accessed: 29 April 2026.
9. Tailwind Labs, "Tailwind CSS using PostCSS," Available: https://tailwindcss.com/docs/installation/using-postcss. Accessed: 29 April 2026.
10. Zod, "Zod Documentation," Available: https://zod.dev/. Accessed: 29 April 2026.
11. Nodemailer, "Nodemailer Documentation," Available: https://nodemailer.com/. Accessed: 29 April 2026.
12. Docker, "Running Containers," Available: https://docs.docker.com/engine/containers/run/. Accessed: 29 April 2026.
13. Docker, "None Network Driver," Available: https://docs.docker.com/engine/network/drivers/none/. Accessed: 29 April 2026.
14. Monaco Editor, "Monaco Editor Documentation," Available: https://microsoft.github.io/monaco-editor/. Accessed: 29 April 2026.

## List of Abbreviations

| Abbreviation | Full Form                          |
| ------------ | ---------------------------------- |
| `API`        | Application Programming Interface  |
| `RBAC`       | Role-Based Access Control          |
| `UI`         | User Interface                     |
| `DB`         | Database                           |
| `HTTP`       | Hypertext Transfer Protocol        |
| `URL`        | Uniform Resource Locator           |
| `JSON`       | JavaScript Object Notation         |
| `JWT`        | JSON Web Token                     |
| `SDK`        | Software Development Kit           |
| `SMTP`       | Simple Mail Transfer Protocol      |
| `HTML`       | HyperText Markup Language          |
| `CSS`        | Cascading Style Sheets             |
| `UTC`        | Coordinated Universal Time         |
| `CPU`        | Central Processing Unit            |
| `CI`         | Continuous Integration             |
| `E2E`        | End-to-End                         |
| `UAT`        | User Acceptance Testing            |
| `PDF`        | Portable Document Format           |
| `DX`         | Developer Experience               |
| `GDPR`       | General Data Protection Regulation |
