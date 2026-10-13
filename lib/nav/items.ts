import "server-only";

import { getConversations } from "@/lib/data/messages";
import { getNotifications } from "@/lib/data/trust";
import { previewText } from "@/lib/messages/preview";
import type { NavItem } from "@/lib/nav/types";
import { describeNotification } from "@/lib/notifications/describe";

export const NAV_KINDS = ["messages", "alerts"] as const;
export type NavKind = (typeof NAV_KINDS)[number];

const LIMIT = 6;

export async function getNavItems(kind: NavKind, userId: string): Promise<NavItem[]> {
  if (kind === "messages") {
    const conversations = await getConversations(userId);
    return conversations.slice(0, LIMIT).map((conversation) => ({
      id: conversation.id,
      href: `/messages/${conversation.id}`,
      title: conversation.otherName,
      lines: [conversation.listingTitle, previewText(conversation.lastMessageKind, conversation.lastMessagePreview)].filter(Boolean),
      unread: conversation.unread,
    }));
  }

  const notifications = await getNotifications(userId);
  // Message/order notifications live in the conversations; only standalone alerts are listed.
  return notifications
    .filter((notification) => !notification.conversation_id)
    .slice(0, LIMIT)
    .map((notification) => {
      const { text, href } = describeNotification(notification);
      return {
        id: notification.id,
        href,
        title: text,
        lines: [],
        meta: new Date(notification.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short" }),
        unread: !notification.read_at,
      };
    });
}
