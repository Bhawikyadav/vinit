// Who is signed in — used by the UserBar to show the current account.
// Returns only the display fields, never the user id or anything sensitive.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ email: session.email, name: session.name });
}
