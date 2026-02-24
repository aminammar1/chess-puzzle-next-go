/** @type {import('next').NextConfig} */
const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || '';
const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
const voiceUrl = process.env.NEXT_PUBLIC_VOICE_URL || 'http://localhost:8001';

// When a gateway is configured, route everything through it.
// Otherwise, fall back to direct service URLs (local dev).
const useGateway = !!gatewayUrl;

// Extract just the origin (scheme + host + port) for the rewrite destination
const apiOrigin = apiUrl.replace(/\/api\/v1\/?$/, '');

const nextConfig = {
  async rewrites() {
    if (useGateway) {
      return [
        // All voice requests → gateway /voice/v1/*
        {
          source: '/voice-api/:path*',
          destination: `${gatewayUrl}/voice/v1/:path*`,
        },
        // All puzzle/session requests → gateway /api/v1/*
        {
          source: '/api/:path*',
          destination: `${gatewayUrl}/api/:path*`,
        },
      ];
    }
    // Direct mode — bypass gateway, hit services directly
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
