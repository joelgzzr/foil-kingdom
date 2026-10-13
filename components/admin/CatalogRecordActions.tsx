"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resolveCatalogRecordAction } from "@/lib/actions/admin";
import { es } from "@/lib/i18n/es";

export default function CatalogRecordActions({ recordId, suggestedCode }: { recordId: string; suggestedCode: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [code, setCode] = useState(suggestedCode);

  function run(input: { code: string } | { ignore: true }) {
    startTransition(async () => {
      const result = await resolveCatalogRecordAction(recordId, input);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        aria-label={es.admin.catalogCode}
        placeholder={es.admin.catalogCode}
        className="w-36"
        value={code}
        maxLength={30}
        onChange={(event) => setCode(event.target.value)}
      />
      <Button type="button" variant="outline" size="sm" disabled={pending || !code.trim()} onClick={() => run({ code })}>
        {es.admin.catalogAssign}
      </Button>
      <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => run({ ignore: true })}>
        {es.admin.catalogIgnore}
      </Button>
    </div>
  );
}
