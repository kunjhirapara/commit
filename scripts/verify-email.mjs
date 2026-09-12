/**
 * Email preflight: does this deployment actually send authenticated mail?
 *
 *   node scripts/verify-email.mjs
 *   node scripts/verify-email.mjs --send you@example.com
 *
 * Checks three things that fail independently and, between them, account for
 * most "the email never arrived" incidents:
 *
 *   1. DNS authentication (SPF, DKIM, DMARC) for the address we send *from*.
 *      Mail without these is accepted by the relay and then quietly filed as
 *      spam by the recipient, so nothing in the app's logs looks wrong.
 *   2. SMTP credentials actually authenticate against the relay.
 *   3. Optionally, a real message arrives.
 *
 * Run it after changing provider, credentials, or DNS. It is deliberately not
 * part of `npm test`: it needs live DNS and a live relay.
 */

import fs from "node:fs";
import process from "node:process";

// --- env ---------------------------------------------------------------------

const loadEnv = (file) => {
  if (!fs.existsSync(file)) return;
  const raw = fs.readFileSync(file, "utf8");
  const re = /^([A-Z_][A-Z0-9_]*)=(?:"([\s\S]*?)"|(.*))$/gm;
  let m;
  while ((m = re.exec(raw)) !== null) {
    const value = (m[2] !== undefined ? m[2] : m[3]).trim();
    if (!(m[1] in process.env)) process.env[m[1]] = value;
  }
};

loadEnv("./.env.local");

// --- dns ---------------------------------------------------------------------

const resolveTxt = async (name) => {
  const res = await fetch(
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=TXT`,
    { headers: { accept: "application/dns-json" } },
  );
  if (!res.ok) return [];
  const json = await res.json();

  return (json.Answer ?? []).map((a) => a.data.replace(/^"|"$/g, "").replace(/" "/g, ""));
};

/**
 * Selectors the common relays publish under.
 *
 * Selectors are chosen by the sender, not fixed by the protocol, so a miss here
 * means "not found under a known name" rather than "no DKIM". Zoho is the
 * reason this list is explicit: it publishes under `zmail`, not `zoho`, and
 * guessing the obvious name reports a false alarm on a correctly configured
 * domain.
 */
const DKIM_SELECTORS = [
  ["brevo", "mail._domainkey"],
  ["resend", "resend._domainkey"],
  ["amazon ses", "dkim._domainkey"],
  ["zoho", "zmail._domainkey"],
  ["google", "google._domainkey"],
  ["smtp2go", "s1._domainkey"],
  ["smtp2go alt", "s2._domainkey"],
  ["microsoft", "selector1._domainkey"],
];

// --- report ------------------------------------------------------------------

let problems = 0;
const ok = (m) => console.log(`  ok       ${m}`);
const warn = (m) => console.log(`  warning  ${m}`);
const bad = (m) => {
  problems += 1;
  console.log(`  PROBLEM  ${m}`);
};

const main = async () => {
  const fromEmail = process.env.SMTP_FROM_EMAIL;

  if (!fromEmail) {
    bad("SMTP_FROM_EMAIL is unset — cannot tell which domain to check.");
    process.exit(1);
  }

  const domain = fromEmail.split("@")[1];
  console.log(`\nSending identity: ${fromEmail}\nDomain checked:   ${domain}\n`);

  // 1. SPF
  console.log("SPF");
  const txt = await resolveTxt(domain);
  const spf = txt.filter((r) => r.toLowerCase().startsWith("v=spf1"));

  if (spf.length === 0) {
    bad(`no SPF record on ${domain} — receivers cannot confirm the relay may send as you.`);
  } else if (spf.length > 1) {
    // This is the classic self-inflicted outage: two SPF records is not "more
    // SPF", it is a permerror, and receivers treat the domain as unauthenticated.
    bad(`${spf.length} SPF records on ${domain}. More than one is a permanent error — merge them into a single record.`);
  } else {
    ok(spf[0]);
    if (/-all\s*$/.test(spf[0])) {
      warn("policy is -all (hard fail). Correct once every sender is listed; locks out any you forgot.");
    }
  }

  // 2. DKIM
  console.log("\nDKIM");
  let foundDkim = false;
  for (const [label, selector] of DKIM_SELECTORS) {
    const records = await resolveTxt(`${selector}.${domain}`);
    if (records.some((r) => r.includes("p="))) {
      ok(`${label} selector present (${selector}.${domain})`);
      foundDkim = true;
    }
  }
  if (!foundDkim) {
    // Stated as "not found under known selectors" rather than "no DKIM",
    // because the selector is the sender's choice and this list cannot be
    // exhaustive. Confirm in the provider's dashboard before acting on it.
    warn(
      `no DKIM key found on ${domain} under the selectors this script knows. ` +
        `Either it is not configured, or it uses a custom selector — check the provider's dashboard.`,
    );
  }

  // 3. DMARC
  console.log("\nDMARC");
  const dmarc = (await resolveTxt(`_dmarc.${domain}`)).filter((r) =>
    r.toLowerCase().startsWith("v=dmarc1"),
  );

  if (dmarc.length === 0) {
    warn(`no DMARC record on ${domain}. Not fatal, but you get no visibility into what receivers do with your mail.`);
  } else {
    ok(dmarc[0]);
    if (/p=none/.test(dmarc[0])) {
      warn("policy is p=none — monitoring only. Move to quarantine once reports look clean.");
    }
    if (!/rua=/.test(dmarc[0])) {
      warn("no rua= address, so nobody receives the aggregate reports.");
    }
  }

  // 4. SMTP
  console.log("\nSMTP");
  const required = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"];
  const missing = required.filter((k) => !process.env[k]?.trim());

  if (missing.length) {
    bad(`not configured: ${missing.join(", ")}`);
  } else {
    const { default: nodemailer } = await import("nodemailer");
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === "true",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      connectionTimeout: 10_000,
    });

    try {
      await transport.verify();
      ok(`authenticated against ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}`);
    } catch (error) {
      bad(`could not authenticate: ${error.message}`);
    }

    const sendIndex = process.argv.indexOf("--send");
    if (sendIndex !== -1 && process.argv[sendIndex + 1]) {
      const to = process.argv[sendIndex + 1];
      try {
        const info = await transport.sendMail({
          from: `"${process.env.SMTP_FROM_NAME ?? "Commit"}" <${fromEmail}>`,
          to,
          subject: "Commit email preflight",
          html: "<p>If you are reading this, the relay, credentials and sending domain all work.</p><p>Check this message's headers for <code>dkim=pass</code> and <code>spf=pass</code>.</p>",
        });
        ok(`test message accepted for ${to} (id ${info.messageId})`);
        console.log("\n  Now open it and confirm the headers show dkim=pass and spf=pass.");
        console.log("  Delivery to the inbox is the only check that matters, and only you can see it.");
      } catch (error) {
        bad(`send failed: ${error.message}`);
      }
    }
    transport.close();
  }

  console.log(
    problems === 0
      ? "\nNo problems found.\n"
      : `\n${problems} problem(s) found.\n`,
  );
  process.exit(problems === 0 ? 0 : 1);
};

await main();
