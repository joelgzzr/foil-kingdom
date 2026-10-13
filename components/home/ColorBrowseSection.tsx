import Link from "next/link";

import HomeSection from "@/components/home/HomeSection";
import { getCatalogFacets } from "@/lib/data/catalog";
import { es } from "@/lib/i18n/es";

// Full class strings so Tailwind can see them.
const COLOR_STYLES: Record<string, string> = {
  Red: "from-red-500 to-rose-700 text-white",
  Blue: "from-sky-500 to-blue-700 text-white",
  Yellow: "from-amber-300 to-yellow-500 text-neutral-900",
  Green: "from-emerald-500 to-green-700 text-white",
  Black: "from-zinc-700 to-black text-white",
  Purple: "from-violet-500 to-purple-800 text-white",
  White: "from-slate-50 to-slate-300 text-neutral-900",
};
const FALLBACK_STYLE = "from-muted to-border text-foreground";
const COLOR_ORDER = Object.keys(COLOR_STYLES);

export default async function ColorBrowseSection() {
  const { colors } = await getCatalogFacets();
  if (colors.length === 0) return null;

  const ordered = [...colors].sort((a, b) => {
    const rank = (color: string) => (COLOR_ORDER.includes(color) ? COLOR_ORDER.indexOf(color) : COLOR_ORDER.length);
    return rank(a) - rank(b);
  });

  return (
    <HomeSection title={es.home.colorsTitle} subtitle={es.home.colorsSubtitle}>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {ordered.map((color) => (
          <li key={color}>
            <Link
              href={`/cards?color=${encodeURIComponent(color)}`}
              className={`flex h-24 items-end rounded-xl bg-linear-to-br p-3 font-medium shadow-sm ring-1 ring-foreground/10 transition-transform hover:-translate-y-0.5 ${COLOR_STYLES[color] ?? FALLBACK_STYLE}`}
            >
              {es.home.colorNames[color] ?? color}
            </Link>
          </li>
        ))}
      </ul>
    </HomeSection>
  );
}
