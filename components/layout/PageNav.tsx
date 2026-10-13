import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { es } from "@/lib/i18n/es";

type Props = { page: number; pageCount: number; hrefForPage: (page: number) => string };

// Previous/next links; both props are rendered on the server, so passing a function is safe.
export default function PageNav({ page, pageCount, hrefForPage }: Props) {
  if (pageCount <= 1) return null;

  return (
    <nav aria-label="Paginación" className="flex items-center justify-between gap-2">
      {page > 1 ? (
        <Link href={hrefForPage(page - 1)} className={buttonVariants({ variant: "outline" })}>
          {es.catalog.previous}
        </Link>
      ) : (
        <span />
      )}
      <span className="text-sm text-muted-foreground">{es.catalog.page(page, pageCount)}</span>
      {page < pageCount ? (
        <Link href={hrefForPage(page + 1)} className={buttonVariants({ variant: "outline" })}>
          {es.catalog.next}
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
