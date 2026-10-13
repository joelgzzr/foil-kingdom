"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { submitReportAction } from "@/lib/actions/reports";
import { es } from "@/lib/i18n/es";
import { REPORT_REASONS } from "@/lib/schemas/trust";

type Props = { targetType: "listing" | "user"; targetId: string };

export default function ReportForm({ targetType, targetId }: Props) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REPORT_REASONS)[number]>("fraud");
  const [details, setDetails] = useState("");

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await submitReportAction(targetType, targetId, { reason, details });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      setDetails("");
      setOpen(false);
    });
  }

  const id = `report-${targetType}-${targetId}`;

  return (
    <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)} className="text-sm">
      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">{es.trust.reports.open}</summary>
      <form onSubmit={onSubmit} className="mt-2 grid gap-3 rounded-xl border p-3">
        <h2 className="font-medium">
          {targetType === "listing" ? es.trust.reports.listingTitle : es.trust.reports.userTitle}
        </h2>
        <Field id={`${id}-reason`} label={es.trust.reports.reason}>
          <NativeSelect id={`${id}-reason`} value={reason} onChange={(event) => setReason(event.target.value as typeof reason)}>
            {REPORT_REASONS.map((value) => (
              <option key={value} value={value}>
                {es.trust.reports.reasons[value]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id={`${id}-details`} label={es.trust.reports.details}>
          <Textarea id={`${id}-details`} value={details} maxLength={1000} rows={3} onChange={(event) => setDetails(event.target.value)} />
        </Field>
        <div>
          <Button type="submit" variant="destructive" disabled={pending}>
            {es.trust.reports.submit}
          </Button>
        </div>
      </form>
    </details>
  );
}
