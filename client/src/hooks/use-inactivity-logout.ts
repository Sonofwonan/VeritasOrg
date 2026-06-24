import { useEffect, useRef, useState, useCallback } from "react";

const INACTIVITY_MS = 10 * 60 * 1000;
const WARNING_MS = 60 * 1000;
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"] as const;

export function useInactivityLogout(onLogout: () => void) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const logoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearAll = useCallback(() => {
    if (logoutTimer.current) clearTimeout(logoutTimer.current);
    if (warningTimer.current) clearTimeout(warningTimer.current);
    if (countdownInterval.current) clearInterval(countdownInterval.current);
    logoutTimer.current = null;
    warningTimer.current = null;
    countdownInterval.current = null;
  }, []);

  const reset = useCallback(() => {
    clearAll();
    setSecondsLeft(null);

    warningTimer.current = setTimeout(() => {
      setSecondsLeft(Math.round(WARNING_MS / 1000));
      countdownInterval.current = setInterval(() => {
        setSecondsLeft((s) => {
          if (s === null || s <= 1) return null;
          return s - 1;
        });
      }, 1000);
    }, INACTIVITY_MS - WARNING_MS);

    logoutTimer.current = setTimeout(() => {
      clearAll();
      setSecondsLeft(null);
      onLogout();
    }, INACTIVITY_MS);
  }, [clearAll, onLogout]);

  useEffect(() => {
    reset();
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      clearAll();
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [reset, clearAll]);

  const showWarning = secondsLeft !== null;

  return { showWarning, secondsLeft: secondsLeft ?? 0, dismiss: reset };
}
