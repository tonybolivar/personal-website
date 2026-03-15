"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import confetti from "canvas-confetti";

const MLG_TEXTS = [
  "REKT", "360 NO SCOPE", "420 BLAZE IT", "MLG PRO",
  "OHHHHHH", "SHREKT", "GET DUNKED ON", "SWAG",
  "YOLO", "NO SCOPE", "MONTAGE PARODY", "DORITOZ",
  "MTN DEW", "JOHN CENA", "WOW", "SUCH MLG",
  "VERY PRO", "MUCH SKILL", "EZ CLAP", "GG EZ",
  "ILLUMINATI", "QUICKSCOPE", "FAZE UP", "MLG 360",
  "FAZE CLAN", "DANK MEMES", "TRIGGERED", "OMEGALUL",
];

interface Popup {
  id: number;
  text: string;
  x: number;
  y: number;
  color: string;
  rotation: number;
  scale: number;
}

interface Hitmarker {
  id: number;
  x: number;
  y: number;
}

export default function TrollContent() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const confettiInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const [started, setStarted] = useState(false);
  const [popups, setPopups] = useState<Popup[]>([]);
  const [hitmarkers, setHitmarkers] = useState<Hitmarker[]>([]);
  const [glassesDropped, setGlassesDropped] = useState(false);
  const [screenShake, setScreenShake] = useState(false);
  const popupIdRef = useRef(0);
  const hitIdRef = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const posRef = useRef({ x: 100, y: 100 });
  const velRef = useRef({ x: 3, y: 2 });
  const roamRef = useRef<HTMLImageElement>(null);
  const animRef = useRef<number | null>(null);

  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    return audioCtxRef.current;
  }, []);

  const playHitmarker = useCallback(() => {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
  }, [getAudioCtx]);

  const playAirhorn = useCallback(() => {
    const ctx = getAudioCtx();
    const duration = 0.8;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const dist = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i * 2) / 256 - 1;
      curve[i] = (Math.PI + 400) * x / (Math.PI + 400 * Math.abs(x));
    }
    dist.curve = curve;
    osc.connect(dist);
    dist.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(200, ctx.currentTime + duration);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  }, [getAudioCtx]);

  const spawnPopup = useCallback((x: number, y: number) => {
    const colors = ["#ff0000", "#00ff00", "#ffff00", "#ff00ff", "#00ffff", "#ff6600", "#ffffff", "#ff69b4"];
    const id = ++popupIdRef.current;
    const popup: Popup = {
      id,
      text: MLG_TEXTS[Math.floor(Math.random() * MLG_TEXTS.length)],
      x: x - 60 + Math.random() * 120,
      y: y - 40 + Math.random() * 80,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: -25 + Math.random() * 50,
      scale: 1 + Math.random() * 2,
    };
    setPopups(prev => [...prev, popup]);
    setTimeout(() => setPopups(prev => prev.filter(p => p.id !== id)), 1200);
  }, []);

  const spawnHitmarker = useCallback((x: number, y: number) => {
    const id = ++hitIdRef.current;
    setHitmarkers(prev => [...prev, { id, x, y }]);
    setTimeout(() => setHitmarkers(prev => prev.filter(h => h.id !== id)), 500);
  }, []);

  const triggerShake = useCallback(() => {
    setScreenShake(true);
    setTimeout(() => setScreenShake(false), 400);
  }, []);

  function startParty() {
    if (started) return;
    setStarted(true);
    audioRef.current?.play();
    setGlassesDropped(true);
    triggerShake();
    playAirhorn();
    confettiInterval.current = setInterval(() => {
      confetti({
        particleCount: 80,
        spread: 120,
        origin: { y: 0.5 },
        colors: ["#00ff00", "#ff6600", "#0000ff", "#ff0000", "#ffff00"],
      });
    }, 800);
  }

  function handleClick(e: React.MouseEvent) {
    startParty();
    playHitmarker();
    spawnHitmarker(e.clientX, e.clientY);
    spawnPopup(e.clientX, e.clientY);
    if (Math.random() < 0.25) triggerShake();
    if (Math.random() < 0.15) playAirhorn();
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

  // Random popups after party starts
  useEffect(() => {
    if (!started) return;
    const interval = setInterval(() => {
      spawnPopup(
        80 + Math.random() * (window.innerWidth - 160),
        80 + Math.random() * (window.innerHeight - 160),
      );
    }, 1200);
    return () => clearInterval(interval);
  }, [started, spawnPopup]);

  return (
    <>
      <style>{`
        @keyframes mlg-shake {
          0%,100% { transform: translate(0,0) rotate(0deg); }
          10% { transform: translate(-10px,-8px) rotate(-1.5deg); }
          20% { transform: translate(10px,-4px) rotate(1.5deg); }
          30% { transform: translate(-8px,8px) rotate(0deg); }
          40% { transform: translate(8px,10px) rotate(-1.5deg); }
          50% { transform: translate(-6px,-8px) rotate(1.5deg); }
          60% { transform: translate(6px,6px) rotate(0deg); }
          70% { transform: translate(-8px,4px) rotate(-1.5deg); }
          80% { transform: translate(8px,-6px) rotate(1.5deg); }
          90% { transform: translate(-4px,8px) rotate(0deg); }
        }
        @keyframes glasses-drop {
          0%   { transform: translate(-50%, -400%) rotate(-10deg); opacity: 1; }
          55%  { transform: translate(-50%, -44%) rotate(5deg); opacity: 1; }
          65%  { transform: translate(-50%, -52%) rotate(-3deg); opacity: 1; }
          75%  { transform: translate(-50%, -47%) rotate(2deg); opacity: 1; }
          85%  { transform: translate(-50%, -50%) rotate(-1deg); opacity: 1; }
          100% { transform: translate(-50%, -50%) rotate(0deg); opacity: 1; }
        }
        @keyframes popup-fly {
          0%   { opacity: 1; transform: scale(var(--s,1)) translateY(0); }
          100% { opacity: 0; transform: scale(calc(var(--s,1)*1.4)) translateY(-70px); }
        }
        @keyframes hitmarker-fade {
          0%   { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.8); }
        }
        @keyframes rainbow-bg {
          0%   { background-color: rgba(255,0,0,0.07); }
          16%  { background-color: rgba(255,140,0,0.07); }
          33%  { background-color: rgba(255,255,0,0.07); }
          50%  { background-color: rgba(0,255,0,0.07); }
          66%  { background-color: rgba(0,100,255,0.07); }
          83%  { background-color: rgba(180,0,255,0.07); }
          100% { background-color: rgba(255,0,0,0.07); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes pulse-text {
          0%,100% { text-shadow: 2px 2px 0 #000, -2px -2px 0 #000, 0 0 20px #fff; color: #fff; }
          25%     { text-shadow: 2px 2px 0 #000, -2px -2px 0 #000, 0 0 30px #ff0000; color: #ff4444; }
          50%     { text-shadow: 2px 2px 0 #000, -2px -2px 0 #000, 0 0 30px #00ff00; color: #00ff88; }
          75%     { text-shadow: 2px 2px 0 #000, -2px -2px 0 #000, 0 0 30px #ffff00; color: #ffff00; }
        }
        @keyframes float-corner {
          0%,100% { transform: translateY(0px) rotate(0deg); }
          50%     { transform: translateY(-10px) rotate(10deg); }
        }
        @keyframes dew-pulse {
          0%,100% { opacity: 0.85; transform: scale(1); }
          50%     { opacity: 1; transform: scale(1.05); }
        }
      `}</style>

      <div
        onClick={handleClick}
        style={{
          position: "fixed",
          inset: 0,
          cursor: started ? "crosshair" : "pointer",
          overflow: "hidden",
          animation: screenShake
            ? "mlg-shake 0.4s ease, rainbow-bg 2s linear infinite"
            : started
            ? "rainbow-bg 2s linear infinite"
            : undefined,
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

        {/* Bouncing troll */}
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

        {/* Center troll face */}
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

        {/* MLG Glasses drop */}
        {glassesDropped && (
          <div
            style={{
              position: "fixed",
              top: "42%",
              left: "50%",
              zIndex: 20,
              pointerEvents: "none",
              fontSize: "clamp(60px, 12vw, 130px)",
              animation: "glasses-drop 1s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards",
              filter: "drop-shadow(0 0 12px #00ff00) drop-shadow(0 0 24px #00ff00)",
            }}
          >
            🕶️
          </div>
        )}

        {/* Corner spinning targets */}
        {started && (
          <>
            <div style={{ position:"fixed", top:16, left:16, zIndex:30, pointerEvents:"none", fontSize:36, animation:"spin 1.5s linear infinite", filter:"drop-shadow(0 0 6px #ff0000)" }}>🎯</div>
            <div style={{ position:"fixed", top:16, right:16, zIndex:30, pointerEvents:"none", fontSize:36, animation:"spin 2s linear infinite reverse", filter:"drop-shadow(0 0 6px #00ff00)" }}>🎯</div>
            <div style={{ position:"fixed", bottom:80, left:16, zIndex:30, pointerEvents:"none", fontSize:36, animation:"spin 2.5s linear infinite", filter:"drop-shadow(0 0 6px #ffff00)" }}>🎯</div>
            <div style={{ position:"fixed", bottom:80, right:16, zIndex:30, pointerEvents:"none", fontSize:36, animation:"spin 1.8s linear infinite reverse", filter:"drop-shadow(0 0 6px #ff00ff)" }}>🎯</div>

            {/* MTN DEW watermark */}
            <div style={{
              position:"fixed", top:"15%", right:"5%", zIndex:8, pointerEvents:"none",
              fontSize:"clamp(14px,2vw,22px)", fontFamily:"Impact,sans-serif", fontWeight:900,
              color:"#00cc00", textShadow:"1px 1px 0 #000,-1px -1px 0 #000",
              opacity:0.7, animation:"dew-pulse 2s ease infinite", letterSpacing:2,
              transform:"rotate(15deg)",
            }}>
              MTN DEW
            </div>
            <div style={{
              position:"fixed", bottom:"20%", left:"5%", zIndex:8, pointerEvents:"none",
              fontSize:"clamp(14px,2vw,22px)", fontFamily:"Impact,sans-serif", fontWeight:900,
              color:"#ff6600", textShadow:"1px 1px 0 #000,-1px -1px 0 #000",
              opacity:0.7, animation:"dew-pulse 2.5s ease infinite 0.5s", letterSpacing:2,
              transform:"rotate(-12deg)",
            }}>
              DORITOZ
            </div>
          </>
        )}

        {/* Hit markers */}
        {hitmarkers.map(h => (
          <div
            key={h.id}
            style={{
              position: "fixed",
              left: h.x - 16,
              top: h.y - 16,
              width: 32,
              height: 32,
              zIndex: 50,
              pointerEvents: "none",
              animation: "hitmarker-fade 0.5s ease forwards",
            }}
          >
            <div style={{ position:"absolute", top:0, left:14, width:4, height:11, background:"#fff", boxShadow:"0 0 4px #fff,0 0 8px #ff0" }} />
            <div style={{ position:"absolute", bottom:0, left:14, width:4, height:11, background:"#fff", boxShadow:"0 0 4px #fff,0 0 8px #ff0" }} />
            <div style={{ position:"absolute", left:0, top:14, width:11, height:4, background:"#fff", boxShadow:"0 0 4px #fff,0 0 8px #ff0" }} />
            <div style={{ position:"absolute", right:0, top:14, width:11, height:4, background:"#fff", boxShadow:"0 0 4px #fff,0 0 8px #ff0" }} />
          </div>
        ))}

        {/* MLG text popups */}
        {popups.map(p => (
          <div
            key={p.id}
            style={{
              position: "fixed",
              left: p.x,
              top: p.y,
              zIndex: 40,
              pointerEvents: "none",
              color: p.color,
              fontSize: `${Math.floor(22 * p.scale)}px`,
              fontWeight: 900,
              fontFamily: "Impact, Arial Black, sans-serif",
              textTransform: "uppercase",
              textShadow: "3px 3px 0 #000,-3px -3px 0 #000,3px -3px 0 #000,-3px 3px 0 #000",
              transform: `rotate(${p.rotation}deg)`,
              animation: "popup-fly 1.2s ease forwards",
              whiteSpace: "nowrap",
              userSelect: "none",
            }}
          >
            {p.text}
          </div>
        ))}

        <p
          style={{
            position: "fixed",
            bottom: 40,
            width: "100%",
            textAlign: "center",
            fontSize: "clamp(18px, 3vw, 40px)",
            fontWeight: 900,
            fontFamily: "Impact, Arial Black, monospace",
            color: "#fff",
            textShadow: "0 0 8px #000, 0 0 4px #000",
            zIndex: 11,
            pointerEvents: "none",
            animation: started ? "pulse-text 0.8s ease infinite" : undefined,
            textTransform: "uppercase",
            letterSpacing: 3,
          }}
        >
          {started ? "Problem?" : "Click anywhere..."}
        </p>
      </div>
    </>
  );
}
