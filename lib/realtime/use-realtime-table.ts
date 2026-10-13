"use client";

import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useEffect, useEffectEvent } from "react";

import { createClient } from "@/lib/supabase/client";

type Options = {
  topic: string;
  table: string;
  filter: string;
  onChange: (payload: RealtimePostgresChangesPayload<{ [key: string]: any }>) => void; // eslint-disable-line @typescript-eslint/no-explicit-any
  // Refetch what may have been missed: reconnects, the tab coming back, the network returning.
  onResync: () => void;
  resyncOnFirstConnect?: boolean;
};

const MAX_BACKOFF_MS = 30_000;

// postgres_changes subscription that survives dropped sockets and expired tokens, which the library does not resubscribe by itself.
export function useRealtimeTable({ topic, table, filter, onChange, onResync, resyncOnFirstConnect = false }: Options) {
  const handleChange = useEffectEvent(onChange);
  const handleResync = useEffectEvent(onResync);

  useEffect(() => {
    const supabase = createClient();
    let disposed = false;
    let channel: RealtimeChannel | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let connectedBefore = false;

    const connect = () => {
      const current = supabase
        .channel(`${topic}:${crypto.randomUUID()}`)
        .on("postgres_changes", { event: "*", schema: "public", table, filter }, (payload) => handleChange(payload))
        .subscribe((status) => {
          if (disposed || channel !== current) return;
          if (status === "SUBSCRIBED") {
            attempt = 0;
            if (connectedBefore || resyncOnFirstConnect) handleResync();
            connectedBefore = true;
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            scheduleReconnect();
          }
        });
      channel = current;
    };

    // Joining without the session token would make RLS silently drop every row.
    const connectWithSession = async () => {
      await supabase.realtime.setAuth().catch(() => undefined);
      if (!disposed) connect();
    };

    const scheduleReconnect = () => {
      if (retryTimer) return;
      const stale = channel;
      channel = undefined;
      if (stale) void supabase.removeChannel(stale);
      retryTimer = setTimeout(() => {
        retryTimer = undefined;
        void connectWithSession();
      }, Math.min(1000 * 2 ** attempt++, MAX_BACKOFF_MS));
    };

    const catchUp = () => {
      if (document.visibilityState === "visible") handleResync();
    };

    void connectWithSession();
    document.addEventListener("visibilitychange", catchUp);
    window.addEventListener("online", catchUp);

    return () => {
      disposed = true;
      clearTimeout(retryTimer);
      document.removeEventListener("visibilitychange", catchUp);
      window.removeEventListener("online", catchUp);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [topic, table, filter, resyncOnFirstConnect]);
}
