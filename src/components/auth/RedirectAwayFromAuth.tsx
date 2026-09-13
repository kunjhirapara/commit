"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Sends an already-signed-in visitor away from the sign-in and sign-up pages.
 *
 * Rendered inside `<SignedIn>`, so it only mounts once the session is confirmed
 * authenticated — it cannot fire during the loading window and bounce someone
 * who was never signed in. That guarantee is why SignedIn renders nothing while
 * the session is still resolving rather than treating it as signed out. `replace` rather than `push` so the auth page does not sit in
 * history waiting for the back button.
 */
function RedirectAwayFromAuth({ to = "/" }: { to?: string }) {
  const router = useRouter();

  useEffect(() => {
    router.replace(to);
  }, [router, to]);

  return null;
}

export default RedirectAwayFromAuth;
