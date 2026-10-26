// Verify email + password and start a session. The error message is identical
// whether the email is unknown or the password is wrong, so it can't be used to
// probe which emails have accounts.

import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { DUMMY_PASSWORD_HASH, verifyPassword } from "@/lib/password";
import { findUserByEmail } from "@/lib/users";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      email?: string;
      password?: string;
    };
    const email = (body.email ?? "").trim();
    const password = body.password ?? "";

    if (!email || !password) {
      return NextResponse.json(
        { error: "Enter your email and password." },
        { status: 400 },
      );
    }

    // Always run a full password verification — against a dummy hash when the
    // email is unknown — so the response takes the same time whether or not an
    // account exists. Otherwise the timing gap would reveal which emails are
    // registered, even though the error message below is identical for both.
    const user = await findUserByEmail(email);
    const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
    if (!user || !ok) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 },
      );
    }

    await createSession({ id: user._id, email: user.email, name: user.name });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
