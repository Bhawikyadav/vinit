// Cloud sync API for each user's own company profile. Keyed by the owner id in
// the `settings` collection, so every account has an independent profile.
// Active only with MONGODB_URI.

import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import type { CompanyProfile } from "@/lib/types";

type ProfileDoc = CompanyProfile & { _id: string };

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const db = await getDb();
    const profile = await db
      .collection<ProfileDoc>("settings")
      .findOne({ _id: userId }, { projection: { _id: 0 } });
    if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(profile);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const incoming = (await req.json()) as CompanyProfile;
    // Strip any client _id; Mongo takes it from the filter (the owner id).
    const replacement = { ...incoming };
    delete (replacement as { _id?: string })._id;

    const db = await getDb();
    await db
      .collection<ProfileDoc>("settings")
      .replaceOne({ _id: userId }, replacement, { upsert: true });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
