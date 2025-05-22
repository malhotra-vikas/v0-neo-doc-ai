/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ['pdf-parse'], // ✅ updated location

  webpack: (config) => {
    // This is needed for PDF.js to work correctly
    config.resolve.alias.canvas = false;
    config.resolve.alias.encoding = false;

    return config;
  },
};

export default nextConfig;
