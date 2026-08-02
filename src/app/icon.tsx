import { ImageResponse } from "next/og";
import { BrandMark } from "@/lib/brandMark";

export const runtime = "nodejs";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/**
 * The browser-tab icon. PageSpeed reported no 32x32 favicon; the repo shipped
 * only the default Next.js favicon.ico, which is Next's mark rather than ours.
 */
export default function Icon() {
  return new ImageResponse(BrandMark({ size: size.width }), size);
}
