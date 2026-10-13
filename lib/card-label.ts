export const cardLabel = (name: string, code: string, variantLabel?: string | null) =>
  `${name} (${code})${variantLabel ? ` · ${variantLabel}` : ""}`;
