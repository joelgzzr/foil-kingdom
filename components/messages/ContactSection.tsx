import Link from "next/link";

import ContactSellerButton from "@/components/messages/ContactSellerButton";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth-guard";
import { es } from "@/lib/i18n/es";

// Reads the session, so it must render behind <Suspense> on the cached listing page.
export default async function ContactSection({ listingId, sellerId }: { listingId: string; sellerId: string }) {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Link href={`/login?next=${encodeURIComponent(`/listings/${listingId}`)}`} className={buttonVariants({ size: "lg" })}>
        {es.messages.loginToContact}
      </Link>
    );
  }

  if (user.id === sellerId) {
    return (
      <Link href={`/sell/${listingId}`} className={buttonVariants({ size: "lg", variant: "outline" })}>
        {es.messages.ownListing}
      </Link>
    );
  }

  return <ContactSellerButton listingId={listingId} />;
}
