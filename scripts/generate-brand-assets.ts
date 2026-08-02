/**
 * Writes the brand PNGs that have to exist as files rather than as routes.
 *
 * Two of them cannot be served by a Next route handler and still do their job:
 * the 120x120 logo is uploaded by hand to the Google Auth Platform consent
 * screen, and the manifest icons are fetched by installers that want stable,
 * cacheable URLs. Generating them from the same BrandMark the favicon and
 * apple-touch icon use is what stops the logo Google verified from drifting
 * away from the one users see.
 *
 * Run: npm run brand:assets
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
// "next/og.js", not "next/og": the bare specifier resolves through Next's
// bundler, and this file runs under plain Node ESM where only the real path
// exists. The app-side files (src/app/icon.tsx and friends) import the bare
// form, because there it is Next doing the resolving.
import { ImageResponse } from "next/og.js";
import { BrandMark } from "../src/lib/brandMark.ts";

/** 120x120 is what Google asks for; the rest feed the web manifest. */
const SIZES = [120, 192, 512];

const OUTPUT_DIR = path.join(process.cwd(), "public", "brand");

const render = async (size: number) => {
  const response = new ImageResponse(BrandMark({ size }), {
    width: size,
    height: size,
  });

  const bytes = Buffer.from(await response.arrayBuffer());
  const file = path.join(OUTPUT_DIR, `logo-${size}.png`);

  await writeFile(file, bytes);

  // Google rejects anything over 1 MB. These land around 2 KB, so this is a
  // tripwire for a future change rather than a live concern.
  if (bytes.byteLength > 1_000_000) {
    throw new Error(
      `logo-${size}.png is ${bytes.byteLength} bytes, over Google's 1 MB limit`,
    );
  }

  console.log(`wrote ${file} (${bytes.byteLength} bytes)`);
};

const main = async () => {
  await mkdir(OUTPUT_DIR, { recursive: true });
  for (const size of SIZES) await render(size);
};

await main();
