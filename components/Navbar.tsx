"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";

const hoverStyle: React.CSSProperties = {
  textDecoration: "underline",
  textUnderlineOffset: "0.35em",
  textDecorationThickness: 1.5,
  textDecorationColor: "var(--accent)",
};

type HoverKey = "experience" | "about" | "contact" | "resume";

function Navbar() {
  const pathname = usePathname();
  const [hovered, setHovered] = useState<HoverKey | undefined>(undefined);

  const linkBase = "text-right transition-colors duration-150";
  const active = "text-[var(--accent)]";
  const inactive = "text-[var(--ink)]";
  const muted = "text-[var(--muted)]";

  return (
    <ul
      className="flex flex-col justify-end gap-1"
      onMouseLeave={() => setHovered(undefined)}
    >
      <li
        className={`${linkBase} ${pathname === "/" ? active : inactive}`}
        onMouseEnter={() => setHovered("experience")}
        style={hovered === "experience" ? hoverStyle : undefined}
      >
        <a href="/">experience</a>
      </li>

      <li
        className={`${linkBase} ${pathname === "/about" ? active : inactive}`}
        onMouseEnter={() => setHovered("about")}
        style={hovered === "about" ? hoverStyle : undefined}
      >
        <a href="/about">about</a>
      </li>

      <li
        className={`${linkBase} ${inactive}`}
        onMouseEnter={() => setHovered("contact")}
        style={hovered === "contact" ? hoverStyle : undefined}
      >
        <a href="mailto:abolivar@colgate.edu">contact</a>
      </li>

      <li
        className={`flex flex-row items-center justify-end gap-1 ${
          pathname === "/resume" ? active : muted
        } hover:text-[var(--ink)]`}
        onMouseEnter={() => setHovered("resume")}
        style={hovered === "resume" ? hoverStyle : undefined}
      >
        <a
          href="/ABResume.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center"
        >
          <p className="pr-1">resume</p>
          <img
            src="/resume.svg"
            alt="Download resume"
            className="w-5 h-5"
            style={{
              filter:
                hovered === "resume"
                  ? "none"
                  : "grayscale(100%) brightness(0.2)",
            }}
          />
        </a>
      </li>
    </ul>
  );
}

export default Navbar;
