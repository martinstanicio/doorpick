import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['mssql'],
  experimental: {
    optimizePackageImports: ['@tabler/icons-react'],
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
