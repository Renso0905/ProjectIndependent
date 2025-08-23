// Single auth source: backend cookies set by the FastAPI server.
// Route protection + role gating with a small, declarative rule table.
// Also normalizes cookie role casing to avoid redirect loops.

import { NextRequest, NextResponse } from "next/server";

type Role = "BCBA" | "RBT" | "ANY";

// Declarative route rules (first matching prefix wins)
const RULES: Array<{ prefix: string; role: Role }> = [
  // BCBA-only
  { prefix: "/dashboard/bcba", role: "BCBA" },
  { prefix: "/clients", role: "BCBA" },
  { prefix: "/analysis", role: "BCBA" },

  // RBT-only
  { prefix: "/dashboard/rbt", role: "RBT" },

  // Shared
  { prefix: "/collect", role: "ANY" },
];

function requiredRoleFor(pathname: string): Role | null {
  for (const r of RULES) if (pathname.startsWith(r.prefix)) return r.role;
  return null; // public/unspecified
}

function isPublicPath(pathname: string) {
  return pathname === "/" || pathname.startsWith("/login");
}

function pickLoginPath(pathname: string) {
  // Keep prior behavior: RBT dashboard → /login/rbt; otherwise /login/bcba
  return pathname.startsWith("/dashboard/rbt") ? "/login/rbt" : "/login/bcba";
}

function normalizeRole(raw?: string): Exclude<Role, "ANY"> | undefined {
  const up = (raw || "").toUpperCase();
  return up === "BCBA" || up === "RBT" ? (up as Exclude<Role, "ANY">) : undefined;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public routes
  if (isPublicPath(pathname)) return NextResponse.next();

  // Auth: backend cookies only (JWT path removed)
  const uid = req.cookies.get("user_id")?.value;
  const role = normalizeRole(req.cookies.get("role")?.value);
  const user = uid && role ? { sub: uid, role } : null;

  // Not authenticated → send to login
  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = pickLoginPath(pathname);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Role guard
  const need = requiredRoleFor(pathname);
  if (need && need !== "ANY" && user.role !== need) {
    const target = user.role === "BCBA" ? "/dashboard/bcba" : "/dashboard/rbt";
    // Prevent self-redirect loops: if already at target, allow through.
    if (pathname !== target) {
      const url = req.nextUrl.clone();
      url.pathname = target;
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

// Exclude Next static assets/images and favicon
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
