/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@vercel/blob", "dropbox", "undici"],
  },
};

export default nextConfig;
