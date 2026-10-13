"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { addListingPhotoAction, removeListingPhotoAction } from "@/lib/actions/listings";
import { es } from "@/lib/i18n/es";
import { MAX_PHOTOS } from "@/lib/schemas/listing";
import { createClient } from "@/lib/supabase/client";

const MAX_BYTES = 5 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

type Props = { listingId: string; userId: string; photos: { id: string; url: string }[] };

export default function ListingPhotosManager({ listingId, userId, photos }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onFilesSelected(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const supabase = createClient();
    let remaining = MAX_PHOTOS - photos.length;

    for (const file of Array.from(files)) {
      if (remaining <= 0) {
        toast.error(es.listing.photosHint);
        break;
      }
      const extension = EXTENSIONS[file.type];
      if (!extension || file.size > MAX_BYTES) {
        toast.error(`${file.name}: ${es.listing.photosHint}`);
        continue;
      }

      // Storage RLS only allows writes under <user id>/.
      const path = `${userId}/${listingId}/${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage.from("listing-photos").upload(path, file, { contentType: file.type });
      if (error) {
        toast.error(es.errors.generic);
        continue;
      }
      const result = await addListingPhotoAction(listingId, path);
      if (!result.ok) {
        await supabase.storage.from("listing-photos").remove([path]);
        toast.error(result.message);
        continue;
      }
      remaining -= 1;
    }

    if (inputRef.current) inputRef.current.value = "";
    setBusy(false);
    router.refresh();
  }

  async function onRemove(photoId: string) {
    setBusy(true);
    const result = await removeListingPhotoAction(photoId);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="grid gap-3">
      <p className="text-xs text-muted-foreground">{es.listing.photosHint}</p>
      {photos.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {photos.map((photo) => (
            <li key={photo.id} className="grid gap-1.5">
              <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
                <Image src={photo.url} alt="" fill sizes="(min-width: 640px) 25vw, 45vw" className="object-cover" />
              </div>
              <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => onRemove(photo.id)}>
                {es.listing.deletePhoto}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        onChange={(event) => onFilesSelected(event.target.files)}
      />
      <div>
        <Button
          type="button"
          variant="outline"
          disabled={busy || photos.length >= MAX_PHOTOS}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? es.listing.uploading : es.listing.addPhotos}
        </Button>
      </div>
    </div>
  );
}
