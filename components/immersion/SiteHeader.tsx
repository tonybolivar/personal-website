import Navbar from "@/components/Navbar";
import TypeLine from "@/components/TypeLine";

export default function SiteHeader({ line }: { line: string }) {
  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="custom-text-18 ink-title">Anthony Bolivar</p>
        <TypeLine text={line} />
      </div>
      <Navbar />
    </div>
  );
}
