// Password hashing with Node's built-in scrypt (no external dependency).
//
// Node-only: this is imported solely by the signup/login route handlers, which
// always run in the Node.js runtime. scrypt is a memory-hard algorithm designed
// for password storage; each hash gets its own random salt.
//
// Stored format:  scrypt$<saltHex>$<hashHex>

import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;

  const salt = Buffer.from(parts[1], "hex");
  const expected = Buffer.from(parts[2], "hex");
  const derived = (await scryptAsync(password, salt, expected.length)) as Buffer;

  // Lengths must match before timingSafeEqual, which throws on mismatch.
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}
