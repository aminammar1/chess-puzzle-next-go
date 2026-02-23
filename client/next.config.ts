/** @type {import('next').NextConfig} */
const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
const voiceUrl = process.env.NEXT_PUBLIC_VOICE_URL || 'http://localhost:8001';

// Extract just the origin (scheme + host + port) for the rewrite destination
const apiOrigin = apiUrl.replace(/\/api\/v1\/?$/, '');

const nextConfig = {
  async rewrites() {
    return [
      // Voice service proxy — must come first (more specific)
      {
        source: '/voice-api/:path*',
        destination: `${voiceUrl}/api/v1/:path*`,
      },
      // Go puzzle service proxy
      {
        source: '/api/:path*',
        destination: `${apiOrigin}/api/:path*`,
      },
    ];
  },
  serverExternalPackages: [],
  experimental: {
    proxyTimeout: 120_000,
  },
};

export default nextConfig;
