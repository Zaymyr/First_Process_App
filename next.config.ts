// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Allow Server Actions from your dev origins
      allowedOrigins: [
        process.env.NEXT_PUBLIC_SITE_URL || '', // your Codespaces URL
        'http://localhost:3000',                // optional local run
      ],
      // bodySizeLimit: '2mb', // optional
    },
  },
};

export default nextConfig;
