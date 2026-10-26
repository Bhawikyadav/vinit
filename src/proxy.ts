import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "@/lib/session";

// Account gate. Every request carries the session cookie; this does a fast,
// optimistic check (signature + expiry only, no database) and redirects anyone
// without a valid session to /login. The real authorization — scoping data to
// the owner — happens inside each API route handler (see src/lib/auth.ts), as
// the Next.js docs recommend: checks closest to the data are the source of
// truth, the proxy is just a pre-filter.

const COOKIE = "vm_session";

// Reachable without being signed in.
const PUBLIC_PAGES = ["/login", "/signup"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isAuthApi = pathname.startsWith("/api/auth/");
  const isPublicPage = PUBLIC_PAGES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  const session = await verifyToken(req.cookies.get(COOKIE)?.value);

  // Already signed in? Keep them out of the login/signup pages.
  if (session && isPublicPage) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (isAuthApi || isPublicPage) return NextResponse.next();

  if (!session) {
    // API callers get a clean 401; page visits get redirected to the login page.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?from=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except Next internals and public fonts.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts/).*)"],
};
