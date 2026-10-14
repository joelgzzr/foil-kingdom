"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/action-result";
import { es } from "@/lib/i18n/es";

type Props = {
  trigger: string;
  title: string;
  description: string;
  fieldLabel: string;
  placeholder: string;
  submitLabel: string;
  requiredMessage: string;
  minLength: number;
  maxLength: number;
  triggerVariant?: "ghost" | "outline" | "destructive";
  // The server action receives the trimmed text; it validates again.
  onSubmit: (text: string) => Promise<ActionResult<unknown>>;
};

// Dialog that asks for a required free-text reason before running an action.
export default function OrderReasonDialog({
  trigger,
  title,
  description,
  fieldLabel,
  placeholder,
  submitLabel,
  requiredMessage,
  minLength,
  maxLength,
  triggerVariant = "ghost",
  onSubmit,
}: Props) {
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = text.trim();
    if (trimmed.length < minLength) {
      setError(requiredMessage);
      return;
    }
    setError(undefined);
    startTransition(async () => {
      const result = await onSubmit(trimmed);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      if (result.message) toast.success(result.message);
      setText("");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant={triggerVariant} size="sm" />}>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <Field id={id} label={fieldLabel} error={error}>
            <Textarea id={id} value={text} rows={4} maxLength={maxLength} placeholder={placeholder} onChange={(event) => setText(event.target.value)} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>
              {es.orders.cancelDialog.keep}
            </Button>
            <Button type="submit" variant="destructive" disabled={pending}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
