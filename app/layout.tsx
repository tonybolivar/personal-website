import type { Metadata } from "next";
import { Radio_Canada } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";

const radio = Radio_Canada({
  subsets: ["latin"],
  weight: ["400", "600"],
});


export const metadata: Metadata = {
  title: {
    default: "Anthony Bolivar",
    template: "%s | Anthony Bolivar",
  },
  description:
    "Anthony Bolivar - Roblox systems developer and computer science student building games, tooling, automation, and production-ready software.",
  metadataBase: new URL("https://anthonybolivar.com"),
  openGraph: {
    title: "Anthony Bolivar",
    description:
      "Portfolio of Anthony Bolivar - Roblox systems, Luau tooling, games, automation, and software engineering.",
    url: "https://anthonybolivar.com",
    siteName: "Anthony Bolivar",
    locale: "en_US",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${radio.className} min-h-screen pl-0 pr-0 pt-8 pb-2 mx-3 flex justify-center sm:mx-10 sm:pt-12 lg:mx-24`}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
