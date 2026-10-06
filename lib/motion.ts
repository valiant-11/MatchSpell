import gsap from "gsap";
import { Flip } from "gsap/Flip";

// Register Flip plugin safely in browser environments
if (typeof window !== "undefined") {
  gsap.registerPlugin(Flip);
}

export const DURATION = {
  micro: 0.12,   // 120ms - hover, button press, instant feedback
  fast: 0.2,     // 200ms - tab slide, popover, filter fade
  medium: 0.32,  // 320ms - Flip pick-to-slot, 3D card flip
  slow: 0.5,     // 500ms - staggered reveals, page entrances
} as const;

export const EASING = {
  outExpo: "power4.out",
  inOutCubic: "power2.inOut",
  springish: "back.out(1.4)",
  smooth: "power1.out",
} as const;

/**
 * Checks if the user has requested reduced motion.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export { gsap, Flip };
