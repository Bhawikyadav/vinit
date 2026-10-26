// Create a new account. Gated by an invite code (SIGNUP_CODE): if no code is
// configured on the server, signups are refused — so the app never silently
// allows open registration.

import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { DEFAULT_PROFILE } from "@/lib/company";
import { getDb } from "@/lib/mongodb";
import { hashPassword } from "@/lib/password";
import { stateName } from "@/lib/states";
import type { CompanyProfile } from "@/lib/types";
import { createUser, findUserByEmail } from "@/lib/users";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Seed a brand-new company's own profile the moment it's created, so the account
// is identified as ITS company from the first login — never the blank default
// and never VM. Keyed by the owner id in `settings`, exactly like /api/profile.
// Best-effort: a blank profile is always recoverable in Settings, so a seeding
// hiccup must not fail the signup.
async function seedCompanyProfile(
  userId: string,
  companyName: string,
  stateCode: string,
): Promise<void> {
  try {
    const profile: CompanyProfile = {
      ...DEFAULT_PROFILE,
      bank: { ...DEFAULT_PROFILE.bank },
      units: [...DEFAULT_PROFILE.units],
      invoice: { ...DEFAULT_PROFILE.invoice },
      quote: { ...DEFAULT_PROFILE.quote },
      name: companyName,
      stateCode,
      stateName: stateName(stateCode),
    };
    const db = await getDb();
    // Typed like /api/profile so the string _id (owner id) is accepted.
    await db
      .collection<CompanyProfile & { _id: string }>("settings")
      .replaceOne({ _id: userId }, profile, { upsert: true });
  } catch {
    // ignore — the user can complete their profile in Settings
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      name?: string;
      email?: string;
      password?: string;
      code?: string;
      companyName?: string;
      stateCode?: string;
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
    const companyName = (body.companyName ?? "").trim();
    const stateCode = (body.stateCode ?? "").trim();

    if (name.length < 2) {
      return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
    }
    if (companyName.length < 2) {
      return NextResponse.json(
        { error: "Please enter your company name." },
        { status: 400 },
      );
    }
    if (!stateCode || !stateName(stateCode)) {
      return NextResponse.json(
        { error: "Please select your company's state." },
        { status: 400 },
      );
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
    await seedCompanyProfile(user._id, companyName, stateCode);
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
