import type { Metadata } from "next";
import SiteHeader from "@/components/immersion/SiteHeader";
import LanguageView, { headerLine } from "@/components/immersion/LanguageView";
import { readData } from "@/lib/immersion/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "immersion",
  description: "Hours of Korean immersion and words learned, logged as I go.",
};

// The first language is the main one, so /immersion opens straight into it.
export default async function ImmersionIndex() {
  const data = await readData();
  const lang = data.languages[0];

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
