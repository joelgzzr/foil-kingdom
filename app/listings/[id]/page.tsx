import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { getListingCardPath } from "@/lib/data/listings";

type Props = PageProps<"/listings/[id]">;

async function ListingRedirect({ params }: { params: Props["params"] }): Promise<null> {
  const { id } = await params; // Next.js 16: params is a Promise
  const path = await getListingCardPath(id);
  if (!path) notFound();
  redirect(path);
}

// Listings live on their card page; this keeps old links and notifications working.
export default function ListingRedirectPage({ params }: Props) {
  return (
    <Suspense fallback={null}>
      <ListingRedirect params={params} />
    </Suspense>
  );
}
