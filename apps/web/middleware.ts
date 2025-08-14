import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = process.env.JWT_SECRET || "change-me";

async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(JWT_SECRET)
    );
    return payload as { sub?: string; role?: "BCBA" | "RBT" };
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("pi_access_token")?.value || "";
  const user = token ? await verifyToken(token) : null;

  // Public routes
  if (pathname === "/" || pathname.startsWith("/login")) {
    // If already logged in, redirect to the right dashboard
    if (user?.role === "BCBA") {
      return NextResponse.redirect(new URL("/dashboard/bcba", req.url));
    }
    if (user?.role === "RBT") {
      return NextResponse.redirect(new URL("/dashboard/rbt", req.url));
    }
    return NextResponse.next();
  }

  // Routes that require authentication for any role
  const authRequired =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/collect") ||
    pathname.startsWith("/analysis");

  if (authRequired) {
    if (!user) {
      const login = pathname.includes("/bcba")
        ? "/login/bcba"
        : pathname.includes("/rbt")
        ? "/login/rbt"
        : "/login/rbt";
      return NextResponse.redirect(new URL(login, req.url));
    }

    // Role-gated dashboards
    if (pathname.startsWith("/dashboard/bcba") && user.role !== "BCBA") {
      return NextResponse.redirect(new URL("/dashboard/rbt", req.url));
    }
    if (pathname.startsWith("/dashboard/rbt") && user.role !== "RBT") {
      return NextResponse.redirect(new URL("/dashboard/bcba", req.url));
    }

    // BCBA-only sections
    if (pathname.startsWith("/clients") || pathname.startsWith("/analysis")) {
      if (user.role !== "BCBA") {
        return NextResponse.redirect(new URL("/dashboard/rbt", req.url));
      }
    }

    // /collect is allowed for both roles
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
