"use client";

import { useRouter } from "next/navigation";

import { useRealtimeTable } from "@/lib/realtime/use-realtime-table";

// Re-renders the inbox when a conversation gets a new message.
export default function InboxLiveRefresh({ userId }: { userId: string }) {
  const router = useRouter();

  useRealtimeTable({
    topic: `inbox:${userId}`,
    table: "notifications",
    filter: `user_id=eq.${userId}`,
    onChange: () => router.refresh(),
    onResync: () => router.refresh(),
  });

  return null;
}
