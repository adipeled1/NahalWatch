import type { MetadataRoute } from 'next';
import { META } from '@/lib/meta';
import { SITE_URL } from '@/lib/site';
import { STATIONS } from '@/lib/stationIndex';

/** /sitemap.xml: the main pages plus every station page (214), built with the site. */
export default function sitemap(): MetadataRoute.Sitemap {
  const built = new Date(META.generatedAt);
  const pages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: built, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/streams`, lastModified: built, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/updates`, lastModified: built, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/models`, lastModified: built, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/about`, lastModified: built, changeFrequency: 'monthly', priority: 0.5 },
  ];
  const stations: MetadataRoute.Sitemap = STATIONS.map((s) => ({
    url: `${SITE_URL}/station/${s.id}`,
    lastModified: new Date(`${s.latest.d}T00:00:00Z`),
    changeFrequency: 'monthly',
    priority: 0.6,
  }));
  return [...pages, ...stations];
}
