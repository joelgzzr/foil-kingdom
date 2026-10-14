"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";
import { createOrderAction } from "@/lib/actions/orders";
import type { UserAddressOption } from "@/lib/data/orders";
import { es } from "@/lib/i18n/es";
import { formatMXN } from "@/lib/money";
import { PACKAGE_PRESET_IDS } from "@/lib/orders/packages";
import { createOrderSchema, type CreateOrderInput } from "@/lib/schemas/order";

type Props = {
  conversationId: string;
  addresses: UserAddressOption[];
  agreedPriceCents: number;
  // Copies across every card of the bundle, to help pick the package.
  totalCopies: number;
  // Cards that stopped being available block the order until someone removes them.
  hasUnavailableItems: boolean;
};

export default function CreateOrderForm({ conversationId, addresses, agreedPriceCents, totalCopies, hasUnavailableItems }: Props) {
  const router = useRouter();
  const copy = es.orders.create;
  const form = useForm<CreateOrderInput>({
    resolver: zodResolver(createOrderSchema),
    defaultValues: {
      packagePreset: "envelope",
      originAddressId: (addresses.find((address) => address.is_default) ?? addresses[0])?.id ?? "",
    },
  });
  const errors = form.formState.errors;

  async function onSubmit(values: CreateOrderInput) {
    const result = await createOrderAction(conversationId, values);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(result.message);
    router.refresh();
  }

  return (
    <section className="grid gap-3 rounded-xl border p-4" aria-labelledby="create-order-title">
      <header>
        <h2 id="create-order-title" className="font-medium">
          {copy.title}
        </h2>
        <p className="text-sm text-muted-foreground">{copy.description}</p>
      </header>

      {addresses.length === 0 ? (
        <div className="grid gap-2">
          <p className="text-sm">{copy.noAddress}</p>
          <Link href="/account" className={buttonVariants({ variant: "outline", size: "sm" })}>
            {copy.addAddress}
          </Link>
        </div>
      ) : (
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3" noValidate>
          <div className="grid gap-0.5">
            <p className="text-sm text-muted-foreground">{copy.price}</p>
            <p className="text-lg font-semibold">{formatMXN(agreedPriceCents)}</p>
            <p className="text-xs text-muted-foreground">{copy.priceHint}</p>
          </div>
          <Field id="orderPackage" label={copy.package} hint={copy.packageHint(totalCopies)} error={errors.packagePreset?.message}>
            <NativeSelect id="orderPackage" {...form.register("packagePreset")}>
              {PACKAGE_PRESET_IDS.map((id) => (
                <option key={id} value={id}>
                  {es.orders.packages[id]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field id="orderOrigin" label={copy.origin} error={errors.originAddressId?.message}>
            <NativeSelect id="orderOrigin" {...form.register("originAddressId")}>
              {addresses.map((address) => (
                <option key={address.id} value={address.id}>
                  {`${address.label ?? address.street} · ${address.municipality}, ${address.state} ${address.postal_code}`}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <div>
            <Button type="submit" disabled={form.formState.isSubmitting || hasUnavailableItems}>
              {copy.submit}
            </Button>
            {hasUnavailableItems ? <p className="mt-2 text-sm text-destructive">{es.messages.items.removeUnavailableHint}</p> : null}
          </div>
        </form>
      )}
    </section>
  );
}
