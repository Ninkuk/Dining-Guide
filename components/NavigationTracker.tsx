"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { notePop, recordNavigation } from "@/lib/app-navigation";

/**
 * Records every client-side route change into the in-memory navigation trail
 * (see `lib/app-navigation`). Mounted once near the root so it observes all
 * navigations, including server-action `redirect()`s. Also owns the `popstate`
 * listener so back/forward navigation is classified as a pop rather than a push.
 */
export function NavigationTracker() {
  const pathname = usePathname();

  useEffect(() => {
    window.addEventListener("popstate", notePop);
    return () => window.removeEventListener("popstate", notePop);
  }, []);

  useEffect(() => {
    recordNavigation(pathname);
  }, [pathname]);

  return null;
}
