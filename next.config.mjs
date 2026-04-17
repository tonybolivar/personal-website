/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@vercel/blob", "dropbox", "undici", "sharp", "exifr"],
  },
};

export default nextConfig;
