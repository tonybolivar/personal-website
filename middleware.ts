import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";

  if (host === "neatwoodham.com" || host === "www.neatwoodham.com") {
    const { pathname } = request.nextUrl;
    const staticExtensions = /\.(png|jpg|jpeg|gif|svg|ico|mp3|mp4|webp|woff|woff2|ttf|otf|pdf)$/i;
    if (
      pathname.startsWith("/_next/") ||
      pathname.startsWith("/api/") ||
      pathname === "/sitemap.xml" ||
      pathname === "/robots.txt" ||
      pathname === "/favicon.ico" ||
      staticExtensions.test(pathname)
    ) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("https://anthonybolivar.com/troll"));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
