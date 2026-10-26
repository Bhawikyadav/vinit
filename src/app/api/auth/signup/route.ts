// Create a new account. Gated by an invite code (SIGNUP_CODE): if no code is
// configured on the server, signups are refused — so the app never silently
// allows open registration.

import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { createUser, findUserByEmail } from "@/lib/users";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      name?: string;
      email?: string;
      password?: string;
      code?: string;
    };

    const requiredCode = process.env.SIGNUP_CODE;
    if (!requiredCode) {
      return NextResponse.json(
        { error: "Signups are disabled. Ask the owner to set an invite code." },
        { status: 403 },
      );
    }
    if ((body.code ?? "") !== requiredCode) {
      return NextResponse.json({ error: "Invalid invite code." }, { status: 403 });
    }

    const name = (body.name ?? "").trim();
    const email = (body.email ?? "").trim();
    const password = body.password ?? "";

    if (name.length < 2) {
      return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 },
      );
    }

    if (await findUserByEmail(email)) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 },
      );
    }

    const passwordHash = await hashPassword(password);
    const user = await createUser({ email, name, passwordHash });
    await createSession({ id: user._id, email: user.email, name: user.name });
    return NextResponse.json({ ok: true });
  } catch (err) {
    // A duplicate-key error here means a race on the unique email index.
    if ((err as { code?: number }).code === 11000) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
