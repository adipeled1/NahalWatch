// 'unsafe-eval' lets a page turn strings into code (eval / new Function). Only `next dev` needs it
// (fast refresh, source maps); in production it would only weaken XSS protection, so it's dev-only.
// 'unsafe-inline' stays: Next's inline bootstrap scripts need it unless every page uses a nonce,
// and nonces would force dynamic rendering of these static pages.
const isDev = process.env.NODE_ENV === 'development';
const scriptSrc = ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : [])].join(' ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Geolocation is allowed for "nearest station".
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              `script-src ${scriptSrc}`,
              "style-src 'self' 'unsafe-inline'",
              // Map tiles: OpenStreetMap (street) and Esri World Imagery (satellite).
              "img-src 'self' data: blob: https://tile.openstreetmap.org https://server.arcgisonline.com",
              "font-src 'self'",
              "connect-src 'self'",
              "worker-src 'self'",
              "manifest-src 'self'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};

export default nextConfig;
