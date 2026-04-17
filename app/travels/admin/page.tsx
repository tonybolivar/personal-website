import { Radio_Canada } from "next/font/google";
import AdminUploader from "./AdminUploader";

const radio = Radio_Canada({ subsets: ["latin"], weight: ["400", "600"] });

export const metadata = { title: "travels · admin", robots: { index: false, follow: false } };

export default function TravelsAdminPage() {
  return (
    <div className={`${radio.className} max-w-3xl w-full mx-auto px-6 py-10`}>
      <div className="w-full paper-surface">
        <div className="min-h-screen py-10">
          <div className="flex flex-row justify-between items-start gap-6">
            <div>
              <p className="custom-text-18 ink-title">Travels · Admin</p>
              <p className="ink-muted text-sm mt-1">
                drop a photo; if it has GPS EXIF, it pins to the map
              </p>
            </div>
            <a href="/travels" className="link-accent text-sm">back to /travels</a>
          </div>
          <hr className="rule" />
          <AdminUploader />
        </div>
      </div>
    </div>
  );
}
