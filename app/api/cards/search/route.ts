import { NextResponse, type NextRequest } from "next/server";

import { lookupCards } from "@/lib/data/catalog";

// Typeahead for the listing form; public catalog data only.
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  if (q.length < 2 || q.length > 60) return NextResponse.json([]);
  return NextResponse.json(await lookupCards(q));
}
