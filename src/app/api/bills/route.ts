// Cloud sync API: list the signed-in user's bills (GET) and create/update one
// (POST). Every query is scoped to the owner, so a user only ever sees, writes,
// or overwrites their own bills. Active only when MONGODB_URI is configured.

import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import type { Bill } from "@/lib/types";

// Stored doc: composite _id (owner-scoped so ids can never collide across
// users) plus a userId field for list queries.
type BillDoc = Bill & { _id: string; userId: string };

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const db = await getDb();
    const bills = await db
      .collection<BillDoc>("bills")
      .find({ userId }, { projection: { _id: 0, userId: 0 } })
      .sort({ updatedAt: -1 })
      .toArray();
    return NextResponse.json(bills);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const incoming = (await req.json()) as Bill;
    if (!incoming?.id) {
      return NextResponse.json({ error: "Missing bill id" }, { status: 400 });
    }
    const _id = `${userId}:${incoming.id}`;
    // Server owns the ownership fields: userId is set explicitly, and any _id a
    // client tried to inject is stripped so Mongo takes it from the filter.
    const replacement = { ...incoming, userId };
    delete (replacement as { _id?: string })._id;

    const db = await getDb();
    await db
      .collection<BillDoc>("bills")
      .replaceOne({ _id }, replacement, { upsert: true });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
