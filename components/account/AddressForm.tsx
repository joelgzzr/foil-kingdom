"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { createAddressAction } from "@/lib/actions/addresses";
import { es } from "@/lib/i18n/es";
import { MX_STATES } from "@/lib/mx";
import { addressSchema, type AddressInput } from "@/lib/schemas/address";

const emptyAddress: Partial<AddressInput> = {
  label: "",
  recipientName: "",
  phone: "",
  street: "",
  exteriorNumber: "",
  interiorNumber: "",
  neighborhood: "",
  municipality: "",
  postalCode: "",
  reference: "",
  isDefault: false,
};

export default function AddressForm({ onSaved }: { onSaved: () => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AddressInput>({ resolver: zodResolver(addressSchema), defaultValues: emptyAddress });

  async function onSubmit(values: AddressInput) {
    const result = await createAddressAction(values);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(result.message ?? es.account.addressSaved);
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3" noValidate>
      <Field id="label" label={es.address.label} error={errors.label?.message}>
        <Input id="label" {...register("label")} />
      </Field>
      <Field id="recipientName" label={es.address.recipientName} error={errors.recipientName?.message}>
        <Input id="recipientName" autoComplete="name" {...register("recipientName")} />
      </Field>
      <Field id="addressPhone" label={es.address.phone} error={errors.phone?.message}>
        <Input id="addressPhone" type="tel" inputMode="numeric" autoComplete="tel-national" {...register("phone")} />
      </Field>
      <Field id="street" label={es.address.street} error={errors.street?.message}>
        <Input id="street" autoComplete="address-line1" {...register("street")} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field id="exteriorNumber" label={es.address.exteriorNumber} error={errors.exteriorNumber?.message}>
          <Input id="exteriorNumber" {...register("exteriorNumber")} />
        </Field>
        <Field id="interiorNumber" label={es.address.interiorNumber} error={errors.interiorNumber?.message}>
          <Input id="interiorNumber" {...register("interiorNumber")} />
        </Field>
      </div>
      <Field id="neighborhood" label={es.address.neighborhood} error={errors.neighborhood?.message}>
        <Input id="neighborhood" {...register("neighborhood")} />
      </Field>
      <Field id="municipality" label={es.address.municipality} error={errors.municipality?.message}>
        <Input id="municipality" autoComplete="address-level2" {...register("municipality")} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field id="addressState" label={es.address.state} error={errors.state?.message}>
          <NativeSelect id="addressState" aria-invalid={!!errors.state} {...register("state")}>
            <option value="" />
            {MX_STATES.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="postalCode" label={es.address.postalCode} error={errors.postalCode?.message}>
          <Input
            id="postalCode"
            inputMode="numeric"
            maxLength={5}
            autoComplete="postal-code"
            {...register("postalCode")}
          />
        </Field>
      </div>
      <Field id="reference" label={es.address.reference} error={errors.reference?.message}>
        <Input id="reference" {...register("reference")} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4 accent-primary" {...register("isDefault")} />
        {es.address.makeDefault}
      </label>
      <Button type="submit" disabled={isSubmitting}>
        {es.account.save}
      </Button>
    </form>
  );
}
