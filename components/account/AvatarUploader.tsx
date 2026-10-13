"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { removeAvatarAction, setAvatarAction } from "@/lib/actions/profile";
import { avatarInitials } from "@/lib/avatar";
import { toAvatarBlob } from "@/lib/avatar-image";
import { es } from "@/lib/i18n/es";
import { createClient } from "@/lib/supabase/client";

const MAX_BYTES = 8 * 1024 * 1024;

type Props = { userId: string; avatarUrl: string | null; displayName: string | null; username: string };

export default function AvatarUploader({ userId, avatarUrl, displayName, username }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onFileSelected(file: File | undefined) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > MAX_BYTES) {
      toast.error(es.account.avatarHint);
      return;
    }
    setBusy(true);
    const supabase = createClient();
    // Storage RLS only allows writes under <user id>/.
    const path = `${userId}/${crypto.randomUUID()}.webp`;
    try {
      const blob = await toAvatarBlob(file);
      const { error } = await supabase.storage.from("avatars").upload(path, blob, { contentType: "image/webp" });
      if (error) throw error;
      const result = await setAvatarAction(path);
      if (!result.ok) {
        await supabase.storage.from("avatars").remove([path]);
        toast.error(result.message);
      } else {
        toast.success(result.message ?? es.account.avatarSaved);
        router.refresh();
      }
    } catch {
      toast.error(es.errors.generic);
    } finally {
      if (inputRef.current) inputRef.current.value = "";
      setBusy(false);
    }
  }

  async function onRemove() {
    setBusy(true);
    const result = await removeAvatarAction();
    setBusy(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(result.message ?? es.account.avatarRemoved);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar className="size-16 text-lg">
        {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
        <AvatarFallback className="text-lg">{avatarInitials(displayName, username)}</AvatarFallback>
      </Avatar>
      <div className="grid gap-1.5">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? es.account.avatarUploading : es.account.avatarChange}
          </Button>
          {avatarUrl ? (
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onRemove}>
              {es.account.avatarRemove}
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">{es.account.avatarHint}</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(event) => onFileSelected(event.target.files?.[0])}
      />
    </div>
  );
}
