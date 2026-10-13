import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { searchSellerBrowse } from "@/lib/data/listings";

const bodySchema = z.object({
  sellerId: z.uuid(),
  q: z.string().trim().max(60).optional(),
  page: z.number().int().min(1).max(200),
  exclude: z.array(z.uuid()).max(100),
});

// Pagination and search for the add-cards browser; active listings are public data.
export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const { sellerId, ...options } = parsed.data;
  return NextResponse.json(await searchSellerBrowse(sellerId, options));
}
