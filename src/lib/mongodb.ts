// MongoDB connection (server-only). Used by the /api/bills routes when cloud
// sync is enabled. Set MONGODB_URI in .env.local to turn it on.
//
// Uses a cached client so hot-reload / serverless invocations don't open a new
// connection every time.

import { MongoClient, type Db } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "vm_billing";

let cached = (global as typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>;
})._mongoClientPromise;

export function cloudConfigured(): boolean {
  return Boolean(uri);
}

// Indexes that enforce and speed up the multi-company model. Every bill/quote is
// scoped to its owner, so we index on userId; the unique email index is the hard
// guarantee one email can't own two accounts. Ensured once per process, and
// best-effort — a transient failure just retries on the next call.
let indexesEnsured = false;
async function ensureIndexes(db: Db): Promise<void> {
  if (indexesEnsured) return;
  indexesEnsured = true;
  try {
    await Promise.all([
      db.collection("bills").createIndex({ userId: 1, updatedAt: -1 }),
      db.collection("quotes").createIndex({ userId: 1, updatedAt: -1 }),
      db.collection("customers").createIndex({ userId: 1, name: 1 }),
      db.collection("users").createIndex({ email: 1 }, { unique: true }),
    ]);
  } catch {
    indexesEnsured = false; // allow a later retry
  }
}

export async function getDb(): Promise<Db> {
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set. Add it to .env.local to enable cloud sync.",
    );
  }
  if (!cached) {
    const client = new MongoClient(uri);
    cached = client.connect();
    (global as typeof globalThis & {
      _mongoClientPromise?: Promise<MongoClient>;
    })._mongoClientPromise = cached;
  }
  const client = await cached;
  const db = client.db(dbName);
  await ensureIndexes(db);
  return db;
}
