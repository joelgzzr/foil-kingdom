// Client-only cart state: one cart per seller, kept in localStorage.

// One cart line per listing; `stock` is the copies on sale when the line was last checked.
export type CartItem = {
  id: string;
  title: string;
  priceCents: number;
  imageUrl: string | null;
  quantity: number;
  stock: number;
  slug: string | null;
};
export type SellerCartSummary = { sellerUsername: string; items: CartItem[] };

export const EMPTY_CART = "[]";
// Keep in sync with the 50-item limit in start_conversation.
export const MAX_CART_ITEMS = 50;

const KEY_PREFIX = "seller-cart:";
const listeners = new Set<() => void>();

export const cartKey = (sellerUsername: string) => `${KEY_PREFIX}${sellerUsername}`;

export function subscribeCarts(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

const notify = () => listeners.forEach((listener) => listener());

export function readCartRaw(key: string) {
  try {
    return window.localStorage.getItem(key) ?? EMPTY_CART;
  } catch {
    return EMPTY_CART;
  }
}

export function writeCart(key: string, items: CartItem[]) {
  try {
    if (items.length === 0) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // Storage can be unavailable (private mode); the cart then lives until reload only.
  }
  notify();
}

// localStorage is user-editable, so every field is checked before use.
export function parseCartItems(raw: string): CartItem[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry): CartItem[] => {
      if (typeof entry !== "object" || entry === null) return [];
      const { id, title, priceCents, imageUrl, quantity, stock, slug } = entry as Record<string, unknown>;
      if (typeof id !== "string" || typeof title !== "string" || typeof priceCents !== "number") return [];
      // Carts saved before quantities existed hold one copy per line.
      const safeStock = typeof stock === "number" && stock >= 1 ? Math.floor(stock) : 1;
      const safeQuantity = typeof quantity === "number" && quantity >= 1 ? Math.min(Math.floor(quantity), safeStock) : 1;
      return [
        {
          id,
          title,
          priceCents,
          imageUrl: typeof imageUrl === "string" ? imageUrl : null,
          quantity: safeQuantity,
          stock: safeStock,
          slug: typeof slug === "string" ? slug : null,
        },
      ];
    });
  } catch {
    return [];
  }
}

export const EMPTY_ALL_CARTS = "[]";

// Every stored cart as one string, so it can be a stable useSyncExternalStore snapshot.
export function readAllCartsRaw() {
  try {
    const entries: [string, string][] = [];
    for (let index = 0; index < window.localStorage.length; index++) {
      const key = window.localStorage.key(index);
      if (key?.startsWith(KEY_PREFIX)) entries.push([key.slice(KEY_PREFIX.length), window.localStorage.getItem(key) ?? EMPTY_CART]);
    }
    return entries.length === 0 ? EMPTY_ALL_CARTS : JSON.stringify(entries.sort(([a], [b]) => a.localeCompare(b)));
  } catch {
    return EMPTY_ALL_CARTS;
  }
}

export function parseAllCarts(raw: string): SellerCartSummary[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry): SellerCartSummary[] => {
      if (!Array.isArray(entry) || typeof entry[0] !== "string" || typeof entry[1] !== "string") return [];
      const items = parseCartItems(entry[1]);
      return items.length > 0 ? [{ sellerUsername: entry[0], items }] : [];
    });
  } catch {
    return [];
  }
}
