# Production Readiness Checklist for Commit

This document lists the features and capabilities this project should have before it can realistically be called a production-level interview platform.

The goal is not just "more features." A production interview application needs to be secure, reliable, auditable, scalable, and usable under real hiring conditions.

## 1. Identity, Access, and Roles

- Strong role-based access control for `candidate`, `interviewer`, `recruiter`, and `admin`.
- Server-side authorization on every sensitive query and mutation.
- Route protection for admin-only and interviewer-only screens.
- Permission checks for who can schedule, edit, cancel, end, comment on, and review interviews.
- Invitation-based onboarding for interviewers and admins instead of default role assignment.
- Secure session handling with token expiration and forced re-authentication for sensitive actions.
- Audit trail for sign-ins, permission changes, role updates, and account actions.

## 2. Interview Scheduling and Lifecycle

- Full interview lifecycle states such as `draft`, `scheduled`, `live`, `completed`, `cancelled`, `no_show`, `rescheduled`, `passed`, and `rejected`.
- Ability to reschedule interviews with candidate/interviewer notifications.
- Timezone-aware scheduling across regions.
- Conflict detection for overlapping interviewer calendars.
- Buffer times between interviews.
- Calendar integration with Google Calendar and Outlook.
- Cancellation reason capture and history.
- Automatic reminders before interviews.
- Automatic state transitions for missed or expired sessions.
- Interview templates for different rounds like screening, technical, panel, and final round.

## 3. Candidate and Interviewer Experience

- Proper waiting room and pre-join checks for microphone, camera, network, and permissions.
- Join instructions and fallback guidance when audio/video setup fails.
- Candidate-friendly error states instead of blank screens or silent failures.
- Browser compatibility checks before interview start.
- Accessible UI with keyboard navigation, focus states, and screen reader support.
- Mobile and low-bandwidth support for critical flows.
- Clear in-app status for upcoming, live, completed, cancelled, and rescheduled interviews.
- Branded candidate experience with company info and interview instructions.

## 4. Video Interview Reliability

- Reliable reconnection and degraded-mode handling for unstable networks.
- Participant presence tracking and disconnect/reconnect events.
- Host controls for admitting, removing, muting, and ending sessions.
- Session timeout handling and recovery flows.
- Call health monitoring for latency, packet loss, and device failures.
- Recording controls with explicit consent handling where required.
- Backup behavior if the video provider is degraded or unavailable.
- Structured error handling for token generation, provider init, meeting lookup, and call creation.

## 5. Evaluation and Feedback Workflow

- Structured scorecards with competencies, rubrics, and weighted scoring.
- Role-specific feedback forms per interview round.
- Draft vs submitted feedback states.
- Ability to prevent interviewers from seeing others' feedback before submitting their own.
- Feedback deadlines and reminders for interviewers.
- Required fields for final evaluation submission.
- Candidate decision workflow with pass/reject/hold/review outcomes.
- Comment history with author, timestamps, and edit tracking.
- Private vs shared notes.
- Exportable hiring packet containing notes, scorecards, and recordings.

## 6. Data Security and Privacy

- Strict server-side enforcement on who can read interviews, recordings, comments, and user lists.
- Encryption for sensitive data in transit and at rest.
- Secure storage and access control for recordings.
- PII minimization and field-level access where needed.
- Data retention policies for recordings, notes, and candidate records.
- Consent and compliance flows for recording interviews.
- Secrets management for Clerk, Convex, Stream, and webhooks.
- Environment validation on boot so production fails safely if required secrets are missing.
- Protection against ID-based data access across tenants or users.

## 7. Observability and Incident Response

- Centralized error tracking instead of only `console.error`.
- Structured logs with request, user, interview, and provider context.
- Monitoring dashboards for auth failures, scheduling failures, webhook failures, and video failures.
- Alerting for production incidents and degraded dependencies.
- Audit logs for interview state changes, comments, and status updates.
- Health checks for external integrations.
- Correlation IDs for tracing a request across frontend, backend, and third-party providers.

## 8. Reliability, Resilience, and Recovery

- Retry strategy for transient failures such as provider timeouts and webhook delivery issues.
- Idempotent webhook handling.
- Graceful fallbacks when third-party services are unavailable.
- Background jobs for reminders, retries, cleanup, and delayed processing.
- Backup and restore strategy for interview data.
- Safe handling for partial failure cases, such as call created but DB write failed.
- Dead-letter or manual recovery flow for failed background operations.
- Disaster recovery plan and documented recovery procedures.

## 9. Admin and Recruiting Operations

- Admin dashboard for interview pipeline visibility.
- Search and filtering by candidate, interviewer, role, stage, and date.
- Bulk actions for scheduling, status changes, and interviewer assignment.
- Manual override tools for fixing broken interview states.
- Candidate profile pages with history across rounds.
- Interviewer management with skills, availability, and role permissions.
- Reporting on throughput, time-to-hire, cancellation rate, feedback completion, and no-shows.
- Hiring funnel analytics by stage.

## 10. Notifications and Communication

- Email notifications for scheduling, rescheduling, cancellation, and reminders.
- Interviewer reminders for pending feedback.
- Candidate notifications with timezone-aware details.
- In-app notifications for important state changes.
- Delivery tracking and retry handling for failed notifications.
- Notification preferences and opt-out rules where appropriate.

## 11. Compliance and Governance

- Terms, privacy policy, and consent flows.
- Recording disclosure and jurisdiction-aware compliance support.
- GDPR or equivalent deletion/export flows for candidate data if required by your market.
- Data access logs for sensitive information.
- Internal admin controls for least-privilege access.
- Change management for production deployments.

## 12. Engineering and Delivery Standards

- Working CI pipeline with linting, type-checking, tests, and build validation.
- Unit tests for business logic and utilities.
- Integration tests for auth, scheduling, feedback, and interview state transitions.
- End-to-end tests for critical user journeys.
- Staging environment that mirrors production integrations.
- Feature flags for risky changes.
- Database migration strategy and rollback plan.
- Rate limiting and abuse protection for public or sensitive endpoints.
- Performance budgets and load testing for concurrent interviews.

## 13. UX Quality Bar for Production

- Empty states, loading states, and actionable error states for all main flows.
- No silent failures and no blank pages on recoverable errors.
- Consistent toast and inline error messaging.
- Clear success confirmation for important actions.
- Form validation on both client and server.
- Unsaved-changes protection for long feedback forms.
- Accessibility testing across the main interview and dashboard flows.

## 14. Interview-Platform-Specific Nice-to-Haves

- Live coding collaboration with session persistence and permissions.
- Whiteboard support for system design rounds.
- Interview kit attachments such as problem statements and rubrics.
- Interview playback with timestamps tied to comments.
- AI-assisted summaries with explicit review and privacy controls.
- Interview packet generation for hiring committees.
- Panel interview coordination and moderator controls.

## 15. Highest-Priority Gaps for This Codebase Right Now

Based on the current project structure, these are the most urgent items before calling it production-ready:

- Real authorization rules on Convex queries and mutations.
- Proper role assignment and role management flow.
- Centralized error monitoring and alerting.
- Recovery handling for Stream call creation vs interview DB creation mismatches.
- Interview state machine with stronger validation.
- Notification and reminder system.
- Calendar and timezone correctness.
- Better admin and interviewer workflow controls.
- Test coverage for critical interview paths.
- Recording access control and retention policy.

## Definition of "Production-Level" for This App

For this project, "production-level" should mean:

- A candidate can reliably attend an interview without confusing failures.
- An interviewer can schedule, run, and evaluate interviews securely.
- Sensitive candidate and interview data is properly protected.
- Operators can monitor, debug, and recover from failures quickly.
- The system behaves predictably under real usage, not just ideal demo conditions.
