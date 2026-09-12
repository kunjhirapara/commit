# Email provider setup

**Provider:** Resend (free tier)
**Status:** working end to end on a throwaway SMTP account; swap in Resend credentials for production.
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

Going live is therefore a credential swap, not an integration: replace three
values in both places, publish the DNS records Resend generates, and re-run the
same two verification commands.

## Why this exists

Commit sends interview invitations, reminders, reschedule and cancellation
notices, and role invitations. After the Auth.js migration it will also send
password resets and magic links, which turns email from a convenience into part
of the login path: mail that silently lands in spam becomes users who cannot get
into the product.

SendGrid was the obvious choice until [Twilio retired its free plan on 27 May
2025](https://www.twilio.com/en-us/changelog/sendgrid-free-plan). New accounts
get a 60-day trial and then $19.95/month.

## Why Resend, and what it costs us

| Option | Free tier | Verdict |
| --- | --- | --- |
| **Resend** | 3,000/mo, **100/day cap**, 1 domain | **Chosen.** No branding on sent mail, transactional-only infrastructure, better API. |
| Brevo | 300/day (~9,000/mo) | Higher ceiling, but stamps its own branding on free-plan mail and shares IP pools with marketing senders. |
| SMTP2GO | 1,000/mo | Five days of reporting history on free. |
| MailerSend | 500/mo | Cut from 3,000 in December 2025. |
| Amazon SES | ~$0.10/1,000 | Not free, ~$0.30/month at this volume. Best deliverability, worst setup. Revisit at scale. |

Brevo was the initial pick, on the strength of its 300/day ceiling against the
Auth.js migration's one-time password-reset mail-out. That reasoning was too
narrow: **the burst is one-time, the branding is permanent.** A password reset
carrying a third-party logo reads as less trustworthy exactly when trust matters
most, since users are already primed to treat unexpected auth mail as phishing.

Resend's shared IP pools also carry only transactional mail. Brevo's carry
marketing blasts too, and a noisy neighbour on a shared IP affects everyone on it.

### The 100/day cap, and how to survive the migration

3,000/month ÷ 30 is exactly 100/day, so the daily cap is not headroom on top of
the monthly figure — it *is* the monthly figure spread evenly. You cannot burst.

Task 15 of the Auth.js migration emails every existing user a set-your-password
link at once, because Clerk password hashes cannot be exported. Two ways through:

1. **Stagger it** over two or three days. It is a migration, not an outage, and
   OAuth and magic-link users need no reset at all.
2. **Pay for one month** of Resend Pro ($20), then drop back to free.

Both cost less than permanently branding every auth email.

**Also know:** the free tier allows exactly one verified sending domain. Wanting
separate staging and production senders moves you to Pro on its own.

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

The saving is roughly zero, because the free tier covers this volume. The cost
is an ongoing liability against the domain's reputation.

## Current DNS (verified 2026-09-12)

`kunjdeveloper.com` is on Cloudflare nameservers and already sends mail properly:

| Record | Value | Meaning |
| --- | --- | --- |
| MX | `mx.zoho.in`, `mx2`, `mx3` | Mailboxes are hosted at Zoho |
| SPF | `v=spf1 include:zoho.in ~all` | Authorises Zoho only |
| DKIM | `zmail._domainkey` present | Zoho's selector — note it is `zmail`, not `zoho` |
| DMARC | `v=DMARC1; p=none; rua=...@gmail.com; sp=none` | Monitoring only |

`commit.kunjdeveloper.com` has no mail records of its own.

**Human mailboxes are already solved.** Zoho covers `you@kunjdeveloper.com`.
Nothing below changes that, and app mail must not be sent through those mailbox
credentials: free Zoho mailboxes have low daily send caps and terms that exclude
automated bulk sending, and sharing one identity means an app incident damages
the reputation of your personal correspondence too.

## The plan

Send app mail as **`notifications@commit.kunjdeveloper.com`** — the app's own
subdomain, which Resend also recommends over an apex domain, so that app
reputation and human-mail reputation stay independent.

### 1. Create the Resend account and add the domain

Sign up at resend.com, then **Domains → Add Domain** and enter
`commit.kunjdeveloper.com`. This step cannot be automated; it needs a real
mailbox and account ownership.

### 2. Publish the DNS records Resend generates

Resend shows the exact records once the domain is added. The values are
account- and region-specific, so they cannot be written here in advance, but
the shape is:

| Type | Name | Value |
| --- | --- | --- |
| MX | `send.commit.kunjdeveloper.com` | `feedback-smtp.<region>.amazonses.com`, priority 10 |
| TXT | `send.commit.kunjdeveloper.com` | `v=spf1 include:amazonses.com ~all` |
| TXT | `resend._domainkey.commit.kunjdeveloper.com` | `p=<generated key>` |

Add them in Cloudflare, **proxy disabled** (MX and TXT are never proxied).

**Your existing SPF record is not touched.** This is worth being explicit about,
because merging SPF records wrongly is the classic way to break a working
domain. Resend's SPF goes on `send.commit.kunjdeveloper.com`, which has no SPF
record today — it is a new record on a new name, not an edit to the root's
`include:zoho.in`. SPF is per-name, and a domain may have exactly one SPF record
*per name*; two on the same name is a permanent error, not a longer list.

Likewise the new MX on `send.commit.kunjdeveloper.com` does not affect the Zoho
MX on the root: different names, independent records.

Resend puts SPF on that subdomain rather than the From domain because SPF is
checked against the envelope return-path, not the visible From address. This is
also why `scripts/verify-email.mjs` checks both names.

### 3. Add a DMARC record for the sending domain (optional)

| Type | Name | Value |
| --- | --- | --- |
| TXT | `_dmarc.commit.kunjdeveloper.com` | `v=DMARC1; p=none; rua=mailto:kunjhirapara2@gmail.com` |

Resend does not require it. The root record's `sp=none` already covers
subdomains permissively, so this changes no delivery behaviour. What it buys is
reports scoped to app mail rather than mixed in with Zoho's.

### 4. Create an API key

Resend: **API Keys → Create API Key**, with send permission. It begins `re_`.
This doubles as the SMTP password; there is no separate SMTP credential.

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
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=resend
SMTP_PASS=<your re_ API key>
SMTP_FROM_NAME=Commit
SMTP_FROM_EMAIL=notifications@commit.kunjdeveloper.com
```

`SMTP_USER` is the literal string `resend`, not an email address. Port 587 is
STARTTLS, so `SMTP_SECURE=false`; use `true` only with 465 or 2465.

**Convex** — the same seven values, on each deployment:

```bash
npx convex env set SMTP_HOST smtp.resend.com
npx convex env set SMTP_PORT 587
npx convex env set SMTP_SECURE false
npx convex env set SMTP_USER resend
npx convex env set SMTP_PASS <your re_ API key>
npx convex env set SMTP_FROM_NAME Commit
npx convex env set SMTP_FROM_EMAIL notifications@commit.kunjdeveloper.com
```

**No application code changes.** Both transports speak plain SMTP through
nodemailer, so the provider is entirely a matter of configuration.

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

DNS propagation can take up to 24 hours. Warnings about missing SPF or DKIM
before then are expected and disappear once the records resolve.

## Rollback

Clear the `SMTP_*` variables in both runtimes. In production the app now refuses
to send and reports failure rather than silently reporting success; in
development it falls back to logging. The DNS records are inert once nothing
sends through Resend, and can be deleted at leisure.

## Related change

`src/lib/email/transport.ts` previously returned `success: true` and logged
whenever SMTP was unconfigured — in production as well as development. That made
a missing deploy secret an invisible outage: the app reported sends that never
happened. It now fails loudly in production and keeps the logging fallback only
outside it. See `src/lib/email/mode.ts`.
