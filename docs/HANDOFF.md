# Session handoff

**Written:** 2026-08-01
**Repo state at writing:** `main` = `2b5a14b`, 11 PRs merged, none open, 63 tests
passing.

Point a new session at this file and it should be able to continue without the
prior conversation.

---

## 1. What this project is

**Commit** — a technical interview platform. Next.js 16 (App Router, Turbopack,
`output: "standalone"`), React 18, Convex, Clerk, Stream video, Monaco editor,
Tailwind v4, shadcn.

Runs on a private VM: 4-core ARM, 24 GB RAM, 200 GB disk. Portainer stack, host
nginx → `127.0.0.1:3000`, images built by GitHub Actions on `ubuntu-24.04-arm`
and pushed to GHCR. Live at `commit.kunjdeveloper.me`.

**The goal that started this work:** open it to the public safely, watch what the
box can take, keep users out of each other's data, and stop new users landing on
a dead page.

---

## 2. Environment facts you will need

| Thing | Value |
|---|---|
| Convex production | `incredible-horse-821` |
| Convex dev | `famous-donkey-99` (this is what `.env.local` points at) |
| `OWNER_EMAILS` | `kunjhirapara2@gmail.com`, set on **both** deployments |
| `CONVEX_DEPLOY_KEY` | Set as a GitHub secret, **deploy-only scope** |
| GHCR package | **Public** — no registry credentials needed to pull |
| Portainer | **Community Edition** — stack webhooks are a Business feature, hence Watchtower |
| Clerk | **Still on development keys.** A production instance is outstanding |
| Git remote | Repo renamed `kunjhirapara/codesync` → `kunjhirapara/commit`; pushes still show the old URL |

---

## 3. Conventions that were learned the hard way

These are not preferences. Each one came from something going wrong.

- **Never use git worktrees.** The user asked for this explicitly and firmly
  after a worktree was created without permission. Work in `D:\Projects\Commit`
  on normal branches.
- **No `Co-Authored-By` and no "Generated with Claude Code"** in commits or PR
  bodies. History was rewritten once to strip them.
- **Do not spawn subagents unless asked.** Skills that want to fan out (impeccable
  with 18 agents, claude-seo with 18) run in-thread instead, and the substitution
  is disclosed.
- **Always confirm a new branch is off `main`.**
  `git log --oneline main..<branch> | wc -l` before opening a PR. This was got
  wrong twice: once it shipped the entire proctoring feature inside PR #8, which
  was described only as an auth fix.
- **Do not `rm -rf .next` while a dev server is running on :3000.** Check
  `netstat -ano | grep :3000` first. If only stale types are the problem, delete
  `.next/dev/types` alone.
- **Convex codegen syncs only the deployment in `.env.local`** (dev). Production
  is only touched by `npx convex deploy`, which now runs in CI.
- **Tailwind v4**: the important modifier is a suffix (`bg-primary!`), not a
  prefix.
- **Tests** use `node:test` via `node --experimental-strip-types`. Test imports
  need the explicit `.ts` extension or Node's ESM resolver fails.
- `npm run lint` is `tsc --noEmit`. There is no ESLint.
- `npm run ci:validate` = typecheck && test && build.

---

## 4. What shipped (all merged)

| PR | What |
|---|---|
| #1 | Public-launch hardening: closed two unauthenticated Convex mutations, a developer→admin escalation, and an email-bomb vector; landing page, practice sandbox, onboarding; in-app metrics + host exporters; scoped over-broad reads |
| #2 | Accessibility and UX: reduced-motion, coarse-pointer touch targets, global skip link, per-route titles, self-hosted fonts |
| #3 | Split the fat `getAdminDashboard` into three index-bounded queries |
| #4 | Auto-redeploy plumbing and daily dangling-image pruning |
| #5 | Watchtower rollout + Convex deployed ahead of the image in CI |
| #6 | Signed-out visitors redirected to sign-in instead of 404 |
| #7 | Interview integrity monitoring (proctoring) |
| #8 | Refresh no longer bounces off guarded pages — **also accidentally carried #7** |
| #9 | Cross-browser display fallback and Tier B proctoring signals |
| #10 | Real sign-in/sign-up pages, Clerk themed globally |
| #11 | SEO audit |

### Notable design decisions, so they are not re-litigated

- **Owner tier is an env var, not a sixth role.** `OWNER_EMAILS` on the Convex
  deployment. A role lives in a `users` row that admins can already reach; an env
  var cannot be written by the app. Admin-membership rules stay inert until it is
  set, so deploying could not lock the running instance out.
- **Dashboard analytics are 30-day, not all-time**, and the window is rendered in
  the UI. They could not move to a `dailyMetrics` rollup because the figures are
  **per-viewer** — an interviewer sees only their own rounds — and a global
  rollup would report wrong numbers and leak volume to developers.
- **Proctoring is silent but disclosed.** The owner chose silent logging over
  warning the candidate; the pre-join disclosure gate is what makes that
  defensible, so it is required rather than optional.
- **No composite "cheat score".** A single number reads as a verdict. The report
  shows concrete measures plus a severity band with its rule printed beside it.
- **A missing signal must never render as a passed check.** Three states are kept
  distinct: displays "could not be checked", fullscreen "not in use", and
  "monitoring did not run" — each explicitly not the same as clean.
- **Watchtower over SSH-from-CI**, because it needs no inbound access. The VM
  exposes only HTTP, and storing a private key plus opening SSH is real attack
  surface for a convenience.

### Where the design docs live

- `docs/superpowers/specs/2026-08-01-interview-proctoring-design.md`
- `docs/superpowers/specs/2026-08-01-navigation-performance-design.md`
- `docs/superpowers/plans/2026-08-01-navigation-performance.md`
- `docs/seo-audit.md`

---

## 5. Outstanding — start here

### 5a. Two live defects, both documented in `docs/seo-audit.md`

**CRITICAL — `robots.txt` and `sitemap.xml` are behind authentication.**

```
$ curl -sI https://commit.kunjdeveloper.me/robots.txt
HTTP/1.1 307 Temporary Redirect → /signin
```

Google has never read either. The middleware matcher in `src/middleware.ts`
skips static files by extension but does not list `.txt` or `.xml`, and neither
path is in `PUBLIC_ROUTES`. **Fix:** add them to `PUBLIC_ROUTES` (preferred — the
matcher list reads as "static assets" and these are generated routes), or add
`txt|xml` to the matcher.

**CRITICAL — auth redirects point at `0.0.0.0:3000`.**

```
location: /signin?redirect_url=https%3A%2F%2F0.0.0.0%3A3000%2Fdashboard
```

`req.url` in middleware resolves to the container's bind address because the
proxy is not passing a trustworthy `Host`. This is a regression from the sign-in
work: `redirect_url` exists so an expired session returns you where you were, and
in production it silently cannot. **Not a security hole** — the open-redirect
guard rejects non-relative targets and falls back to `/`. **Fix:** either set
`proxy_set_header Host $host;` in the VM's nginx, or build the redirect from
`NEXT_PUBLIC_APP_URL` instead of `req.url` (preferred — no proxy dependency).

### 5b. Owner actions nobody else can do

1. **One-time Portainer stack redeploy.** `watchtower` and `image-gc` are in
   `docker-compose.yml` but are not running on the VM yet. This is also what
   pulls the current image. After it, rollout is automatic.
2. **A second, Backups-scoped Convex key** for the backup worker. Compose passes
   a variable also named `CONVEX_DEPLOY_KEY` to it for `npx convex export`; the
   GitHub one is deploy-only and will not export. Same variable name, different
   value, set in the Portainer stack env.
3. **Rotate `STREAM_SECRET_KEY` and `CLERK_WEBHOOK_SECRET`.** An earlier version
   of `convex/observability.ts` logged both into Convex function logs on every
   developer-dashboard load. Treat the current values as compromised.
4. **Move Clerk to a production instance.** Still on development keys — this is
   what produces the "Development mode" banner on the sign-in page.

### 5c. Verification that needs a human with two accounts

- **Proctoring has never been exercised end to end.** Nobody has confirmed that a
  5s tab switch yields one event rather than two, that a 500-character paste
  registers, or — the premise of the feature — that **the interviewer sees events
  while the candidate sees nothing**. Also worth loading it in Firefox, where the
  report should read "could not be checked" rather than showing a clean
  multi-monitor result.
- **The candidate-refused authorization path.** Role gating moved from middleware
  to `RoleGuard`; a `candidate` hitting `/dashboard`, `/dashboard/team`,
  `/schedule` and `/recordings` should be bounced to `/`.
- **The sign-in page in a browser, in light and dark.** Two rounds of fixes were
  driven by a screenshot; it has still not been seen rendered.

### 5d. SEO backlog, ranked in `docs/seo-audit.md`

High: no canonicals anywhere, no structured data (JSON-LD), no `llms.txt`.
Medium: no AI-crawler directives, thin legal-page metadata, no sitemap
`lastModified`. Low: no IndexNow, and `NEXT_PUBLIC_APP_URL` falling back to
localhost.

Explicitly **not** recommended, with reasons in the audit: metadata on the ~16
auth-gated routes, `keywords` meta.

---

## 6. Known-good commands

```bash
npm run ci:validate                      # typecheck && test && build
npm test                                 # 63 tests
npx convex codegen --typecheck disable   # after adding a Convex module (dev only)
npm run runner:digests                   # refresh pinned code-runner image digests
docker compose config --services         # should list app, backup, image-gc, watchtower
```

---

## 7. Installed skills worth knowing about

- `impeccable` — design/UI critique. Ships hooks that fire on every edit; they
  were deliberately **not** registered.
- `taste-skill`, `ui-ux-pro-max` — UI/design guidance.
- `claude-seo` — 25 SEO sub-skills + 18 agents, installed under
  `~/.claude/skills/seo*`. Its `install.sh` was read before running; it copies
  hooks but does not register them.
- `seo-geo-opc` — the opc-skills GEO skill, renamed because `claude-seo` ships
  its own `seo-geo`.

---

## 8. Honest notes on what went wrong

Recorded so the next session does not repeat them:

- Proctoring shipped inside PR #8, which was titled and described as a scoped
  auth fix, because the branch was cut from `proctoring-spec` instead of `main`.
  It bypassed the review and the manual verification that had deliberately been
  left outstanding.
- Two "completion" claims were wrong and only caught by re-auditing: the
  cross-browser display fallback was written, tested, and never called; and
  `getCandidateProctoringHistory` shipped with no UI. Tests passing is not
  evidence that a code path runs.
- Three regressions were introduced by changes in this session and then fixed:
  the signed-out 404, the refresh-to-home bounce, and the `0.0.0.0` redirect
  (still open). All three came from moving auth out of middleware.
