// User accounts (server-only, Node runtime). Stored in the `users` collection.
//
// A user's id (_id) is a random UUID string; it is what every bill, quote, and
// profile is scoped to. Email is stored lowercased and kept unique by an index.

import { randomUUID } from "crypto";
import { getDb } from "./mongodb";

export interface UserDoc {
  _id: string; // uuid — used as the owner id on all records
  email: string; // normalized (lowercased, trimmed)
  name: string;
  passwordHash: string;
  createdAt: string;
}

let indexEnsured = false;

async function usersCollection() {
  const db = await getDb();
  const col = db.collection<UserDoc>("users");
  if (!indexEnsured) {
    // Case-insensitive uniqueness is handled by normalizing the email before
    // every read/write; the unique index is the hard guarantee against dupes.
    await col.createIndex({ email: 1 }, { unique: true });
    indexEnsured = true;
  }
  return col;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function findUserByEmail(email: string): Promise<UserDoc | null> {
  return (await usersCollection()).findOne({ email: normalizeEmail(email) });
}

export async function findUserById(id: string): Promise<UserDoc | null> {
  return (await usersCollection()).findOne({ _id: id });
}

export async function createUser(data: {
  email: string;
  name: string;
  passwordHash: string;
}): Promise<UserDoc> {
  const doc: UserDoc = {
    _id: randomUUID(),
    email: normalizeEmail(data.email),
    name: data.name.trim(),
    passwordHash: data.passwordHash,
    createdAt: new Date().toISOString(),
  };
  await (await usersCollection()).insertOne(doc);
  return doc;
}
