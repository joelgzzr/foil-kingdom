"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { updateProfileAction } from "@/lib/actions/profile";
import { es } from "@/lib/i18n/es";
import { MX_STATES } from "@/lib/mx";
import { profileSchema, type ProfileInput } from "@/lib/schemas/profile";

type Props = { defaultValues: ProfileInput };

export default function ProfileForm({ defaultValues }: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileInput>({ resolver: zodResolver(profileSchema), defaultValues });

  async function onSubmit(values: ProfileInput) {
    const result = await updateProfileAction(values);
    if (!result.ok) toast.error(result.message);
    else toast.success(result.message ?? es.account.saved);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4" noValidate>
      <Field id="displayName" label={es.auth.displayName} error={errors.displayName?.message}>
        <Input id="displayName" {...register("displayName")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="state" label={es.account.state} error={errors.state?.message}>
          <NativeSelect id="state" {...register("state")}>
            <option value="" />
            {MX_STATES.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="city" label={es.account.city} error={errors.city?.message}>
          <Input id="city" autoComplete="address-level2" {...register("city")} />
        </Field>
      </div>
      <Field id="bio" label={es.account.bio} error={errors.bio?.message}>
        <Textarea id="bio" rows={3} {...register("bio")} />
      </Field>
      <Button type="submit" disabled={isSubmitting} className="justify-self-start">
        {es.account.save}
      </Button>
    </form>
  );
}
