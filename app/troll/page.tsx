"use client";

import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";

export default function TrollPage() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const confettiInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const [started, setStarted] = useState(false);

  const posRef = useRef({ x: 100, y: 100 });
  const velRef = useRef({ x: 3, y: 2 });
  const roamRef = useRef<HTMLImageElement>(null);
  const animRef = useRef<number | null>(null);

  function startParty() {
    if (started) return;
    setStarted(true);
    audioRef.current?.play();

    confettiInterval.current = setInterval(() => {
      confetti({ particleCount: 80, spread: 120, origin: { y: 0.5 } });
    }, 800);
  }

  useEffect(() => {
    const el = roamRef.current;
    if (!el) return;

    function animate() {
      if (!el) return;
      const W = window.innerWidth - el.offsetWidth;
      const H = window.innerHeight - el.offsetHeight;

      posRef.current.x += velRef.current.x;
      posRef.current.y += velRef.current.y;

      if (posRef.current.x <= 0 || posRef.current.x >= W) velRef.current.x *= -1;
      if (posRef.current.y <= 0 || posRef.current.y >= H) velRef.current.y *= -1;

      posRef.current.x = Math.max(0, Math.min(posRef.current.x, W));
      posRef.current.y = Math.max(0, Math.min(posRef.current.y, H));

      el.style.left = posRef.current.x + "px";
      el.style.top = posRef.current.y + "px";

      animRef.current = requestAnimationFrame(animate);
    }

    animRef.current = requestAnimationFrame(animate);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      if (confettiInterval.current) clearInterval(confettiInterval.current);
    };
  }, []);

  return (
    <div
      onClick={startParty}
      style={{
        minHeight: "100vh",
        width: "100vw",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#111",
        userSelect: "none",
        cursor: started ? "default" : "pointer",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <audio ref={audioRef} src="/Trololo!.mp3" loop />

      {/* roaming troll2 */}
      <img
        ref={roamRef}
        src="/troll2.png"
        alt=""
        style={{
          position: "fixed",
          width: 120,
          height: "auto",
          zIndex: 10,
          pointerEvents: "none",
        }}
      />

      {/* main troll */}
      <img
        src="/troll.png"
        alt="troll face"
        style={{
          width: "clamp(300px, 60vw, 650px)",
          height: "auto",
          imageRendering: "pixelated",
          zIndex: 1,
        }}
      />
      <p
        style={{
          fontSize: "clamp(28px, 5vw, 72px)",
          fontWeight: "bold",
          fontFamily: "monospace",
          letterSpacing: "0.05em",
          margin: "16px 0 0",
          color: "#fff",
          zIndex: 1,
        }}
      >
        {started ? "Problem?" : "Click anywhere..."}
      </p>
    </div>
  );
}
