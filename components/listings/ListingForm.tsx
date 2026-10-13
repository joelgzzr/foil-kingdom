"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import CardPicker, { type PickedCard } from "@/components/listings/CardPicker";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { createListingAction, updateListingAction } from "@/lib/actions/listings";
import { es } from "@/lib/i18n/es";
import { CONDITIONS, FINISHES, LANGUAGES, listingSchema, type ListingInput } from "@/lib/schemas/listing";

type Props = {
  // When set, the form edits an existing listing (the card is locked).
  listingId?: string;
  // Prefilled card (create mode) or the current values (edit mode).
  defaultValues?: Partial<ListingInput>;
};

const emptyListing = {
  printId: "",
  cardLabel: "",
  condition: "nm",
  language: "en",
  finish: "regular",
  quantity: 1,
  description: "",
  price: 0,
  acceptsOffers: true,
} satisfies ListingInput;

export default function ListingForm({ listingId, defaultValues }: Props) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ListingInput>({ resolver: zodResolver(listingSchema), defaultValues: { ...emptyListing, ...defaultValues } });
  const cardLabel = useWatch({ control, name: "cardLabel" });
  const printId = useWatch({ control, name: "printId" });

  async function onSubmit(values: ListingInput) {
    const result = listingId ? await updateListingAction(listingId, values) : await createListingAction(values);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(result.message ?? es.listing.saved);
    if (listingId) router.refresh();
    else if (result.data) router.push(`/sell/${(result.data as { id: string }).id}`);
  }

  function onPick(card: PickedCard) {
    setValue("printId", card.id, { shouldValidate: true });
    setValue("cardLabel", card.label);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4" noValidate>
      <section className="grid gap-2">
        <h2 className="text-sm font-medium">{es.listing.card}</h2>
        {printId ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border p-3">
            <p className="text-sm font-medium">{cardLabel}</p>
            {listingId ? null : (
              <Button type="button" variant="ghost" size="sm" onClick={() => setValue("printId", "")}>
                {es.listing.changeCard}
              </Button>
            )}
          </div>
        ) : (
          <>
            <CardPicker id="cardPicker" onPick={onPick} />
            {errors.printId ? (
              <p role="alert" className="text-xs text-destructive">
                {errors.printId.message}
              </p>
            ) : null}
          </>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field id="condition" label={es.listing.condition}>
          <NativeSelect id="condition" {...register("condition")}>
            {CONDITIONS.map((value) => (
              <option key={value} value={value}>
                {es.listing.conditions[value]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="language" label={es.listing.language}>
          <NativeSelect id="language" {...register("language")}>
            {LANGUAGES.map((value) => (
              <option key={value} value={value}>
                {es.listing.languages[value]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="finish" label={es.listing.finish}>
          <NativeSelect id="finish" {...register("finish")}>
            {FINISHES.map((value) => (
              <option key={value} value={value}>
                {es.listing.finishes[value]}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="price" label={es.listing.price} hint={es.listing.priceHint} error={errors.price?.message}>
          <Input id="price" type="number" inputMode="decimal" min={1} step="0.01" {...register("price", { valueAsNumber: true })} />
        </Field>
        <Field id="quantity" label={es.listing.quantity} hint={es.listing.quantityHint} error={errors.quantity?.message}>
          <Input id="quantity" type="number" inputMode="numeric" min={1} max={999} {...register("quantity", { valueAsNumber: true })} />
        </Field>
      </div>

      <Field id="description" label={es.listing.description} error={errors.description?.message}>
        <Textarea id="description" maxLength={2000} {...register("description")} />
      </Field>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4 accent-primary" {...register("acceptsOffers")} />
        {es.listing.acceptsOffers}
      </label>

      <Button type="submit" disabled={isSubmitting}>
        {es.listing.save}
      </Button>
    </form>
  );
}
