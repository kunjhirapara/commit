import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "Commit — technical interviews with a live code editor";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Generated at build time rather than committed as a binary, so the card stays in
 * step with the product copy. Next wires the og:image/twitter:image tags from this
 * file convention automatically.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#09090b",
          color: "#fafafa",
          fontFamily: "sans-serif",
        }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            fontSize: 40,
            fontWeight: 700,
            color: "#f97316",
          }}>
          {"</>"} Commit
        </div>

        <div
          style={{
            marginTop: "32px",
            fontSize: 68,
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            maxWidth: "900px",
          }}>
          Technical interviews with a live code editor
        </div>

        <div
          style={{
            marginTop: "28px",
            fontSize: 30,
            color: "#a1a1aa",
            maxWidth: "880px",
          }}>
          Video, a shared editor, and a sandboxed runner for JavaScript, Python
          and Java.
        </div>
      </div>
    ),
    size,
  );
}
