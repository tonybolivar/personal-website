import type { Metadata } from "next";
import { Radio_Canada } from "next/font/google";
import "../globals.css";

const radio = Radio_Canada({
  subsets: ["latin"],
  weight: ["400", "600"],
});

export const metadata: Metadata = {
  title: "about",
  description: "About section of Anthony Bolivar's portfolio website",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`
          ${radio.className}
          min-h-screen
          flex
          justify-center
          bg-[var(--paper)]
          text-[var(--ink)]
        `}
      >
        {/* page column */}
        <main
          className="
            w-full
            max-w-2xl
            px-6
            pt-12
            pb-8
          "
        >
          {children}
        </main>
      </body>
    </html>
  );
}
