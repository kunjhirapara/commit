/**
 * Baseline security headers.
 *
 * Applied here rather than in the host nginx so they survive a proxy config change
 * and are testable locally. Deliberately no CSP yet: Monaco and the Stream SDK both
 * need `unsafe-eval`/`unsafe-inline`, so a CSP written blind would either break the
 * editor or be meaningless. Add one once those sources are enumerated.
 */
const baseSecurityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  poweredByHeader: false,

  async headers() {
    // Next.js applies every matching entry, so the two Permissions-Policy sources
    // below are kept mutually exclusive to avoid emitting the header twice.
    return [
      {
        source: "/:path*",
        headers: baseSecurityHeaders,
      },
      {
        // Meeting routes need camera/mic/screen-share for Stream video.
        //
        // `window-management` is named explicitly and is load-bearing, not
        // boilerplate. Integrity monitoring reads `screen.isExtended` to tell
        // whether a second display is attached, and per the spec a
        // window-management Permissions-Policy makes that property return
        // `false` rather than throwing. Leaving it unnamed works today because
        // the default allowlist is `self`, but a later tightening of this header
        // would silently disable the check in the false-negative direction:
        // every candidate would report as single-screen and nothing would
        // indicate the signal had stopped working.
        source: "/meeting/:path*",
        headers: [
          {
            key: "Permissions-Policy",
            value:
              "camera=(self), microphone=(self), display-capture=(self), window-management=(self), geolocation=()",
          },
        ],
      },
      {
        // No window-management off the meeting routes: nothing else needs it.
        source: "/((?!meeting/).*)",
        headers: [
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), display-capture=(), window-management=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
