"use client";

import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "experience" },
  { href: "/travels", label: "travels" },
  { href: "/about", label: "about" },
  { href: "mailto:abolivar@colgate.edu", label: "contact" },
  { href: "/ABResume.pdf", label: "resume", external: true },
];

export default function TravelsNav() {
  const pathname = usePathname();
  return (
    <ul className="flex flex-row items-center gap-5 text-sm">
      {LINKS.map((l) => {
        const active = pathname === l.href;
        return (
          <li key={l.href}>
            <a
              href={l.href}
              target={l.external ? "_blank" : undefined}
              rel={l.external ? "noopener noreferrer" : undefined}
              className={active ? "text-[var(--accent)]" : "text-[var(--ink)] hover:text-[var(--accent)]"}
            >
              {l.label}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
