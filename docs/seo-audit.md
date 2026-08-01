# SEO audit — commit.kunjdeveloper.me

**Date:** 2026-08-01
**Method:** `claude-seo` (AgricIDaniel) and `seo-geo` (ReScienceLab/opc-skills),
applied in-thread against the live site rather than inferred from source.

## Read this first

The audit found two live defects that outrank every metadata improvement in this
document. Neither is a missing tag; both mean search engines cannot do their job
at all.

### CRITICAL 1 — `robots.txt` and `sitemap.xml` are behind authentication

```
$ curl -sI https://commit.kunjdeveloper.me/robots.txt
HTTP/1.1 307 Temporary Redirect
location: /signin?redirect_url=...%2Frobots.txt
```

Both files redirect to the sign-in page. **Google has never read either one.**
Every crawl directive and the entire sitemap are invisible, which makes most of
the rest of this audit academic until it is fixed.

**Cause.** The middleware matcher in `src/middleware.ts` skips static files by
extension — `html, css, js, jpe?g, webp, png, gif, svg, ttf, woff2?, ico, csv,
docx?, xlsx?, zip, webmanifest` — but **not `.txt` or `.xml`**. Neither path is
in `PUBLIC_ROUTES` either, so `auth.protect()` catches them.

This predates the recent middleware work: the previous version applied
`auth.protect()` under the same condition. What changed is the symptom — a 307
to `/signin` where it used to be a 404. It was broken either way.

**Fix.** Add `robots.txt`, `sitemap.xml` and `llms.txt` to `PUBLIC_ROUTES`, or
add `txt|xml` to the matcher's extension list. The `PUBLIC_ROUTES` route is
preferable: the matcher exclusion is easy to read as "static assets", and these
are generated routes rather than files on disk.

**Verify after fixing:** `curl -sI …/robots.txt` returns `200`, and the body is
the directive list rather than HTML.

### CRITICAL 2 — auth redirects point at `0.0.0.0:3000`

```
$ curl -sI https://commit.kunjdeveloper.me/dashboard
location: /signin?redirect_url=https%3A%2F%2F0.0.0.0%3A3000%2Fdashboard
```

The `redirect_url` carries the container's internal bind address instead of the
public origin. `req.url` inside middleware resolves to `0.0.0.0:3000` because the
host nginx is not passing a `Host` header the app can trust.

**This is a regression from the recent sign-in work** — that feature added
`redirect_url` so an expired session returns you to where you were, and in
production it cannot work.

It is not a security hole: the sign-in page rejects non-relative redirect targets
(the open-redirect guard), so it silently falls back to `/`. The feature is dead
rather than dangerous.

**Fix.** Two options, and the second is the more robust:

1. Set `proxy_set_header Host $host;` in the VM's nginx. The reference config at
   `nginx/conf.d/default.conf` already does this, but the running config is the
   operator's own and evidently does not.
2. Build the redirect from `NEXT_PUBLIC_APP_URL` rather than `req.url`. That
   removes the dependency on proxy headers entirely and is inside this repo's
   control.

**Verify after fixing:** the `location` header names `commit.kunjdeveloper.me`.

## What is already right

Worth stating, because the list below is otherwise all problems.

- **Metadata is server-rendered.** `title`, `og:title`, `og:description`,
  `og:url`, `og:site_name` and `og:image` are all present in the initial HTML
  with the correct production domain — no JavaScript required. Per Google's
  December 2025 JavaScript SEO guidance, this is exactly right; canonical and
  robots directives injected by JS are unreliable.
- **Security headers are strong.** HSTS with `preload` and a two-year max-age,
  `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: strict-origin-when-cross-origin`, a scoped
  `Permissions-Policy`, and no `X-Powered-By`.
- **The OG image is generated at build**, so the card cannot drift from the
  product copy the way a committed PNG does.
- **Auth-gated routes are correctly excluded** from the sitemap and disallowed in
  robots.txt. That judgement is right and should not change.
- **`/signin` and `/signup` are `noindex`**, which is correct.

## Findings, ranked

Ranking matters more than completeness here. There are **four indexable pages**:
`/`, `/terms`, `/privacy`, `/recording-disclosure`. A long undifferentiated
checklist would misrepresent where effort belongs.

### High

**H1. No canonical URLs anywhere.** `alternates.canonical` appears nowhere, and
the live HTML has no `rel="canonical"`. With `metadataBase` already set, this is
a one-line addition per route. It matters most for `/`, which is reachable as
both apex and `www` if DNS allows.

**H2. No structured data.** No JSON-LD anywhere. For this product the useful
types are `SoftwareApplication` (or `WebApplication`) plus `Organization` on the
landing page. This is the single largest *additive* opportunity: it feeds rich
results and is disproportionately used by AI search engines when deciding what a
site is.

**H3. No `llms.txt`.** Returns 307 today, and would 404 once Critical 1 is fixed
because the file does not exist. Both installed skills treat it as the emerging
convention for telling AI crawlers what a site is and which pages matter. Cheap
to add and directly relevant to a product whose audience searches through AI
tools.

### Medium

**M1. No AI-crawler directives in robots.txt.** No rules for `GPTBot`,
`ClaudeBot`, `PerplexityBot`, `Google-Extended`, `CCBot`. Not a defect — the
default is to allow, which for a product wanting AI-search visibility is
probably what you want. Worth an explicit decision rather than an accident, and
worth recording in the file so the next reader knows it was chosen.

**M2. Legal pages carry only inherited metadata.** `/terms`, `/privacy` and
`/recording-disclosure` have titles and descriptions but no canonical and no
page-specific OG. Low traffic value; cheap to complete.

**M3. Sitemap has no `lastModified`.** Present in `sitemap.ts` as a field Next
supports but the file does not set. Helps crawlers prioritise recrawls.

**M4. No `viewport` export, `themeColor`, or web manifest.** The viewport meta is
supplied by Next's default, so mobile rendering is fine; `themeColor` and a
manifest are polish, and only worth it if you want installability.

### Low

**L1. No IndexNow.** Bing, Yandex and Naver support it; Google does not. Given
four pages that rarely change, the payoff is close to zero.

**L2. `NEXT_PUBLIC_APP_URL` falls back to `http://localhost:3000`** in
`robots.ts`, `sitemap.ts` and `metadataBase`. Production is correct today because
it is passed as a build arg, but nothing fails the build if it goes missing, and
the failure mode — a sitemap and canonicals pointing at localhost — is silent and
severe. A build-time assertion would remove the class of problem.

## Deliberately not recommended

- **Metadata on auth-gated routes.** Around sixteen routes require a session and
  are disallowed in robots.txt. Adding canonicals and OG tags there is work no
  crawler will ever see. The per-route titles those pages already have are worth
  keeping — they serve browser tabs and history, not search.
- **`keywords` meta.** Google has ignored it for over a decade.
- **`seo-local`, `seo-ecommerce`, `seo-hreflang`, `seo-drift`.** No physical
  location, no storefront, one language, no historical baseline. Running them
  would produce findings that do not apply.
- **Blocking AI crawlers.** For a product that benefits from being cited by AI
  tools, blocking them trades away distribution for very little.

## Sub-skills used

Ran: `seo-technical` (the audit above), with `seo-schema` and `seo-geo` informing
H2 and H3.

Skipped, with cause: `seo-local` (no location), `seo-ecommerce` (no store),
`seo-hreflang` (single language), `seo-drift` (no baseline), `seo-backlinks`,
`seo-dataforseo`, `seo-google`, `seo-maps` (all need API credentials that are not
configured).

## Suggested order

1. Critical 1 and Critical 2. Nothing else matters while robots.txt is
   unreachable and redirects are broken.
2. H1 canonicals, H2 structured data, H3 `llms.txt`.
3. M1 through M4 as convenient.
4. L1 and L2 only if they become relevant.
