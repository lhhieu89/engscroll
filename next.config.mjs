/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output → the Docker prod image ships only `.next/standalone`
  // (server.js + traced node_modules) + `.next/static` + `public/`.
  output: "standalone",
  poweredByHeader: false,
  compress: true,
  // Keep server-only native/socket deps external so they aren't bundled.
  serverExternalPackages: ["msedge-tts", "postgres"],
  eslint: {
    // Type-checking is the guardrail we rely on in build; ESLint is optional.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
