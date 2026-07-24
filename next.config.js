/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Prevents double-renders in dev (saves transfer in prod)
  poweredByHeader: false,
  compress: true, // Enable gzip compression on all responses
  async headers() {
    return [
      {
        // Cache static assets aggressively
        source: '/_next/static/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        // Never cache API responses at CDN level
        source: '/api/:path*',
        headers: [{ key: 'Cache-Control', value: 'private, no-store, max-age=0' }],
      },
    ];
  },
};

module.exports = nextConfig;
