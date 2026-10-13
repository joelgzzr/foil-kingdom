"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { publishScanDraftsAction } from "@/lib/actions/scan";
import { es } from "@/lib/i18n/es";

export default function PublishScanDraftsButton({ count, canPublish }: { count: number; canPublish: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="secondary"
      disabled={pending || !canPublish}
      onClick={() =>
        startTransition(async () => {
          const result = await publishScanDraftsAction();
          if (result.ok) toast.success(result.message);
          else toast.error(result.message);
          router.refresh();
        })
      }
    >
      {es.scan.publishDrafts(count)}
    </Button>
  );
}
