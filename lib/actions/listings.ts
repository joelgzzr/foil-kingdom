"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";

import { fail, ok } from "@/lib/action-result";
import { requireActiveUser } from "@/lib/auth-guard";
import { cardLabel } from "@/lib/card-label";
import { es } from "@/lib/i18n/es";
import { listingSchema, MAX_PHOTOS, priceToCents, type ListingInput } from "@/lib/schemas/listing";
import { createClient } from "@/lib/supabase/server";

const idSchema = z.uuid();
const statusSchema = z.enum(["draft", "active", "paused", "sold"]);

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function resolveTitle(supabase: Supabase, printId: string) {
  const { data } = await supabase.from("catalog_prints").select("name, code, variant_label").eq("id", printId).single();
  return data?.name && data.code ? cardLabel(data.name, data.code, data.variant_label) : null;
}

const itemsPayload = (input: ListingInput) => [
  {
    print_id: input.printId,
    condition: input.condition,
    language: input.language,
    finish: input.finish,
    quantity: input.quantity,
  },
];

function refreshListings(id?: string) {
  updateTag("listings");
  revalidatePath("/sell");
  if (id) revalidatePath(`/sell/${id}`);
}

export async function createListingAction(input: unknown) {
  const user = await requireActiveUser();
  const parsed = listingSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? es.errors.generic, "validation");
  const listing = parsed.data;

  const supabase = await createClient();
  const [{ data: game }, title] = await Promise.all([
    supabase.from("games").select("id").eq("slug", "digimon").single(),
    resolveTitle(supabase, listing.printId),
  ]);
  if (!game || !title) return fail(es.errors.generic);

  const { data: created, error } = await supabase
    .from("listings")
    .insert({
      seller_id: user.id,
      game_id: game.id,
      kind: "single",
      title,
      description: listing.description || null,
      price_cents: priceToCents(listing.price),
      accepts_offers: listing.acceptsOffers,
    })
    .select("id")
    .single();
  if (error?.code === "54000") return fail(es.errors.rateLimited, "conflict");
  if (error || !created) return fail(es.errors.generic);

  const { error: itemsError } = await supabase.rpc("replace_listing_items", {
    p_listing_id: created.id,
    p_items: itemsPayload(listing),
  });
  if (itemsError) {
    // The two writes are not atomic; drop the orphan draft.
    await supabase.from("listings").delete().eq("id", created.id);
    return fail(es.errors.generic);
  }

  refreshListings();
  return ok({ id: created.id }, es.listing.created);
}

export async function updateListingAction(id: unknown, input: unknown) {
  const user = await requireActiveUser();
  const parsedId = idSchema.safeParse(id);
  const parsed = listingSchema.safeParse(input);
  if (!parsedId.success) return fail(es.errors.generic, "validation");
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? es.errors.generic, "validation");
  const listing = parsed.data;

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("listings")
    .select("id, kind, status")
    .eq("id", parsedId.data)
    .eq("seller_id", user.id)
    .maybeSingle();
  if (!existing) return fail(es.errors.notFound, "not_found");
  if (existing.kind !== "single" || existing.status === "removed") return fail(es.listing.notEditable, "conflict");

  const title = await resolveTitle(supabase, listing.printId);
  if (!title) return fail(es.errors.generic);

  const { error: itemsError } = await supabase.rpc("replace_listing_items", {
    p_listing_id: existing.id,
    p_items: itemsPayload(listing),
  });
  if (itemsError) return fail(es.errors.generic);

  const { error } = await supabase
    .from("listings")
    .update({
      title,
      description: listing.description || null,
      price_cents: priceToCents(listing.price),
      accepts_offers: listing.acceptsOffers,
    })
    .eq("id", existing.id)
    .eq("seller_id", user.id);
  if (error) return fail(es.errors.generic);

  refreshListings(existing.id);
  return ok(undefined, es.listing.saved);
}

export async function setListingStatusAction(id: unknown, status: unknown) {
  const user = await requireActiveUser();
  const parsedId = idSchema.safeParse(id);
  const parsedStatus = statusSchema.safeParse(status);
  if (!parsedId.success || !parsedStatus.success) return fail(es.errors.generic, "validation");

  const supabase = await createClient();
  const { error } = await supabase
    .from("listings")
    .update({ status: parsedStatus.data })
    .eq("id", parsedId.data)
    .eq("seller_id", user.id);

  if (error) {
    // RLS rejects publishing when the phone is not verified.
    if (parsedStatus.data === "active") return fail(es.listing.phoneRequired, "unauthorized");
    return fail(es.errors.generic);
  }

  refreshListings(parsedId.data);
  return ok(undefined, parsedStatus.data === "active" ? es.listing.published : es.listing.statusChanged);
}

export async function setListingFeaturedAction(id: unknown, featured: unknown) {
  await requireActiveUser();
  const parsedId = idSchema.safeParse(id);
  const parsedFeatured = z.boolean().safeParse(featured);
  if (!parsedId.success || !parsedFeatured.success) return fail(es.errors.generic, "validation");

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_listing_featured", {
    p_listing_id: parsedId.data,
    p_featured: parsedFeatured.data,
  });
  if (error) {
    if (error.code === "54000") return fail(es.collection.tooManyPinned, "conflict");
    if (error.code === "23514") return fail(es.collection.onlyActivePinned, "conflict");
    return fail(es.errors.generic);
  }

  refreshListings(parsedId.data);
  return ok(undefined, parsedFeatured.data ? es.collection.pinned : es.collection.unpinned);
}

export async function deleteListingAction(id: unknown) {
  const user = await requireActiveUser();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return fail(es.errors.generic, "validation");

  const supabase = await createClient();
  const { data: photos } = await supabase.from("listing_photos").select("storage_path").eq("listing_id", parsed.data);
  const { data, error } = await supabase
    .from("listings")
    .delete()
    .eq("id", parsed.data)
    .eq("seller_id", user.id)
    .select("id");
  if (error || !data?.length) return fail(es.listing.notEditable, "conflict");

  if (photos?.length) await supabase.storage.from("listing-photos").remove(photos.map((p) => p.storage_path));

  refreshListings();
  return ok(undefined, es.listing.deleted);
}

export async function addListingPhotoAction(listingId: unknown, storagePath: unknown) {
  const user = await requireActiveUser();
  const parsedId = idSchema.safeParse(listingId);
  const parsedPath = z.string().max(200).safeParse(storagePath);
  if (!parsedId.success || !parsedPath.success) return fail(es.errors.generic, "validation");

  // Uploads are only allowed inside the caller's folder; the path must also belong to this listing.
  const prefix = `${user.id}/${parsedId.data}/`;
  if (!parsedPath.data.startsWith(prefix) || parsedPath.data.includes("..")) return fail(es.errors.generic, "validation");

  const supabase = await createClient();
  const { count } = await supabase
    .from("listing_photos")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", parsedId.data);
  if ((count ?? 0) >= MAX_PHOTOS) return fail(es.listing.photosHint, "validation");

  const { error } = await supabase
    .from("listing_photos")
    .insert({ listing_id: parsedId.data, storage_path: parsedPath.data, position: count ?? 0 });
  if (error) return fail(es.errors.generic);

  refreshListings(parsedId.data);
  return ok();
}

export async function removeListingPhotoAction(photoId: unknown) {
  const user = await requireActiveUser();
  const parsed = idSchema.safeParse(photoId);
  if (!parsed.success) return fail(es.errors.generic, "validation");

  const supabase = await createClient();
  const { data: photo } = await supabase
    .from("listing_photos")
    .select("id, listing_id, storage_path, listings!inner(seller_id)")
    .eq("id", parsed.data)
    .eq("listings.seller_id", user.id)
    .maybeSingle();
  if (!photo) return fail(es.errors.notFound, "not_found");

  const { error } = await supabase.from("listing_photos").delete().eq("id", photo.id);
  if (error) return fail(es.errors.generic);
  await supabase.storage.from("listing-photos").remove([photo.storage_path]);

  refreshListings(photo.listing_id);
  return ok();
}
