/**
 * The site's public origin, for metadata, the sitemap and robots.txt.
 * Order: explicit NEXT_PUBLIC_SITE_URL → the Vercel production domain → this deployment's Vercel URL
 * (previews) → localhost.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL
  || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null)
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
  || 'http://localhost:3000'
).replace(/\/$/, '');
