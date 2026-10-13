"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { signInAction } from "@/lib/actions/auth";
import { es } from "@/lib/i18n/es";
import { safeNextPath } from "@/lib/safe-redirect";
import { loginSchema, type LoginInput } from "@/lib/schemas/auth";

export default function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginInput) {
    const result = await signInAction(values);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    router.replace(safeNextPath(next));
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4" noValidate>
      <Field id="email" label={es.auth.email} error={errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register("email")} />
      </Field>
      <Field id="password" label={es.auth.password} error={errors.password?.message}>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!errors.password}
          {...register("password")}
        />
      </Field>
      <Button type="submit" size="lg" disabled={isSubmitting}>
        {es.auth.submitLogin}
      </Button>
    </form>
  );
}
