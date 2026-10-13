import { es } from "@/lib/i18n/es";

type NotificationLike = { type: string; conversation_id: string | null; data: unknown };

// Notification payloads are server-written JSON; read them defensively.
export function describeNotification(notification: NotificationLike): { text: string; href: string | null } {
  const data = (notification.data ?? {}) as Record<string, unknown>;
  const str = (key: string) => (typeof data[key] === "string" ? (data[key] as string) : "");
  const conversationHref = notification.conversation_id ? `/messages/${notification.conversation_id}` : null;

  switch (notification.type) {
    case "wishlist":
      return { text: es.trust.notifications.wishlist(str("title")), href: str("listing_id") ? `/listings/${str("listing_id")}` : null };
    case "rating":
      return { text: es.trust.notifications.rating(Number(data.stars) || 0), href: null };
    case "report_resolved":
      return { text: es.trust.notifications.reportResolved(str("target"), str("resolution")), href: null };
    default:
      return { text: es.trust.notifications.other, href: conversationHref };
  }
}
