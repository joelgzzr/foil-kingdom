import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth-guard";
import { getNavItems, NAV_KINDS, type NavKind } from "@/lib/nav/items";

// Per-user navbar previews; never cached.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!(NAV_KINDS as readonly string[]).includes(kind)) return new NextResponse(null, { status: 404 });

  const user = await getCurrentUser();
  const items = user ? await getNavItems(kind as NavKind, user.id) : [];
  return NextResponse.json(items, { headers: { "Cache-Control": "private, no-store" } });
}
