// "Joel Gzz" -> "JG"; a single word gives one letter.
export function avatarInitials(displayName: string | null, username: string) {
  const words = (displayName?.trim() || username).split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => Array.from(word)[0]?.toUpperCase() ?? "")
    .join("");
}
