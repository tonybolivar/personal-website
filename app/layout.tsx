import type { Metadata } from "next";
import { Radio_Canada} from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";

const radio = Radio_Canada({
  subsets: ["latin"],
  weight: ["400", "600"],
})


export const metadata: Metadata = {
  title: {
    default: "Anthony Bolivar",
    template: "%s | Anthony Bolivar",
  },
  description: "Anthony Bolivar — Computer Science & Mathematics student building software.",
  metadataBase: new URL("https://anthonybolivar.com"),
  openGraph: {
    title: "Anthony Bolivar",
    description: "Portfolio of Anthony Bolivar — CS & Math student.",
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
     <body className={`${radio.className} min-h-screen pl-0 pr-0 pt-12 pb-2 mx-10 flex justify-center sm:mx-24`}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
