"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { updateWhatsappAction } from "@/lib/actions/profile";
import { es } from "@/lib/i18n/es";
import { whatsappSchema, type WhatsappInput } from "@/lib/schemas/profile";

export default function WhatsappForm({ defaultValues }: { defaultValues: WhatsappInput }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<WhatsappInput>({ resolver: zodResolver(whatsappSchema), defaultValues });

  async function onSubmit(values: WhatsappInput) {
    const result = await updateWhatsappAction(values);
    if (!result.ok) toast.error(result.message);
    else toast.success(result.message ?? es.account.saved);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4" noValidate>
      <Field id="whatsapp" label={es.account.whatsappNumber} error={errors.number?.message}>
        <Input id="whatsapp" type="tel" inputMode="numeric" autoComplete="tel-national" {...register("number")} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4 accent-primary" {...register("visible")} />
        {es.account.whatsappVisible}
      </label>
      <Button type="submit" disabled={isSubmitting} className="justify-self-start">
        {es.account.save}
      </Button>
    </form>
  );
}
