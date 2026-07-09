import type { MetadataRoute } from "next";
import { abs } from "../lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Keep private/app surfaces out of the index; landing pages stay open.
      disallow: ["/api/", "/admin", "/account", "/activity", "/review", "/saved"],
    },
    // generateSitemaps() emits chunked files (no auto /sitemap.xml index in
    // Next 16); list each chunk so crawlers pick them all up.
    sitemap: [0, 1, 2, 3].map((i) => abs(`/sitemap/${i}.xml`)),
    host: abs("/"),
  };
}
