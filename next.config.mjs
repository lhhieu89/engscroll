/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep server-only native/socket deps external so they aren't bundled.
  serverExternalPackages: ["msedge-tts", "postgres"],
  eslint: {
    // Type-checking is the guardrail we rely on in build; ESLint is optional.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
