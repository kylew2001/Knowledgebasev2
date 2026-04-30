"use client";

import { useEffect, useRef } from "react";
import { signOut } from "@/app/auth/actions";

export function InactivityGuard({ timeoutMinutes }: { timeoutMinutes: number }) {
  const lastActivityRef = useRef(Date.now());

  useEffect(() => {
    if (timeoutMinutes <= 0) return;

    const timeoutMs = timeoutMinutes * 60_000;
    const EVENTS = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "click"] as const;

    const resetTimer = () => { lastActivityRef.current = Date.now(); };
    EVENTS.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));

    // Check every 30 seconds whether the timeout has elapsed
    const interval = setInterval(() => {
      if (Date.now() - lastActivityRef.current >= timeoutMs) {
        signOut();
      }
    }, 30_000);

    return () => {
      EVENTS.forEach((e) => window.removeEventListener(e, resetTimer));
      clearInterval(interval);
    };
  }, [timeoutMinutes]);

  return null;
}
