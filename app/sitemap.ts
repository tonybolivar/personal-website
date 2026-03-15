import { MetadataRoute } from "next";
import { headers } from "next/headers";

export default function sitemap(): MetadataRoute.Sitemap {
  const host = headers().get("host") ?? "";

  if (host === "neatwoodham.com" || host === "www.neatwoodham.com") {
    return [
      {
        url: "https://neatwoodham.com",
        lastModified: new Date(),
      },
    ];
  }

  return [
    {
      url: "https://anthonybolivar.com",
      lastModified: new Date(),
    },
  ];
}
