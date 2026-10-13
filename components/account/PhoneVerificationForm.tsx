"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { BadgeCheck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { requestPhoneVerificationAction, verifyPhoneAction } from "@/lib/actions/profile";
import { es } from "@/lib/i18n/es";
import { phoneVerifySchema, type PhoneVerifyInput } from "@/lib/schemas/profile";

export default function PhoneVerificationForm({ verified }: { verified: boolean }) {
  const [codeSent, setCodeSent] = useState(false);
  const {
    register,
    handleSubmit,
    getValues,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<PhoneVerifyInput>({ resolver: zodResolver(phoneVerifySchema), defaultValues: { phone: "", code: "" } });

  if (verified) {
    return (
      <Badge variant="secondary" className="gap-1">
        <BadgeCheck className="size-3.5" />
        {es.account.phoneVerified}
      </Badge>
    );
  }

  async function sendCode() {
    if (!(await trigger("phone"))) return;
    const result = await requestPhoneVerificationAction({ phone: getValues("phone") });
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    setCodeSent(true);
    toast.success(result.message ?? es.account.codeSent);
  }

  async function onVerify(values: PhoneVerifyInput) {
    const result = await verifyPhoneAction(values);
    if (!result.ok) toast.error(result.message);
    else toast.success(result.message ?? es.account.phoneVerifiedToast);
  }

  return (
    <form onSubmit={handleSubmit(onVerify)} className="grid gap-4" noValidate>
      <Field id="phone" label={es.account.phoneNumber} error={errors.phone?.message}>
        <div className="flex gap-2">
          <Input id="phone" type="tel" inputMode="numeric" autoComplete="tel-national" {...register("phone")} />
          <Button type="button" variant="outline" onClick={sendCode}>
            {es.account.sendCode}
          </Button>
        </div>
      </Field>
      {codeSent ? (
        <>
          <Field id="code" label={es.account.codeLabel} error={errors.code?.message}>
            <Input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} {...register("code")} />
          </Field>
          <Button type="submit" disabled={isSubmitting} className="justify-self-start">
            {es.account.verify}
          </Button>
        </>
      ) : null}
    </form>
  );
}
