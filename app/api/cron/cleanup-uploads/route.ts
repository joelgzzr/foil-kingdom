import { timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

const BATCH_SIZE = 100;
const MAX_PER_RUN = 1000;

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

// Called by the scheduler (vercel.json) with `Authorization: Bearer $CRON_SECRET`.
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return new NextResponse("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: paths, error } = await admin.rpc("orphaned_listing_photo_paths", { p_older_than: "1 day" });
  if (error) return NextResponse.json({ error: "lookup_failed" }, { status: 500 });

  const orphans = (paths ?? []).slice(0, MAX_PER_RUN);
  let removed = 0;
  for (let i = 0; i < orphans.length; i += BATCH_SIZE) {
    const { data } = await admin.storage.from("listing-photos").remove(orphans.slice(i, i + BATCH_SIZE));
    removed += data?.length ?? 0;
  }
  return NextResponse.json({ found: paths?.length ?? 0, removed });
}
