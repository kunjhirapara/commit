# Email provider setup

**Status:** working end to end on a throwaway SMTP account; swap in Brevo credentials for production.
**Date:** 2026-09-12

## Current state

Both send paths are configured and proven, against **Ethereal** — a real SMTP
server that needs no signup and *captures* messages instead of delivering them.
It exists to prove the plumbing, not to serve production: nothing it accepts
reaches a real inbox.

| | Configured | Proven by |
| --- | --- | --- |
| Next.js (`.env.local`) | yes | `scripts/verify-email.mjs --send` accepted a message |
| Convex (dev deployment) | yes | `checkEmailHealth` → `verified: true`; a role-invitation email sent and accepted |

Going live is therefore a credential swap, not an integration: replace
`SMTP_HOST`, `SMTP_USER` and `SMTP_PASS` in both places with Brevo's, publish
two DNS records, and re-run the same two verification commands. Everything else
is already in place and tested.

## Why this exists

Commit sends interview invitations, reminders, reschedule and cancellation
notices, and role invitations. After the Auth.js migration it will also send
password resets and magic links, which turns email from a convenience into part
of the login path: mail that silently lands in spam becomes users who cannot get
into the product.

SendGrid was the obvious choice until [Twilio retired its free plan on 27 May
2025](https://www.twilio.com/en-us/changelog/sendgrid-free-plan). New accounts
get a 60-day trial and then $19.95/month.

## What was chosen, and what was rejected

**Brevo**, free tier, over SMTP.

| Option | Free tier | Why not chosen |
| --- | --- | --- |
| **Brevo** | 300/day (~9,000/mo) | **Chosen.** Highest daily ceiling of the free tiers. |
| Resend | 3,000/mo, 100/day cap | Better developer experience, but the 100/day cap throttles the migration's one-time password-reset mail-out. Reconsider if the user count stays under ~80. |
| SMTP2GO | 1,000/mo | Only five days of reporting history on free. |
| MailerSend | 500/mo | Cut from 3,000 in December 2025. Too tight. |
| Amazon SES | ~$0.10/1,000 | Not free, though ~$0.30/month at this volume. Best deliverability, worst setup effort. Worth revisiting at scale. |

The daily cap is the deciding factor, and it is specific to us: Task 15 of the
Auth.js migration emails *every existing user* a set-your-password link at once,
because Clerk password hashes cannot be exported. A 100/day cap turns that into
a multi-day dribble during which some users cannot sign in at all.

### Self-hosting was considered and rejected

The VM could run Postfix. For outbound transactional mail it is the wrong tool:

- Port 25 egress is blocked by default on most VPS providers, and unblock
  requests from new accounts are frequently refused.
- A new IP has no sending reputation. Gmail and Outlook need weeks of steady
  volume to warm one up — volume a low-traffic interview app cannot produce.
- Many VPS ranges sit on Spamhaus PBL before you send a single message.
- The failure is silent. Mail is accepted and then filed as spam, so nothing in
  the application logs distinguishes it from success.
- It is permanent work: PTR, DKIM rotation, DMARC reports, blocklist
  monitoring, bounce handling.

The saving is roughly zero, because the free tiers cover this volume. The cost
is an ongoing liability against the domain's reputation.

## Current DNS (verified 2026-09-12)

`kunjdeveloper.com` is on Cloudflare nameservers and already sends mail properly:

| Record | Value | Meaning |
| --- | --- | --- |
| MX | `mx.zoho.in`, `mx2`, `mx3` | Mailboxes are hosted at Zoho |
| SPF | `v=spf1 include:zoho.in ~all` | Authorises Zoho only |
| DKIM | `zmail._domainkey` present | Zoho's selector — note it is `zmail`, not `zoho` |
| DMARC | `v=DMARC1; p=none; rua=...@gmail.com; sp=none` | Monitoring only |

`commit.kunjdeveloper.com` has no SPF, DKIM or DMARC of its own.

**Human mailboxes are already solved.** Zoho covers `you@kunjdeveloper.com`.
Nothing below changes that, and app mail must not be sent through those mailbox
credentials: free Zoho mailboxes have low daily send caps and terms that exclude
automated bulk sending, and sharing one identity means an app incident damages
the reputation of your personal correspondence too.

## The plan

Send app mail as **`notifications@mail.commit.kunjdeveloper.com`** — a dedicated
subdomain, so app reputation and human-mail reputation are independent.

### 1. Create the Brevo account

Sign up at brevo.com and verify the address. This step cannot be automated; it
needs a real mailbox and account ownership.

### 2. Authenticate the sending subdomain

In Brevo: **Senders, Domains & Dedicated IPs → Domains → Add a domain**, and
enter `mail.commit.kunjdeveloper.com`.

Brevo then shows two records to publish. Both values are generated per account,
so they cannot be written here in advance:

| Type | Name | Value |
| --- | --- | --- |
| TXT | `mail.commit.kunjdeveloper.com` | `brevo-code:<generated>` |
| TXT | `mail._domainkey.mail.commit.kunjdeveloper.com` | `v=DKIM1; k=rsa; p=<generated>` |

Add them in Cloudflare DNS, **proxy disabled** (TXT records are never proxied).

**No SPF change is required.** Brevo authenticates the envelope sender against
its own domain on shared IPs, and only asks for an SPF include when you move to
a dedicated IP. The existing `include:zoho.in` record stays exactly as it is.

`mail._domainkey` was checked and is currently unused on this domain, so it does
not collide with Zoho's `zmail._domainkey`.

### 3. Add a DMARC record for the subdomain (optional but worth it)

| Type | Name | Value |
| --- | --- | --- |
| TXT | `_dmarc.mail.commit.kunjdeveloper.com` | `v=DMARC1; p=none; rua=mailto:kunjhirapara2@gmail.com` |

The root record's `sp=none` already covers subdomains permissively, so this
changes no delivery behaviour. What it buys is reports scoped to app mail
specifically, rather than mixed in with Zoho's.

### 4. Get the SMTP key

Brevo: **SMTP & API → SMTP**. The login is your Brevo account email; the
password is the generated **SMTP key**, not your account password.

### 5. Set the environment — in **two** places

This is the step most likely to be half-done, because the app sends mail from
two runtimes that do not share configuration:

- `src/lib/email/transport.ts` runs in **Next.js** and serves the API routes.
- `convex/notifications/emailActions.ts` runs on **Convex's servers** and has
  its own nodemailer transport. Convex functions cannot read Next's
  environment.

Setting only one gives a system that appears to work while half its mail
silently fails — and the Convex half is the one that sends interview
invitations and reminders.

**Next.js** — `.env.local` locally, deploy secrets in production:

```
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<your brevo account email>
SMTP_PASS=<the generated SMTP key>
SMTP_FROM_NAME=Commit
SMTP_FROM_EMAIL=notifications@mail.commit.kunjdeveloper.com
```

**Convex** — the same seven values, on each deployment:

```bash
npx convex env set SMTP_HOST smtp-relay.brevo.com
npx convex env set SMTP_PORT 587
npx convex env set SMTP_SECURE false
npx convex env set SMTP_USER <your brevo account email>
npx convex env set SMTP_PASS <the generated SMTP key>
npx convex env set SMTP_FROM_NAME Commit
npx convex env set SMTP_FROM_EMAIL notifications@mail.commit.kunjdeveloper.com
```

Port 587 with `SMTP_SECURE=false` is correct — that is STARTTLS, which upgrades
to TLS after connecting. Setting `true` on 587 makes the handshake fail. Use
`true` only with port 465.

**No application code changes.** `src/lib/email/transport.ts` speaks plain SMTP
through nodemailer, so the provider is entirely a matter of configuration.

### 6. Verify — again, both runtimes

```bash
# Next.js side: DNS authentication, credentials, and a real message.
node scripts/verify-email.mjs
node scripts/verify-email.mjs --send you@example.com

# Convex side: its own transport, which the script above cannot reach.
npx convex run notifications/emailActions:checkEmailHealth '{}'
# expect: { "configured": true, "service": "email", "verified": true }
```

The whole path was exercised this way against a throwaway SMTP account before
any provider was chosen, so both commands are known to work: `checkEmailHealth`
returned `verified: true`, and a role-invitation email sent through
`sendRoleInvitationEmail` was accepted with a message id on the configured
sending domain.

Then open the delivered message and check its headers show `dkim=pass` and
`spf=pass`. Nothing automated can confirm inbox placement — only a human
looking at a real inbox can.

## Rollback

Clear the `SMTP_*` variables. In production the app now refuses to send and
reports failure rather than silently reporting success; in development it falls
back to logging. The DNS records are inert once nothing sends through Brevo, and
can be deleted at leisure.

## Related change

`src/lib/email/transport.ts` previously returned `success: true` and logged
whenever SMTP was unconfigured — in production as well as development. That made
a missing deploy secret an invisible outage: the app reported sends that never
happened. It now fails loudly in production and keeps the logging fallback only
outside it. See `src/lib/email/mode.ts`.
