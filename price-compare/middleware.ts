import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const ROLE_ORDER = { FIELD: 1, MANAGER: 2, ADMIN: 3 } as const;

function minRole(pathname: string) {
  if (pathname.startsWith("/admin")) return "ADMIN";
  if (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/reports") ||
    pathname.startsWith("/map")
  )
    return "MANAGER";
  if (pathname.startsWith("/capture") || pathname.startsWith("/observations")) return "FIELD";
  return null;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const required = minRole(pathname);
  if (!required) return NextResponse.next();

  const token = await getToken({ req });
  if (!token) return NextResponse.redirect(new URL("/login", req.url));

  const userRole = (token.role as "FIELD" | "MANAGER" | "ADMIN") ?? "FIELD";
  if (ROLE_ORDER[userRole] < ROLE_ORDER[required]) {
    return NextResponse.redirect(new URL("/unauthorized", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/capture/:path*",
    "/observations/:path*",
    "/dashboard/:path*",
    "/reports/:path*",
    "/admin/:path*",
    "/map/:path*",
  ],
};