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
        source: "/meeting/:path*",
        headers: [
          {
            key: "Permissions-Policy",
            value:
              "camera=(self), microphone=(self), display-capture=(self), geolocation=()",
          },
        ],
      },
      {
        source: "/((?!meeting/).*)",
        headers: [
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), display-capture=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
