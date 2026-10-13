import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth-guard";
import { getUnreadCounts } from "@/lib/data/messages";

// Per-user navbar badge counts; never cached.
export async function GET() {
  const user = await getCurrentUser();
  const counts = user ? await getUnreadCounts(user.id) : { conversations: 0, alerts: 0 };
  return NextResponse.json(counts, { headers: { "Cache-Control": "private, no-store" } });
}
