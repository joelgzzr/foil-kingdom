"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { startConversationAction } from "@/lib/actions/messages";
import { es } from "@/lib/i18n/es";

const MAX_SELECTED = 50;
const EMPTY = "[]";
const listeners = new Set<() => void>();

// sessionStorage is the source of truth so the selection survives filters and pagination without a server round trip.
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function readRaw(key: string) {
  try {
    return window.sessionStorage.getItem(key) ?? EMPTY;
  } catch {
    return EMPTY;
  }
}

function writeIds(key: string, ids: string[]) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // Storage can be unavailable (private mode); the selection then lives until reload only.
  }
  listeners.forEach((listener) => listener());
}

type SelectionContextValue = {
  selected: ReadonlySet<string>;
  toggle: (listingId: string) => void;
  clear: () => void;
};

const SelectionContext = createContext<SelectionContextValue | null>(null);

export function useCollectionSelection() {
  const value = useContext(SelectionContext);
  if (!value) throw new Error("useCollectionSelection must be used inside CollectionSelectionProvider");
  return value;
}

type ProviderProps = {
  sellerUsername: string;
  signedIn: boolean;
  children: ReactNode;
};

export function CollectionSelectionProvider({ sellerUsername, signedIn, children }: ProviderProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const key = `collection-selection:${sellerUsername}`;
  const raw = useSyncExternalStore(subscribe, () => readRaw(key), () => EMPTY);
  const selected = useMemo(() => {
    try {
      const parsed: unknown = JSON.parse(raw);
      return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []);
    } catch {
      return new Set<string>();
    }
  }, [raw]);

  const toggle = useCallback(
    (listingId: string) => {
      const next = new Set(selected);
      if (next.has(listingId)) next.delete(listingId);
      else if (next.size < MAX_SELECTED) next.add(listingId);
      writeIds(key, [...next]);
    },
    [key, selected],
  );
  const clear = useCallback(() => writeIds(key, []), [key]);
  const value = useMemo(() => ({ selected, toggle, clear }), [selected, toggle, clear]);

  function onContact() {
    if (!signedIn) {
      const next = `${window.location.pathname}${window.location.search}`;
      router.push(`/login?next=${encodeURIComponent(next)}`);
      return;
    }
    startTransition(async () => {
      const result = await startConversationAction([...selected]);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      clear();
      router.push(`/messages/${(result.data as { id: string }).id}`);
    });
  }

  return (
    <SelectionContext.Provider value={value}>
      {children}
      {selected.size > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-3 backdrop-blur">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2">
            <p className="text-sm" aria-live="polite">
              {es.collection.selectedCount(selected.size)}
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={clear} disabled={pending}>
                {es.collection.clearSelection}
              </Button>
              <Button type="button" onClick={onContact} disabled={pending}>
                {signedIn ? es.collection.contactSelected(selected.size) : es.collection.loginToContact}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </SelectionContext.Provider>
  );
}
