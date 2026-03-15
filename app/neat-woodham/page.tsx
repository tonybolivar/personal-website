import TrollContent from "@/components/TrollContent";

export const metadata = {
  title: { absolute: "Neat Woodham" },
  description:
    "Neat Woodham – Assistant Manager at Chick-fil-A, studying Business Administration at University of South Alabama. Based in the Mobile, AL metropolitan area.",
  keywords: [
    "Neat Woodham",
    "Neat Estelle Woodham",
    "Neat Woodham Mobile Alabama",
    "Neat Estelle Woodham Mobile Alabama",
    "Neat Woodham University of South Alabama",
    "Neat Woodham Chick-fil-A",
    "Neat Woodham LBW Community College",
    "Neat Woodham business administration",
    "Neat Woodham marketing",
  ],
  openGraph: {
    title: "Neat Woodham",
    description: "Neat Woodham – Mobile, AL. Business Administration student at University of South Alabama.",
    url: "https://neatwoodham.com",
    siteName: "Neat Woodham",
  },
};

export default function NeatWoodhamPage() {
  return (
    <>
      {/* visible to crawlers, hidden from users who get redirected */}
      <div style={{ position: "absolute", left: "-9999px", top: "-9999px" }} aria-hidden="true">
        <h1>Neat Woodham</h1>
        <p>Neat Estelle Woodham is based in the Mobile, Alabama metropolitan area.</p>
        <h2>Experience</h2>
        <p>Assistant Manager at Chick-fil-A Restaurants. Full-time, August 2024 – Present. Marketing.</p>
        <h2>Education</h2>
        <p>University of South Alabama – Bachelor of Business Administration, Business Administration and Management. August 2025 – May 2027. Marketing.</p>
        <p>LBW Community College – Associate of Science, Business Administration and Management. August 2023 – May 2025.</p>
      </div>
      <TrollContent />
    </>
  );
}
