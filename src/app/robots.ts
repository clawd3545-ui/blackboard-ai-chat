import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: ["/", "/pricing", "/privacy", "/terms", "/contact", "/disclaimer", "/login"], disallow: ["/dashboard", "/api/"] },
    ],
    sitemap: "https://nexchat.in/sitemap.xml",
  };
}
