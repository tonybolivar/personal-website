"use client";

import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";

export default function TrollContent() {
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
        position: "fixed",
        inset: 0,
        cursor: started ? "default" : "pointer",
        overflow: "hidden",
      }}
    >
      <iframe
        src="https://anthonybolivar.com"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          border: "none",
          pointerEvents: "none",
        }}
      />

      <audio ref={audioRef} src="/Trololo!.mp3" loop />

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

      <img
        src="/troll.png"
        alt="troll face"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "clamp(300px, 50vw, 600px)",
          height: "auto",
          zIndex: 9,
          pointerEvents: "none",
          opacity: 0.95,
        }}
      />

      <p
        style={{
          position: "fixed",
          bottom: 40,
          width: "100%",
          textAlign: "center",
          fontSize: "clamp(18px, 3vw, 36px)",
          fontWeight: "bold",
          fontFamily: "monospace",
          color: "#fff",
          textShadow: "0 0 8px #000, 0 0 4px #000",
          zIndex: 11,
          pointerEvents: "none",
        }}
      >
        {started ? "Problem?" : "Click anywhere..."}
      </p>
    </div>
  );
}
