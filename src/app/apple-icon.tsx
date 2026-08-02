import { ImageResponse } from "next/og";
import { BrandMark } from "@/lib/brandMark";

export const runtime = "nodejs";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * Without this, iOS screenshots the page when someone adds Commit to their home
 * screen, which is never what you want representing the app.
 */
export default function AppleIcon() {
  return new ImageResponse(BrandMark({ size: size.width }), size);
}
