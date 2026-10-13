"use client";

import { useEffect, useRef, useState } from "react";

import NavPopover from "@/components/layout/NavPopover";
import { es } from "@/lib/i18n/es";
import { useRealtimeTable } from "@/lib/realtime/use-realtime-table";

type Counts = { conversations: number; alerts: number };

const DEBOUNCE_MS = 250;

// Message and alert icons with unread badges that update as notifications arrive.
export default function NavActions({ userId, initial }: { userId: string; initial: Counts }) {
  const [counts, setCounts] = useState(initial);
  const [seen, setSeen] = useState(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // A server render (navigation, router.refresh) brings fresher counts than the ones held here.
  if (seen.conversations !== initial.conversations || seen.alerts !== initial.alerts) {
    setSeen(initial);
    setCounts(initial);
  }

  async function refreshCounts() {
    try {
      const response = await fetch("/api/nav/unread", { cache: "no-store" });
      if (response.ok) setCounts((await response.json()) as Counts);
    } catch {
      // The next event or resync retries.
    }
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  useRealtimeTable({
    topic: `nav:${userId}`,
    table: "notifications",
    filter: `user_id=eq.${userId}`,
    onChange: () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void refreshCounts(), DEBOUNCE_MS);
    },
    onResync: () => void refreshCounts(),
  });

  return (
    <>
      <NavPopover kind="messages" label={es.nav.messages} badge={counts.conversations} />
      <NavPopover kind="alerts" label={es.nav.alerts} badge={counts.alerts} />
    </>
  );
}
