import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const now = new Date();

  const routes: Array<{ path: string; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number }> = [
    { path: "/", changeFrequency: "weekly", priority: 1.0 },
    { path: "/usluge", changeFrequency: "monthly", priority: 0.9 },
    { path: "/cjenovnik", changeFrequency: "monthly", priority: 0.9 },
    { path: "/galerija", changeFrequency: "weekly", priority: 0.8 },
    { path: "/o-meni", changeFrequency: "yearly", priority: 0.7 },
    { path: "/kontakt", changeFrequency: "yearly", priority: 0.8 },
    { path: "/obuka", changeFrequency: "monthly", priority: 0.7 },
    { path: "/zakazi", changeFrequency: "daily", priority: 0.9 },
    { path: "/politika-privatnosti", changeFrequency: "yearly", priority: 0.3 },
    { path: "/uslovi-koriscenja", changeFrequency: "yearly", priority: 0.3 },
  ];

  return routes.map((r) => ({
    url: `${baseUrl}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
