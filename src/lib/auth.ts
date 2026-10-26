// Server-side session helpers — the Data Access Layer's entry point.
//
// Route handlers call getSession()/requireUserId() to find out who is making
// the request, then scope every database query to that user. This is the real
// authorization check (the proxy only does a fast optimistic pre-check).

import { cookies } from "next/headers";
import { signToken, verifyToken, type SessionPayload } from "./session";

export const SESSION_COOKIE = "vm_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

// Read and verify the current session from the request cookie.
export async function getSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifyToken(token);
}

// Convenience for data routes: the owner id, or null when not signed in.
export async function requireUserId(): Promise<string | null> {
  const session = await getSession();
  return session?.sub ?? null;
}

// Issue a fresh session cookie after a successful login/signup.
export async function createSession(user: {
  id: string;
  email: string;
  name: string;
}): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const token = await signToken({
    sub: user.id,
    email: user.email,
    name: user.name,
    iat: now,
    exp: now + MAX_AGE_SECONDS,
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
