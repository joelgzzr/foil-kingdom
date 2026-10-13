import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import MarkNotificationsReadButton from "@/components/trust/MarkNotificationsReadButton";
import { requireUser } from "@/lib/auth-guard";
import { getNotifications } from "@/lib/data/trust";
import { es } from "@/lib/i18n/es";
import { describeNotification } from "@/lib/notifications/describe";

export const metadata: Metadata = { title: es.trust.notifications.title };

async function NotificationList() {
  const user = await requireUser();
  const notifications = await getNotifications(user.id);
  // Message/order notifications live in the conversations; only standalone alerts are listed here.
  const alerts = notifications.filter((notification) => !notification.conversation_id);

  if (alerts.length === 0) {
    return <p className="py-10 text-center text-muted-foreground">{es.trust.notifications.empty}</p>;
  }

  return (
    <div className="grid gap-3">
      {alerts.some((notification) => !notification.read_at) ? (
        <div>
          <MarkNotificationsReadButton />
        </div>
      ) : null}
      <ul className="grid divide-y rounded-xl border">
        {alerts.map((notification) => {
          const { text, href } = describeNotification(notification);
          const content = (
            <>
              <span className={notification.read_at ? "text-muted-foreground" : "font-medium"}>{text}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(notification.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
              </span>
            </>
          );
          return (
            <li key={notification.id}>
              {href ? (
                <Link href={href} className="flex items-center justify-between gap-3 p-3 text-sm hover:bg-muted">
                  {content}
                </Link>
              ) : (
                <div className="flex items-center justify-between gap-3 p-3 text-sm">{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">{es.trust.notifications.title}</h1>
      <Suspense fallback={<div className="h-48" aria-hidden />}>
        <NotificationList />
      </Suspense>
    </main>
  );
}
