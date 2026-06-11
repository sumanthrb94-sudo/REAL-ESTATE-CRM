/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Type safety is enforced (typescript errors still fail the build).
  // Lint runs in CI / `npm run lint`; don't let stylistic warnings block deploys.
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    typedRoutes: false,
  },
  // firebase-admin ships native/dynamic requires; keep it out of the server
  // bundle so it's loaded from node_modules at runtime (only used when
  // DATA_DRIVER=firebase).
  serverExternalPackages: ["firebase-admin"],
  async redirects() {
    return [{ source: "/", destination: "/dashboard", permanent: false }];
  },
};

export default nextConfig;
