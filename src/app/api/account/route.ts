// The signed-in user's own account: read (GET) and update (PATCH) their name,
// email, and password. Scoped entirely to the session owner — a user can only
// ever change their own account, never another's.
//
// Security: name and email update freely for the authenticated session, but a
// password change REQUIRES the current password (so a walked-up, unlocked
// session can't lock the real owner out). Email must stay unique across users.

import { NextResponse } from "next/server";
import { createSession, getSession } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { findUserByEmail, findUserById, normalizeEmail, updateUser } from "@/lib/users";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const unauthorized = () =>
  NextResponse.json({ error: "Unauthorized" }, { status: 401 });

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  const user = await findUserById(session.sub);
  if (!user) return unauthorized();
  return NextResponse.json({ name: user.name, email: user.email });
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return unauthorized();
  const user = await findUserById(session.sub);
  if (!user) return unauthorized();

  try {
    const body = (await req.json().catch(() => ({}))) as {
      name?: string;
      email?: string;
      currentPassword?: string;
      newPassword?: string;
    };

    const name = body.name?.trim();
    const email = body.email?.trim();
    const currentPassword = body.currentPassword ?? "";
    const newPassword = body.newPassword ?? "";

    const patch: { name?: string; email?: string; passwordHash?: string } = {};

    if (name !== undefined && name !== user.name) {
      if (name.length < 2) {
        return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
      }
      patch.name = name;
    }

    if (email !== undefined && normalizeEmail(email) !== user.email) {
      if (!EMAIL_RE.test(email)) {
        return NextResponse.json({ error: "Please enter a valid email." }, { status: 400 });
      }
      const existing = await findUserByEmail(email);
      if (existing && existing._id !== user._id) {
        return NextResponse.json(
          { error: "That email is already in use." },
          { status: 409 },
        );
      }
      patch.email = email;
    }

    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: "Enter your current password to set a new one." },
          { status: 400 },
        );
      }
      const ok = await verifyPassword(currentPassword, user.passwordHash);
      if (!ok) {
        return NextResponse.json(
          { error: "Your current password is incorrect." },
          { status: 403 },
        );
      }
      if (newPassword.length < 8) {
        return NextResponse.json(
          { error: "New password must be at least 8 characters." },
          { status: 400 },
        );
      }
      patch.passwordHash = await hashPassword(newPassword);
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ name: user.name, email: user.email, changed: false });
    }

    const updated = await updateUser(user._id, patch);
    if (!updated) return NextResponse.json({ error: "Account not found." }, { status: 404 });

    // The session cookie carries name/email; re-issue it so the rail, /api/me
    // and future requests reflect the change without a re-login.
    if (patch.name !== undefined || patch.email !== undefined) {
      await createSession({ id: updated._id, email: updated.email, name: updated.name });
    }

    return NextResponse.json({ name: updated.name, email: updated.email, changed: true });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      return NextResponse.json({ error: "That email is already in use." }, { status: 409 });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
