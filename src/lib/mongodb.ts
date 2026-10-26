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
  return client.db(dbName);
}
