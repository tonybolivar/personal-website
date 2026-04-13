import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const host = request.headers.get("host") ?? "";
  const path = request.nextUrl.pathname;
  const timestamp = new Date().toISOString();

  console.log(`[VISITOR] ${timestamp} | Host: ${host} | IP: ${ip} | Path: ${path}`);

  if (host === "neatwoodham.com" || host === "www.neatwoodham.com") {
    const { pathname } = request.nextUrl;
    const staticExtensions =
      /\.(png|jpg|jpeg|gif|svg|ico|mp3|mp4|webp|woff|woff2|ttf|otf|pdf)$/i;
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
    const url = request.nextUrl.clone();
    url.pathname = "/neat-woodham";
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};


