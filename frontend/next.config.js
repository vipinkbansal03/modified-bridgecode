/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  images: {
    qualities: [70, 75, 85, 90],
    remotePatterns: [
      { protocol: "https", hostname: "media.apricotequipment.in" },
      { protocol: "https", hostname: "media-staging.apricotequipment.in" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "plus.unsplash.com" },
      { protocol: "https", hostname: "www.modortho.com" },
      // Allow serving product images uploaded to the Express backend
      { protocol: "http", hostname: "localhost" },
      { protocol: "http", hostname: "localhost", port: "4000" },
      { protocol: "http", hostname: "127.0.0.1" },
      { protocol: "http", hostname: "127.0.0.1", port: "4000" },
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },

  /**
   * Development proxy: any request to /api/* is forwarded to the Express backend.
   * Set BACKEND_URL in .env.local for the proxy target, or let it fall back to
   * http://localhost:4000 for local development.
   *
   * In production, BACKEND_URL can point at the deployed backend. If the browser
   * should call the backend directly, also set NEXT_PUBLIC_API_URL.
   */
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL
      || (process.env.NEXT_PUBLIC_API_URL
        ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api(?:\/admin)?$/, "")
        : "http://127.0.0.1:4000");

    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${backendUrl}/uploads/:path*`,
      },
    ];
  },

  /**
   * Security headers
   */
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
