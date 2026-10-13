import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import ConversationItemsPanel from "@/components/messages/ConversationItemsPanel";
import ConversationTabs from "@/components/messages/ConversationTabs";
import ConversationThread from "@/components/messages/ConversationThread";
import SellerCardsBrowser from "@/components/messages/SellerCardsBrowser";
import OrderPanel from "@/components/orders/OrderPanel";
import PendingRatings from "@/components/trust/PendingRatings";
import { requireUser } from "@/lib/auth-guard";
import { getSellerBrowseSections } from "@/lib/data/listings";
import { getConversation } from "@/lib/data/messages";
import { hasPendingOrder } from "@/lib/data/orders";
import { es } from "@/lib/i18n/es";

export const metadata: Metadata = { title: es.messages.title };

// Keep in sync with add_conversation_items in the database.
const MAX_CONVERSATION_ITEMS = 50;

type BrowserProps = { conversationId: string; sellerId: string; itemListingIds: string[] };

// Buyer-only; reads the session, so it streams in behind its own <Suspense>.
async function SellerCardsSection({ conversationId, sellerId, itemListingIds }: BrowserProps) {
  const slots = MAX_CONVERSATION_ITEMS - itemListingIds.length;
  if (slots <= 0 || (await hasPendingOrder(conversationId))) return null;

  const sections = await getSellerBrowseSections(sellerId, itemListingIds);
  return (
    <SellerCardsBrowser
      key={sections.conversationIds.join(",")}
      conversationId={conversationId}
      sellerId={sellerId}
      featured={sections.featured}
      related={sections.related}
      rest={sections.rest}
      conversationIds={sections.conversationIds}
      sectionIds={sections.sectionIds}
      slots={slots}
    />
  );
}

async function Thread({ params }: { params: PageProps<"/messages/[id]">["params"] }) {
  const { id } = await params;
  const user = await requireUser();
  const conversation = await getConversation(id, user.id);
  if (!conversation) notFound();

  const { items } = conversation;
  const totalCopies = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="grid gap-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">{conversation.otherName}</h1>
        <p className="text-sm text-muted-foreground">
          {es.messages.about}:{" "}
          <Link href={`/sellers/${conversation.sellerUsername}`} className="underline">
            {conversation.listingTitle}
          </Link>
        </p>
      </header>
      <ConversationTabs
        chat={
          <>
            <OrderPanel
              conversationId={conversation.id}
              userId={user.id}
              role={conversation.role}
              defaultPriceCents={Math.max(conversation.agreedTotalCents, 100)}
              canCreate={items.length > 0}
              totalCopies={totalCopies}
              hasUnavailableItems={items.some((item) => !item.available)}
            />
            <Suspense fallback={null}>
              <PendingRatings conversationId={conversation.id} userId={user.id} />
            </Suspense>
            <ConversationThread
              conversationId={conversation.id}
              currentUserId={user.id}
              role={conversation.role}
              initialMessages={conversation.messages}
              items={items.map((item) => ({
                id: item.id,
                title: item.title,
                available: item.available,
                acceptsOffers: item.acceptsOffers,
              }))}
            />
          </>
        }
        cards={
          <>
            <ConversationItemsPanel
              role={conversation.role}
              items={items}
              listTotalCents={conversation.listTotalCents}
              agreedTotalCents={conversation.agreedTotalCents}
            />
            {conversation.role === "buyer" ? (
              <Suspense fallback={<div className="h-64 rounded-xl border" aria-hidden />}>
                <SellerCardsSection
                  conversationId={conversation.id}
                  sellerId={conversation.sellerId}
                  itemListingIds={items.map((item) => item.listingId)}
                />
              </Suspense>
            ) : null}
          </>
        }
      />
    </div>
  );
}

export default function ConversationPage({ params }: PageProps<"/messages/[id]">) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <Link href="/messages" className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground">
        ← {es.messages.title}
      </Link>
      <Suspense fallback={<div className="h-96" aria-hidden />}>
        <Thread params={params} />
      </Suspense>
    </main>
  );
}
