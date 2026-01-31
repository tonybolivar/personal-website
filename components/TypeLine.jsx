"use client";

import { useEffect, useState } from "react";

export default function TypeLine({
  text,
  speed = 40,
  cursorHoldMs = 3000,
}) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  const [showCursor, setShowCursor] = useState(true);

  useEffect(() => {
    let i = 0;

    // reset if text changes
    setDisplayed("");
    setDone(false);
    setShowCursor(true);

    const interval = setInterval(() => {
      i += 1;
      setDisplayed(text.slice(0, i));

      if (i >= text.length) {
        clearInterval(interval);
        setDone(true);

        // hold cursor for a bit, then fade it out
        const t = setTimeout(() => setShowCursor(false), cursorHoldMs);
        return () => clearTimeout(t);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed, cursorHoldMs]);

  return (
    <p className="ink-muted text-sm mt-1 font-mono">
      {displayed}
      <span
        className={`inline-block ml-0.5 transition-opacity duration-700 ${
          showCursor ? "opacity-100 animate-pulse" : "opacity-0"
        } ${done ? "" : ""}`}
      >
        _
      </span>
    </p>
  );
}
