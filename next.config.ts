import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // Product photos are served from this shop's own address (/_next/image), resized and
  // cached here, so a buyer's browser never loads them from the API's image host.
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'images-direct.btab.app' }],
    minimumCacheTTL: 86400,
  },
};

export default nextConfig;
