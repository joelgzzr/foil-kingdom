import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import InboxLiveRefresh from "@/components/messages/InboxLiveRefresh";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth-guard";
import { getConversations } from "@/lib/data/messages";
import { es } from "@/lib/i18n/es";
import { previewText } from "@/lib/messages/preview";

export const metadata: Metadata = { title: es.messages.title };

async function Inbox() {
  const user = await requireUser();
  const conversations = await getConversations(user.id);

  if (conversations.length === 0) {
    return (
      <>
        <InboxLiveRefresh userId={user.id} />
        <p className="py-10 text-center text-muted-foreground">{es.messages.empty}</p>
      </>
    );
  }

  return (
    <>
      <InboxLiveRefresh userId={user.id} />
      <ul className="grid divide-y rounded-xl border">
        {conversations.map((conversation) => (
          <li key={conversation.id}>
            <Link href={`/messages/${conversation.id}`} className="flex items-center gap-3 p-3 hover:bg-muted">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{conversation.otherName}</p>
                <p className="truncate text-xs text-muted-foreground">{conversation.listingTitle}</p>
                <p className="truncate text-xs">{previewText(conversation.lastMessageKind, conversation.lastMessagePreview)}</p>
              </div>
              {conversation.unread ? <Badge>{es.messages.unread}</Badge> : null}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

export default function MessagesPage() {
  return (
    <main className="mx-auto grid w-full max-w-2xl gap-4 px-4 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{es.messages.title}</h1>
        <p className="text-sm text-muted-foreground">{es.messages.subtitle}</p>
      </header>
      <Suspense fallback={<div className="h-64" aria-hidden />}>
        <Inbox />
      </Suspense>
    </main>
  );
}
