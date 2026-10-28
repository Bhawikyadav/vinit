// Cloud sync API for a single customer: GET one, DELETE one — both scoped to the
// signed-in owner via the composite _id, so another user's customer can't be read
// or deleted even if its id is known. Mirrors the bills [id] route.

import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import type { Customer } from "@/lib/types";

type CustomerDoc = Customer & { _id: string; userId: string };

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const db = await getDb();
    const customer = await db
      .collection<CustomerDoc>("customers")
      .findOne({ _id: `${userId}:${id}` }, { projection: { _id: 0, userId: 0 } });
    if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(customer);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const db = await getDb();
    await db.collection<CustomerDoc>("customers").deleteOne({ _id: `${userId}:${id}` });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
