"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { signUpAction } from "@/lib/actions/auth";
import { es } from "@/lib/i18n/es";
import { signupSchema, type SignupInput } from "@/lib/schemas/auth";

export default function SignupForm() {
  const router = useRouter();
  const [pendingConfirmation, setPendingConfirmation] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({ resolver: zodResolver(signupSchema) });

  async function onSubmit(values: SignupInput) {
    const result = await signUpAction(values);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    if (result.data?.signedIn) {
      router.replace("/account");
      router.refresh();
      return;
    }
    setPendingConfirmation(true);
  }

  if (pendingConfirmation) {
    return (
      <p role="status" className="rounded-lg bg-muted p-4 text-sm">
        {es.auth.checkEmail}
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4" noValidate>
      <Field id="username" label={es.auth.username} hint={es.auth.usernameHint} error={errors.username?.message}>
        <Input
          id="username"
          autoComplete="username"
          autoCapitalize="none"
          aria-invalid={!!errors.username}
          {...register("username")}
        />
      </Field>
      <Field id="displayName" label={es.auth.displayName} error={errors.displayName?.message}>
        <Input id="displayName" autoComplete="name" {...register("displayName")} />
      </Field>
      <Field id="email" label={es.auth.email} error={errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register("email")} />
      </Field>
      <Field id="password" label={es.auth.password} error={errors.password?.message}>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.password}
          {...register("password")}
        />
      </Field>
      <div className="grid gap-1.5">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5 size-4" aria-invalid={!!errors.acceptTerms} {...register("acceptTerms")} />
          <span>
            {es.legal.acceptTerms}{" "}
            <Link href="/legal/terminos" target="_blank" className="underline">
              {es.legal.termsLink}
            </Link>{" "}
            {es.legal.acceptTermsAnd}{" "}
            <Link href="/legal/privacidad" target="_blank" className="underline">
              {es.legal.privacyLink}
            </Link>
          </span>
        </label>
        {errors.acceptTerms ? (
          <p role="alert" className="text-xs text-destructive">
            {errors.acceptTerms.message}
          </p>
        ) : null}
      </div>
      <Button type="submit" size="lg" disabled={isSubmitting}>
        {es.auth.submitSignup}
      </Button>
    </form>
  );
}
