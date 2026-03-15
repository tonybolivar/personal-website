import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";

  if (host === "neatwoodham.com" || host === "www.neatwoodham.com") {
    const url = request.nextUrl.clone();
    url.pathname = "/neat-woodham";
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/:path*",
};
