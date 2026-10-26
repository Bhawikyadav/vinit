// Stateless session tokens, signed with HMAC-SHA256 via the Web Crypto API.
//
// Web Crypto is available in both the Node.js and Edge runtimes, so the same
// verify logic runs in the proxy (every request) and in the API route handlers.
// No external dependency — the secret lives in AUTH_SECRET.
//
// Token format: <base64url(payload)>.<base64url(hmac)>  (a minimal JWS/JWT).
// The signature is what makes the cookie tamper-proof: a client can read the
// payload but cannot forge a different userId without AUTH_SECRET.

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface SessionPayload {
  sub: string; // user id
  email: string;
  name: string;
  iat: number; // issued-at  (unix seconds)
  exp: number; // expires-at (unix seconds)
}

function base64urlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(str: string): Uint8Array<ArrayBuffer> {
  const padded = str + "=".repeat((4 - (str.length % 4)) % 4);
  const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function getKey(): Promise<CryptoKey> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set — add it to .env to enable login.");
  }
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signToken(payload: SessionPayload): Promise<string> {
  const key = await getKey();
  const body = base64urlEncode(encoder.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return `${body}.${base64urlEncode(new Uint8Array(sig))}`;
}

// Returns the payload only when the signature is valid AND the token has not
// expired. Any tampering, malformed token, or missing secret yields null.
export async function verifyToken(
  token: string | undefined | null,
): Promise<SessionPayload | null> {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;

  const body = token.slice(0, dot);
  const signature = token.slice(dot + 1);

  try {
    const key = await getKey();
    // crypto.subtle.verify does a constant-time comparison internally.
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64urlDecode(signature),
      encoder.encode(body),
    );
    if (!valid) return null;

    const payload = JSON.parse(
      decoder.decode(base64urlDecode(body)),
    ) as SessionPayload;

    if (!payload.sub || typeof payload.exp !== "number") return null;
    if (payload.exp * 1000 <= Date.now()) return null; // expired

    return payload;
  } catch {
    return null;
  }
}
