// Bulk create/update for the product catalog (the "Bulk upload" drawer). Accepts
// { products: Product[] } the client has already parsed and validated, then —
// defence in depth — re-validates and sanitises every row server-side, caps the
// batch size, and upserts them in a single bulkWrite scoped to the owner. Returns
// how many were saved vs skipped. Mirrors the auth/ownership model of the other
// products routes.

import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { sanitizeProduct, MAX_BULK_ROWS } from "@/lib/productImport";
import type { Product } from "@/lib/types";

type ProductDoc = Product & { _id: string; userId: string };

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await req.json().catch(() => null)) as { products?: unknown } | null;
    const incoming = body?.products;
    if (!Array.isArray(incoming)) {
      return NextResponse.json({ error: "Expected { products: [...] }" }, { status: 400 });
    }
    if (incoming.length === 0) {
      return NextResponse.json({ saved: 0, skipped: 0 });
    }
    if (incoming.length > MAX_BULK_ROWS) {
      return NextResponse.json(
        { error: `Too many rows: ${incoming.length}. The limit is ${MAX_BULK_ROWS} per upload.` },
        { status: 413 },
      );
    }

    // Sanitise each row; drop any that fail validation (the client should have
    // caught these, but never trust the client).
    const clean: Product[] = [];
    let skipped = 0;
    for (const raw of incoming) {
      const p = sanitizeProduct(raw as Partial<Product>);
      if (p) clean.push(p);
      else skipped += 1;
    }
    if (clean.length === 0) {
      return NextResponse.json({ saved: 0, skipped });
    }

    // Collapse duplicate ids within the batch (last wins) so bulkWrite doesn't
    // issue two conflicting upserts for the same _id.
    const byId = new Map<string, Product>();
    for (const p of clean) byId.set(p.id, p);

    const db = await getDb();
    const ops = Array.from(byId.values()).map((p) => {
      const replacement = { ...p, userId };
      delete (replacement as { _id?: string })._id;
      return {
        replaceOne: {
          filter: { _id: `${userId}:${p.id}` },
          replacement,
          upsert: true,
        },
      };
    });

    await db.collection<ProductDoc>("products").bulkWrite(ops, { ordered: false });
    return NextResponse.json({ saved: byId.size, skipped });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
