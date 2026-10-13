import { contactEmail, legalEntity } from "@/lib/legal";
import { es } from "@/lib/i18n/es";

type Props = {
  title: string;
  updatedAt: string;
  sections: readonly { title: string; paragraphs: readonly string[] }[];
};

const fill = (text: string) => text.replaceAll("{entity}", legalEntity);

export default function LegalDocument({ title, updatedAt, sections }: Props) {
  return (
    <main className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{es.legal.updated(updatedAt)}</p>
      </header>
      {sections.map((section, index) => (
        <section key={section.title} className="grid gap-2">
          <h2 className="font-medium">
            {index + 1}. {fill(section.title)}
          </h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph} className="text-sm text-muted-foreground">
              {fill(paragraph)}
            </p>
          ))}
        </section>
      ))}
      <p className="text-sm">{es.legal.contact(contactEmail)}</p>
    </main>
  );
}
