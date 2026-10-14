import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth-guard";
import { getListingTilesByIds } from "@/lib/data/listings";
import { getOpenConversationLinks } from "@/lib/data/messages";
import { getCartSellers } from "@/lib/data/trust";

// 50 listings per seller (start_conversation limit) across a reasonable number of sellers.
const bodySchema = z.object({ ids: z.array(z.uuid()).min(1).max(500) });

// Revalidates carts: active listings and public seller info, plus the viewer's own open conversation cards.
export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const [listings, user] = await Promise.all([getListingTilesByIds(parsed.data.ids), getCurrentUser()]);
  const sellers = await getCartSellers([...new Set(listings.map((listing) => listing.sellerUsername))]);
  const visible = new Set(sellers.map((seller) => seller.username));
  const inConversation = user ? Object.keys(await getOpenConversationLinks(user.id)) : [];

  return NextResponse.json({
    listings: listings.filter((listing) => visible.has(listing.sellerUsername)),
    sellers,
    inConversation,
  });
}
