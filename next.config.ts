import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.cloudflare.steamstatic.com",
      },
      {
        protocol: "https",
        hostname: "raw.githubusercontent.com",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/mid",
        destination: "/lane/2",
        permanent: true,
      },
      {
        source: "/mid/:path*",
        destination: "/lane/2/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
