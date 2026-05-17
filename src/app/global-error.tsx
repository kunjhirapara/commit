"use client";

import { useEffect } from "react";
import { logError } from "@/lib/errors";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logError("GlobalRootError", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          background: "#0a0a0a",
          color: "#fafafa",
        }}>
        <div
          style={{
            maxWidth: 520,
            padding: "32px 24px",
            textAlign: "center",
          }}>
          <h1 style={{ fontSize: 24, fontWeight: 600, margin: "0 0 8px" }}>
            We hit a snag loading the app
          </h1>
          <p style={{ color: "#a3a3a3", margin: "0 0 24px", lineHeight: 1.5 }}>
            Something went wrong before the page could finish loading. Please
            try again. If the issue persists, contact support.
          </p>
          <button
            onClick={() => reset()}
            style={{
              padding: "10px 20px",
              border: "1px solid #404040",
              borderRadius: 8,
              background: "#fafafa",
              color: "#0a0a0a",
              fontWeight: 600,
              cursor: "pointer",
            }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
