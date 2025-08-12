import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

async function getPayload(token: string | undefined) {
  if (!token) return null;
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
    const { payload } = await jwtVerify(token, secret);
    return payload as { sub: string; role: "BCBA" | "RBT" };
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only handle these paths
  if (
    !pathname.startsWith("/dashboard") &&
    !pathname.startsWith("/login") &&
    !pathname.startsWith("/clients")
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get("pi_access_token")?.value;
  const payload = await getPayload(token);

  // --- BCBA-only Clients pages ---
  if (pathname.startsWith("/clients")) {
    // Not signed in → go to BCBA login
    if (!payload) {
      const url = req.nextUrl.clone();
      url.pathname = "/login/bcba";
      return NextResponse.redirect(url);
    }
    // Signed in but not BCBA → send to RBT dashboard
    if (payload.role !== "BCBA") {
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard/rbt";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // --- Protect dashboards ---
  if (pathname.startsWith("/dashboard")) {
    if (!payload) {
      const url = req.nextUrl.clone();
      url.pathname = pathname.startsWith("/dashboard/bcba") ? "/login/bcba" : "/login/rbt";
      return NextResponse.redirect(url);
    }
    if (pathname.startsWith("/dashboard/bcba") && payload.role !== "BCBA") {
      const url = req.nextUrl.clone();
      url.pathname = "/login/bcba";
      return NextResponse.redirect(url);
    }
    // RBT dashboard allows RBT or BCBA
    return NextResponse.next();
  }

  // --- Redirect away from login pages if already signed in ---
  if (pathname.startsWith("/login")) {
    if (payload) {
      const url = req.nextUrl.clone();
      url.pathname = payload.role === "BCBA" ? "/dashboard/bcba" : "/dashboard/rbt";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = { matcher: ["/dashboard/:path*", "/login/:path*", "/clients/:path*"] };
