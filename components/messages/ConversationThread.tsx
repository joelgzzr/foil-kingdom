"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  makeOfferAction,
  markConversationReadAction,
  respondToOfferAction,
  revealWhatsappAction,
  sendMessageAction,
} from "@/lib/actions/messages";
import { es } from "@/lib/i18n/es";
import { formatMXN } from "@/lib/money";
import { useRealtimeTable } from "@/lib/realtime/use-realtime-table";
import {
  CHAT_MESSAGE_COLUMNS,
  messageSchema,
  offerSchema,
  type ChatMessage,
  type MessageInput,
  type OfferInput,
} from "@/lib/schemas/message";
import { createClient } from "@/lib/supabase/client";

type OfferItem = { id: string; title: string; available: boolean; acceptsOffers: boolean };

type Props = {
  conversationId: string;
  currentUserId: string;
  role: "buyer" | "seller";
  initialMessages: ChatMessage[];
  // Open cards of the conversation; an offer targets one of them or the whole bundle.
  items: OfferItem[];
};

function offerBubbleLabel(message: ChatMessage, items: OfferItem[]) {
  const amount = formatMXN(message.offer_cents ?? 0);
  if (message.offer_scope === "bundle") return es.messages.offerBundleLabel(amount);
  const item = items.find((candidate) => candidate.id === message.offer_item_id);
  return item ? es.messages.offerItemLabel(item.title, amount) : es.messages.offerLabel(amount);
}

const upsertMessage = (messages: ChatMessage[], next: ChatMessage) => {
  const index = messages.findIndex((message) => message.id === next.id);
  if (index === -1) return [...messages, next].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const copy = [...messages];
  copy[index] = next;
  return copy;
};

export default function ConversationThread({ conversationId, currentUserId, role, initialMessages, items }: Props) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const bottomRef = useRef<HTMLDivElement>(null);

  const offerableItems = items.filter((item) => item.available && item.acceptsOffers);
  // A bundle offer needs two or more cards and every one of them must accept offers.
  const canOfferBundle = items.length >= 2 && offerableItems.length === items.length;
  const canOffer = offerableItems.length > 0;
  const defaultTarget = canOfferBundle ? "bundle" : (offerableItems[0]?.id ?? "bundle");

  const markRead = useCallback(() => {
    void markConversationReadAction(conversationId).then(() => router.refresh());
  }, [conversationId, router]);

  const messageForm = useForm<MessageInput>({ resolver: zodResolver(messageSchema), defaultValues: { body: "" } });
  const offerForm = useForm<OfferInput>({ resolver: zodResolver(offerSchema), defaultValues: { target: defaultTarget } });
  const { getValues: getOfferValues, setValue: setOfferValue } = offerForm;

  // Keep the selected target valid when cards are added or removed.
  useEffect(() => {
    const current = getOfferValues("target");
    const valid = current === "bundle" ? canOfferBundle : offerableItems.some((item) => item.id === current);
    if (!valid) setOfferValue("target", defaultTarget);
  }, [canOfferBundle, defaultTarget, getOfferValues, offerableItems, setOfferValue]);

  useEffect(() => {
    markRead();
  }, [markRead]);

  // Fetches what arrived while the connection was down (or before it was established).
  async function syncMessages() {
    const { data } = await createClient()
      .from("messages")
      .select(CHAT_MESSAGE_COLUMNS)
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setMessages((current) => data.reduce((all, row) => upsertMessage(all, row), current));
    markRead();
  }

  // Realtime respects RLS, so only participants receive these rows.
  useRealtimeTable({
    topic: `conversation:${conversationId}`,
    table: "messages",
    filter: `conversation_id=eq.${conversationId}`,
    resyncOnFirstConnect: true,
    onChange: (payload) => {
      const row = payload.new as ChatMessage;
      setMessages((current) => upsertMessage(current, row));
      if (payload.eventType === "INSERT" && row.sender_id !== currentUserId) markRead();
      // Cards added/removed and accepted offers change the server-rendered items and order panels.
      if (payload.eventType === "INSERT" && row.kind === "system") router.refresh();
    },
    onResync: () => void syncMessages(),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function onSend(values: MessageInput) {
    const result = await sendMessageAction(conversationId, values);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    if (result.data) setMessages((current) => upsertMessage(current, result.data as ChatMessage));
    messageForm.reset({ body: "" });
  }

  async function onOffer(values: OfferInput) {
    const result = await makeOfferAction(conversationId, values);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(result.message);
    offerForm.reset({ target: values.target });
  }

  async function onRespond(messageId: string, action: "accept" | "reject" | "withdraw") {
    const result = await respondToOfferAction(messageId, action);
    if (!result.ok) toast.error(result.message);
  }

  async function onWhatsapp() {
    const result = await revealWhatsappAction(conversationId);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    window.open((result.data as { url: string }).url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="grid gap-4">
      <ul className="grid max-h-[55vh] min-h-48 content-start gap-2 overflow-y-auto rounded-xl border p-3" aria-live="polite">
        {messages.map((message) => {
          const mine = message.sender_id === currentUserId;

          if (message.kind === "system") {
            const text = es.messages.system[message.body as keyof typeof es.messages.system];
            return (
              <li key={message.id} className="text-center text-xs text-muted-foreground">
                {text}
              </li>
            );
          }

          return (
            <li key={message.id} className={mine ? "justify-self-end" : "justify-self-start"}>
              <div
                className={`max-w-sm rounded-2xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}
              >
                {message.kind === "offer" && message.offer_cents !== null ? (
                  <div className="grid gap-1.5">
                    <p className="font-medium">{offerBubbleLabel(message, items)}</p>
                    <p className="text-xs opacity-80">
                      {es.messages.offerStatus[message.offer_status as keyof typeof es.messages.offerStatus]}
                    </p>
                    {message.offer_status === "pending" ? (
                      <div className="flex gap-2">
                        {role === "seller" ? (
                          <>
                            <Button size="sm" variant="secondary" onClick={() => onRespond(message.id, "accept")}>
                              {es.messages.accept}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => onRespond(message.id, "reject")}>
                              {es.messages.reject}
                            </Button>
                          </>
                        ) : mine ? (
                          <Button size="sm" variant="outline" onClick={() => onRespond(message.id, "withdraw")}>
                            {es.messages.withdraw}
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="whitespace-pre-line break-words">{message.body}</p>
                )}
              </div>
            </li>
          );
        })}
        <div ref={bottomRef} />
      </ul>

      <form onSubmit={messageForm.handleSubmit(onSend)} className="flex items-start gap-2" noValidate>
        <div className="flex-1">
          <Input
            aria-label={es.messages.placeholder}
            placeholder={es.messages.placeholder}
            maxLength={1000}
            autoComplete="off"
            aria-invalid={!!messageForm.formState.errors.body}
            {...messageForm.register("body")}
          />
        </div>
        <Button type="submit" disabled={messageForm.formState.isSubmitting}>
          {es.messages.send}
        </Button>
      </form>

      {role === "buyer" && canOffer ? (
        <form onSubmit={offerForm.handleSubmit(onOffer)} className="grid gap-2 rounded-xl border p-3 sm:flex sm:items-end" noValidate>
          <div className="sm:flex-1">
            <Field id="offerTarget" label={es.messages.offerTarget} error={offerForm.formState.errors.target?.message}>
              <NativeSelect id="offerTarget" {...offerForm.register("target")}>
                {canOfferBundle ? <option value="bundle">{es.messages.offerTargetBundle(items.length)}</option> : null}
                {offerableItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <div className="sm:flex-1">
            <Field id="offerAmount" label={es.messages.offerAmount} error={offerForm.formState.errors.amount?.message}>
              <Input
                id="offerAmount"
                type="number"
                inputMode="decimal"
                min={1}
                step="0.01"
                {...offerForm.register("amount", { valueAsNumber: true })}
              />
            </Field>
          </div>
          <Button type="submit" variant="outline" disabled={offerForm.formState.isSubmitting}>
            {es.messages.sendOffer}
          </Button>
        </form>
      ) : null}

      <div className="grid gap-1">
        <div>
          <Button type="button" variant="outline" onClick={onWhatsapp}>
            {es.messages.whatsapp}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{es.messages.whatsappHint}</p>
      </div>
    </div>
  );
}
