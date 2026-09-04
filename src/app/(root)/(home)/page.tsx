import { auth } from "@clerk/nextjs/server";
import LandingPage from "@/components/marketing/LandingPage";
import AppHome from "./AppHome";

/**
 * `/` serves double duty: the public landing page for signed-out visitors and the
 * app home for signed-in users. Keeping both on one route avoids moving the app
 * home to a new path, which Clerk redirects and every "back home" link point at.
 *
 * The session is resolved here on the server rather than by Clerk's <SignedOut>
 * and <SignedIn>. Those are client components: during SSR they cannot know
 * whether anyone is signed in, so both rendered nothing and the entire page
 * arrived empty. The marketing copy only appeared once Clerk had downloaded,
 * booted and settled in the browser — which put mobile LCP at 6.5s against 1.3s
 * on desktop, moved CLS to 0.176, and served crawlers a page with no <h1> and no
 * body copy at all.
 *
 * Reading auth() opts this route out of static prerendering. That is a real cost
 * and it is worth naming: the trade is a per-request render for HTML that
 * actually contains the page. The previous "static" output was a shell that said
 * nothing, so there was little being cached worth keeping.
 */
export default async function Home() {
  const { userId } = await auth();

  // Not a security boundary. Middleware and every Convex function still enforce
  // access; this only decides which of the two homes to render.
  if (!userId) return <LandingPage />;

  return <AppHome />;
}
