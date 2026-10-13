"use client";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { es } from "@/lib/i18n/es";

// Uses the native share sheet when available (mobile, WhatsApp) and falls back to copying the link.
export default function ShareCollectionButton({ title, path }: { title: string; path: string }) {
  async function onShare() {
    const url = new URL(path, window.location.origin).toString();
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success(es.collection.shareCopied);
    } catch (error) {
      // Dismissing the share sheet rejects with AbortError; that is not a failure.
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error(es.collection.shareError);
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={onShare}>
      {es.collection.share}
    </Button>
  );
}
