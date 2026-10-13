import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { getCatalogFacets, type CardFilters } from "@/lib/data/catalog";
import { es } from "@/lib/i18n/es";

// Plain GET form: filters live in the URL, so results are shareable and work without JavaScript.
export default async function CatalogFilters({ filters }: { filters: CardFilters }) {
  const facets = await getCatalogFacets();

  const options = (values: string[]) =>
    values.map((value) => (
      <option key={value} value={value}>
        {value}
      </option>
    ));

  return (
    <form action="/cards" className="grid gap-3 rounded-xl border p-3 sm:grid-cols-2 lg:grid-cols-6">
      <div className="sm:col-span-2">
        <Field id="q" label={es.catalog.search}>
          <Input id="q" name="q" defaultValue={filters.q} maxLength={60} />
        </Field>
      </div>
      <Field id="color" label={es.catalog.color}>
        <NativeSelect id="color" name="color" defaultValue={filters.color ?? ""}>
          <option value="">{es.catalog.all}</option>
          {options(facets.colors)}
        </NativeSelect>
      </Field>
      <Field id="type" label={es.catalog.type}>
        <NativeSelect id="type" name="type" defaultValue={filters.type ?? ""}>
          <option value="">{es.catalog.all}</option>
          {options(facets.types)}
        </NativeSelect>
      </Field>
      <Field id="rarity" label={es.catalog.rarity}>
        <NativeSelect id="rarity" name="rarity" defaultValue={filters.rarity ?? ""}>
          <option value="">{es.catalog.all}</option>
          {options(facets.rarities)}
        </NativeSelect>
      </Field>
      <Field id="set" label={es.catalog.set}>
        <NativeSelect id="set" name="set" defaultValue={filters.set ?? ""}>
          <option value="">{es.catalog.all}</option>
          {facets.sets.map((set) => (
            <option key={set.id} value={set.id}>
              {set.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <label className="flex items-center gap-2 text-sm sm:col-span-2 lg:col-span-6">
        <input type="checkbox" name="listed" value="1" defaultChecked={filters.listed} className="size-4" />
        {es.catalog.listedOnly}
      </label>
      <label className="flex items-center gap-2 text-sm sm:col-span-2 lg:col-span-6">
        <input type="checkbox" name="base" value="1" defaultChecked={filters.baseOnly} className="size-4" />
        {es.catalog.baseOnly}
      </label>
      <label className="flex items-center gap-2 text-sm sm:col-span-2 lg:col-span-6">
        <input type="checkbox" name="events" value="1" defaultChecked={filters.eventsOnly} className="size-4" />
        {es.catalog.eventsOnly}
      </label>
      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-6">
        <Button type="submit">{es.catalog.apply}</Button>
        <Link href="/cards" className={buttonVariants({ variant: "ghost" })}>
          {es.catalog.clear}
        </Link>
      </div>
    </form>
  );
}
