// Cloud sync API for a single product: GET one, DELETE one — both scoped to the
// signed-in owner via the composite _id, so another user's product can't be read
// or deleted even if its id is known. Mirrors the customers [id] route.

import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import type { Product } from "@/lib/types";

type ProductDoc = Product & { _id: string; userId: string };

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const db = await getDb();
    const product = await db
      .collection<ProductDoc>("products")
      .findOne({ _id: `${userId}:${id}` }, { projection: { _id: 0, userId: 0 } });
    if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(product);
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
    await db.collection<ProductDoc>("products").deleteOne({ _id: `${userId}:${id}` });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
