"use client";

import { useRouter } from "next/navigation";

import { useRealtimeTable } from "@/lib/realtime/use-realtime-table";

// Re-renders the server-rendered order panel when the order changes (payment and tracking webhooks).
export default function OrderLiveRefresh({ conversationId }: { conversationId: string }) {
  const router = useRouter();

  useRealtimeTable({
    topic: `orders:${conversationId}`,
    table: "orders",
    filter: `conversation_id=eq.${conversationId}`,
    onChange: () => router.refresh(),
    onResync: () => router.refresh(),
  });

  return null;
}
