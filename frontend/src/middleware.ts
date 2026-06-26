import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const CUSTOMER_AUTH_COOKIE = "customerToken";

export function middleware(request: NextRequest) {
  const isLoggedIn = Boolean(request.cookies.get(CUSTOMER_AUTH_COOKIE)?.value);
  const { pathname } = request.nextUrl;

  if (isLoggedIn && pathname === "/login") {
    return NextResponse.redirect(new URL("/account", request.url));
  }

  if (!isLoggedIn && pathname === "/account") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/account"],
};
