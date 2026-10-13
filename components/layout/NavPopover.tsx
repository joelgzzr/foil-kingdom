"use client";

import { Bell, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import MarkNotificationsReadButton from "@/components/trust/MarkNotificationsReadButton";
import { buttonVariants } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { es } from "@/lib/i18n/es";
import type { NavItem } from "@/lib/nav/types";

const KINDS = {
  messages: { icon: MessageCircle, viewAll: "/messages", empty: () => es.messages.empty },
  alerts: { icon: Bell, viewAll: "/notifications", empty: () => es.trust.notifications.empty },
} as const;

export default function NavPopover({
  kind,
  label,
  badge = 0,
}: {
  kind: keyof typeof KINDS;
  label: string;
  badge?: number;
}) {
  const { icon: Icon, viewAll, empty } = KINDS[kind];
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NavItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  async function load() {
    try {
      const response = await fetch(`/api/nav/${kind}`);
      if (!response.ok) throw new Error("load_failed");
      setItems(await response.json());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void load();
      }}
    >
      <PopoverTrigger
        title={label}
        aria-label={badge > 0 ? `${label} (${badge})` : label}
        className={`${buttonVariants({ variant: "ghost", size: "icon" })} relative cursor-pointer`}
      >
        <Icon className="size-4.5" aria-hidden />
        {badge > 0 ? (
          <span
            aria-hidden
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium leading-none text-primary-foreground"
          >
            {badge > 9 ? "9+" : badge}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent>
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <p className="font-medium">{label}</p>
          {kind === "alerts" && items?.some((item) => item.unread) ? <MarkNotificationsReadButton /> : null}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {failed ? (
            <p className="px-3 py-6 text-center text-muted-foreground">{es.errors.generic}</p>
          ) : items === null ? (
            <p className="px-3 py-6 text-center text-muted-foreground">{es.nav.loading}</p>
          ) : items.length === 0 ? (
            <p className="px-3 py-6 text-center text-muted-foreground">{empty()}</p>
          ) : (
            <ul className="grid divide-y">
              {items.map((item) => {
                const content = (
                  <>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate ${item.unread ? "font-medium" : "text-muted-foreground"}`}>{item.title}</span>
                      {item.lines.map((line, index) => (
                        <span key={index} className="block truncate text-xs text-muted-foreground">
                          {line}
                        </span>
                      ))}
                    </span>
                    {item.meta ? <span className="text-xs text-muted-foreground">{item.meta}</span> : null}
                    {item.unread ? <span aria-hidden className="size-2 shrink-0 rounded-full bg-primary" /> : null}
                  </>
                );
                return (
                  <li key={item.id}>
                    {item.href ? (
                      <Link href={item.href} onClick={() => setOpen(false)} className="flex items-center gap-3 px-3 py-2 hover:bg-muted">
                        {content}
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3 px-3 py-2">{content}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <Link
          href={viewAll}
          onClick={() => setOpen(false)}
          className="block border-t px-3 py-2 text-center text-sm text-primary hover:bg-muted"
        >
          {es.nav.viewAll}
        </Link>
      </PopoverContent>
    </Popover>
  );
}
