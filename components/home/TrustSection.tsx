import { Flag, Lock, ShieldCheck, Star } from "lucide-react";

import HomeSection from "@/components/home/HomeSection";
import { es } from "@/lib/i18n/es";

const ICONS = [ShieldCheck, Star, Lock, Flag];

export default function TrustSection() {
  return (
    <HomeSection title={es.home.trustTitle}>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {es.home.trustItems.map((item, index) => {
          const Icon = ICONS[index];
          return (
            <li key={item.title} className="grid content-start gap-2 rounded-2xl bg-muted/50 p-5">
              <Icon className="size-6 text-primary" aria-hidden />
              <h3 className="font-semibold">{item.title}</h3>
              <p className="text-sm text-muted-foreground">{item.body}</p>
            </li>
          );
        })}
      </ul>
    </HomeSection>
  );
}
