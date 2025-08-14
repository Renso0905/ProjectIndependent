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
    // already logged in? send to dashboard
    if (user?.role === "BCBA") {
      return NextResponse.redirect(new URL("/dashboard/bcba", req.url));
    }
    if (user?.role === "RBT") {
      return NextResponse.redirect(new URL("/dashboard/rbt", req.url));
    }
    return NextResponse.next();
  }

  // Auth-required routes (both roles): dashboards & collection
  const authRequired =
    pathname.startsWith("/dashboard") || pathname.startsWith("/collect");
  if (authRequired) {
    if (!user) {
      // default to RBT login if unknown; adjust if you prefer BCBA
      const login = pathname.includes("/bcba")
        ? "/login/bcba"
        : pathname.includes("/rbt")
        ? "/login/rbt"
        : "/login/rbt";
      return NextResponse.redirect(new URL(login, req.url));
    }
    // Role-specific dashboard gating
    if (pathname.startsWith("/dashboard/bcba") && user.role !== "BCBA") {
      return NextResponse.redirect(new URL("/dashboard/rbt", req.url));
    }
    if (pathname.startsWith("/dashboard/rbt") && user.role !== "RBT") {
      return NextResponse.redirect(new URL("/dashboard/bcba", req.url));
    }
    // /collect is allowed for both roles
    return NextResponse.next();
  }

  // BCBA-only parts of the app (clients management)
  if (pathname.startsWith("/clients")) {
    if (!user) {
      return NextResponse.redirect(new URL("/login/bcba", req.url));
    }
    if (user.role !== "BCBA") {
      return NextResponse.redirect(new URL("/dashboard/rbt", req.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
