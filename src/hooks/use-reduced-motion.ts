"use client";

import * as React from "react";

/**
 * Tracks the user's prefers-reduced-motion setting.
 *
 * The CSS media query in globals.css covers CSS animation and transitions, but
 * Recharts animates in JavaScript and ignores it entirely. Charts read this
 * hook and switch their animation off at the source.
 *
 * Starts false so the server and first client render agree; the effect
 * corrects it on machines that ask for reduced motion.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);

  React.useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
