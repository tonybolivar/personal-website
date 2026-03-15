/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "neatwoodham.com" }],
        destination: "https://anthonybolivar.com/troll",
        permanent: false,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.neatwoodham.com" }],
        destination: "https://anthonybolivar.com/troll",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
