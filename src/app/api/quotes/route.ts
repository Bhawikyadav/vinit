// Cloud sync API: list the signed-in user's quotations (GET) and create/update
// one (POST). Every query is scoped to the owner. Active only when MONGODB_URI
// is configured.

import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import type { Quote } from "@/lib/types";

type QuoteDoc = Quote & { _id: string; userId: string };

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const db = await getDb();
    const quotes = await db
      .collection<QuoteDoc>("quotes")
      .find({ userId }, { projection: { _id: 0, userId: 0 } })
      .sort({ updatedAt: -1 })
      .toArray();
    return NextResponse.json(quotes);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const incoming = (await req.json()) as Quote;
    if (!incoming?.id) {
      return NextResponse.json({ error: "Missing quote id" }, { status: 400 });
    }
    const _id = `${userId}:${incoming.id}`;
    // Server owns the ownership fields: userId is set explicitly, and any _id a
    // client tried to inject is stripped so Mongo takes it from the filter.
    const replacement = { ...incoming, userId };
    delete (replacement as { _id?: string })._id;

    const db = await getDb();
    await db
      .collection<QuoteDoc>("quotes")
      .replaceOne({ _id }, replacement, { upsert: true });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
