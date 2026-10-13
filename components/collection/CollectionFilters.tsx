import { Search } from "lucide-react";
import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { es } from "@/lib/i18n/es";
import type { CollectionFilters as Filters } from "@/lib/schemas/collection";

// Plain GET form: the search lives in the URL, so a filtered collection is shareable and works without JavaScript.
export default function CollectionFilters({ basePath, filters }: { basePath: string; filters: Filters }) {
  const copy = es.collection;

  return (
    <form action={basePath} role="search" className="flex w-full items-center gap-2 sm:max-w-sm">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          name="q"
          type="search"
          defaultValue={filters.q}
          maxLength={60}
          placeholder={copy.search}
          aria-label={copy.search}
          className="pl-8"
        />
      </div>
      <Button type="submit">{copy.apply}</Button>
      {filters.q ? (
        <Link href={basePath} className={buttonVariants({ variant: "ghost" })}>
          {copy.clear}
        </Link>
      ) : null}
    </form>
  );
}
