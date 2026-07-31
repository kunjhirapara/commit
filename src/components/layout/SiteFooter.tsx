import Link from "next/link";

const LEGAL_LINKS = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/recording-disclosure", label: "Recording disclosure" },
];

/**
 * These pages existed but nothing in the UI linked to them, so in practice they
 * were unreachable. A public deployment that records video calls needs its
 * disclosure and privacy terms one click away from every page.
 */
export default function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border/60">
      <div className="container mx-auto flex flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p>
          <span className="font-mono font-semibold text-foreground">Commit</span>
          {" — "}a side project for running technical interviews.
        </p>

        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {LEGAL_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition-colors hover:text-foreground">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
