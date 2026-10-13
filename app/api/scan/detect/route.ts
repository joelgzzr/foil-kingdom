import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth-guard";
import { MAX_PAGE_BYTES, readScanImage } from "@/lib/scan/image";
import { identifyCards } from "@/lib/scan/identify";
import { dailyScanPageLimit, getVisionProvider, usdMxnRate } from "@/lib/scan/index";
import type { DetectResponse } from "@/lib/scan/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

// Finds the cards on one photo of a binder page and looks each one up in the catalog. Nothing is stored: the image goes
// to the vision provider and is dropped.
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("banned_at").eq("id", user.id).single();
  if (!profile || profile.banned_at) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("image");
  if (!(file instanceof File)) return NextResponse.json({ error: "invalid_image" }, { status: 400 });

  const image = await readScanImage(file, MAX_PAGE_BYTES);
  if (!image) return NextResponse.json({ error: "invalid_image" }, { status: 400 });

  const admin = createAdminClient();
  // Counted before the paid call so parallel requests cannot burst past the daily cap.
  const { data: allowed, error } = await admin.rpc("record_scan_page", {
    p_user_id: user.id,
    p_cards: 0,
    p_max_pages: dailyScanPageLimit(),
  });
  if (error) return NextResponse.json({ error: "provider_failed" }, { status: 502 });
  if (!allowed) return NextResponse.json({ error: "daily_limit" }, { status: 429 });

  try {
    const cards = await getVisionProvider().detectCards(image);
    const results = await identifyCards(cards);
    await admin.rpc("record_scan_stats", { p_user_id: user.id, p_detected: cards.length, p_corrected: 0 });
    return NextResponse.json({ cards, results, usdMxnRate: usdMxnRate() } satisfies DetectResponse);
  } catch {
    return NextResponse.json({ error: "provider_failed" }, { status: 502 });
  }
}
