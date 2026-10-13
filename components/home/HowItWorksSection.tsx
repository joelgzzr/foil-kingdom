import { MessagesSquare, Truck, Upload } from "lucide-react";

import HomeSection from "@/components/home/HomeSection";
import { es } from "@/lib/i18n/es";

const ICONS = [Upload, MessagesSquare, Truck];

export default function HowItWorksSection() {
  return (
    <HomeSection title={es.home.howTitle}>
      <ol className="grid gap-4 md:grid-cols-3">
        {es.home.howSteps.map((step, index) => {
          const Icon = ICONS[index];
          return (
            <li key={step.title} className="relative grid gap-2 overflow-hidden rounded-2xl border bg-card p-5">
              <span aria-hidden className="absolute -right-2 -top-4 text-8xl font-bold text-primary/5">
                {index + 1}
              </span>
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="size-5" aria-hidden />
              </span>
              <h3 className="font-semibold">{step.title}</h3>
              <p className="text-sm text-muted-foreground">{step.body}</p>
            </li>
          );
        })}
      </ol>
    </HomeSection>
  );
}
