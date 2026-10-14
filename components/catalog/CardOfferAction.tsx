import Link from "next/link";

import OfferCartControl from "@/components/catalog/OfferCartControl";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth-guard";
import type { CartItem } from "@/lib/cart/store";
import { getOpenConversationLinks } from "@/lib/data/messages";
import { es } from "@/lib/i18n/es";

type Props = { item: CartItem; sellerId: string; sellerUsername: string };

// Reads the session, so it must render behind <Suspense> inside the cached offers list.
export default async function CardOfferAction({ item, sellerId, sellerUsername }: Props) {
  const user = await getCurrentUser();

  if (user?.id === sellerId) {
    return (
      <Link href={`/sell/${item.id}`} className={buttonVariants({ variant: "outline" })}>
        {es.messages.ownListing}
      </Link>
    );
  }
  const conversationId = user ? (await getOpenConversationLinks(user.id))[item.id] : undefined;
  if (conversationId) {
    return (
      <Link href={`/messages/${conversationId}`} className={buttonVariants({ variant: "secondary" })}>
        {es.cart.inConversation}
      </Link>
    );
  }
  return <OfferCartControl item={item} sellerUsername={sellerUsername} />;
}
