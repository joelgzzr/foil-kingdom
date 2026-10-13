"use client";

import { useState } from "react";

import { es } from "@/lib/i18n/es";

type Tab = "chat" | "cards";

// Two columns on desktop; on small screens one pane at a time. Both stay mounted so the chat keeps its live state.
export default function ConversationTabs({ chat, cards }: { chat: React.ReactNode; cards: React.ReactNode }) {
  const [tab, setTab] = useState<Tab>("chat");
  const copy = es.messages.tabs;

  const tabClass = (value: Tab) =>
    `flex-1 rounded-lg px-3 py-1.5 text-sm font-medium ${tab === value ? "bg-background shadow" : "text-muted-foreground"}`;

  return (
    <div className="grid gap-4">
      <div role="tablist" className="flex gap-1 rounded-xl bg-muted p-1 lg:hidden">
        <button type="button" role="tab" aria-selected={tab === "chat"} className={tabClass("chat")} onClick={() => setTab("chat")}>
          {copy.chat}
        </button>
        <button type="button" role="tab" aria-selected={tab === "cards"} className={tabClass("cards")} onClick={() => setTab("cards")}>
          {copy.cards}
        </button>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className={`${tab === "chat" ? "grid" : "hidden"} min-w-0 gap-4 lg:grid`}>{chat}</div>
        <div className={`${tab === "cards" ? "grid" : "hidden"} min-w-0 gap-4 lg:grid`}>{cards}</div>
      </div>
    </div>
  );
}
