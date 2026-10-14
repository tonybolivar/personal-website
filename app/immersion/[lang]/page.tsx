import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/immersion/SiteHeader";
import LanguageView, { headerLine } from "@/components/immersion/LanguageView";
import { readData } from "@/lib/immersion/store";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { lang: string } }): Promise<Metadata> {
  const data = await readData();
  const lang = data.languages.find((l) => l.id === params.lang);
  return {
    title: lang ? `${lang.name} immersion` : "immersion",
    description: lang ? `Hours of ${lang.name} immersion and words learned.` : undefined,
  };
}

export default async function LanguagePage({ params }: { params: { lang: string } }) {
  const data = await readData();
  const lang = data.languages.find((l) => l.id === params.lang);
  if (!lang) notFound();

  return (
    <div className="max-w-3xl w-full mx-auto px-6">
      <div className="w-full paper-surface">
        <div className="min-h-screen py-10">
          <SiteHeader line={headerLine(lang)} />
          <hr className="rule" />
          <LanguageView data={data} lang={lang} />
        </div>
      </div>
    </div>
  );
}
