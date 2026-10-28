// Cloud sync API for the customer (party) directory: list the signed-in user's
// customers (GET) and create/update one (POST). Every query is scoped to the
// owner, so a user only ever sees or writes their own customers. Mirrors the
// bills route. Active only when MONGODB_URI is configured.

import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import type { Customer } from "@/lib/types";

// Stored doc: composite _id (owner-scoped so ids can never collide across
// users) plus a userId field for list queries.
type CustomerDoc = Customer & { _id: string; userId: string };

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const db = await getDb();
    const customers = await db
      .collection<CustomerDoc>("customers")
      .find({ userId }, { projection: { _id: 0, userId: 0 } })
      .sort({ name: 1 })
      .toArray();
    return NextResponse.json(customers);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const incoming = (await req.json()) as Customer;
    if (!incoming?.id) {
      return NextResponse.json({ error: "Missing customer id" }, { status: 400 });
    }
    const _id = `${userId}:${incoming.id}`;
    // Server owns the ownership fields: userId is set explicitly, and any _id a
    // client tried to inject is stripped so Mongo takes it from the filter.
    const replacement = { ...incoming, userId };
    delete (replacement as { _id?: string })._id;

    const db = await getDb();
    await db
      .collection<CustomerDoc>("customers")
      .replaceOne({ _id }, replacement, { upsert: true });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
