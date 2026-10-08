"use client";
// Knight FM — landing section trackers: *_view once per section (IntersectionObserver,
// threshold 0.3) + scroll-depth milestones (25/50/75/100). Visibility tracking is not
// motion, so it runs regardless of prefers-reduced-motion; reveal *animations* are the
// ones disabled under reduced motion (see reveal.tsx).

import React, { useEffect, useRef } from "react";
import { EV, track } from "./analytics";

interface SectionTrackerProps {
  /** Canonical *_view event name. */
  event: string;
  /** DOM id for the <section> landmark (anchor targets). */
  id?: string;
  /** id of the heading element (h2) for aria-labelledby. */
  labelledBy?: string;
  className?: string;
  children: React.ReactNode;
}

/** Wraps a landing section, firing its *_view event once when ≥30% enters the viewport. */
export function SectionTracker({ event, id, labelledBy, className, children }: SectionTrackerProps) {
  const ref = useRef<HTMLElement | null>(null);
  const fired = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // No IntersectionObserver (very old browsers): report once on mount.
    if (typeof IntersectionObserver === "undefined") {
      if (!fired.current) {
        fired.current = true;
        track(event);
      }
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !fired.current) {
            fired.current = true;
            track(event);
            io.disconnect();
          }
        }
      },
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [event]);

  return (
    <section ref={ref} id={id} aria-labelledby={labelledBy} className={className}>
      {children}
    </section>
  );
}

const DEPTH_MARKS = [25, 50, 75, 100] as const;

/** Fires landing_scroll_depth once per milestone (25/50/75/100), rAF-throttled. */
export function useScrollDepth() {
  useEffect(() => {
    const done = new Set<number>();
    let raf = 0;

    const measure = () => {
      raf = 0;
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      if (max <= 0) return;
      const pct = Math.min(100, Math.round((window.scrollY / max) * 100));
      for (const mark of DEPTH_MARKS) {
        if (pct >= mark && !done.has(mark)) {
          done.add(mark);
          track(EV.scrollDepth, { depth: mark });
        }
      }
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    // Catch short pages / restored scroll positions.
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
}
