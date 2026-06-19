/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "www.modortho.com" },
      // Allow serving product images uploaded to the Express backend
      { protocol: "http", hostname: "localhost" },
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
        : "http://localhost:4000");

    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
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
