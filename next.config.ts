import path from "node:path";
import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

// GitHub Pages build: STATIC_EXPORT=1 produces a plain static site in out/,
// served from BASE_PATH (e.g. "/soqqa"). Server routes and custom headers are
// not available there; the app falls back to its offline engines.
const staticExport = process.env.STATIC_EXPORT === "1";
const basePath = staticExport ? (process.env.BASE_PATH ?? "") : "";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  ...(staticExport ? { output: "export" as const, basePath, trailingSlash: true, images: { unoptimized: true } } : {}),
  env: {
    NEXT_PUBLIC_STATIC_EXPORT: staticExport ? "1" : "",
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  turbopack: {
    // Pin the workspace root (a stray lockfile in a parent directory must not be picked up).
    root: path.resolve("."),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  ...(staticExport ? {} : { headers }),
};

async function headers() {
  return [
    { source: "/:path*", headers: securityHeaders },
    {
      // The service worker and its manifest must always be revalidated.
      source: "/(sw.js|precache-manifest.json)",
      headers: [
        { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        { key: "Service-Worker-Allowed", value: "/" },
      ],
    },
  ];
}

export default nextConfig;
