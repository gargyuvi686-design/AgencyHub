import type { NextConfig } from 'next';

const config: NextConfig = {
  /**
   * Rewrite all /api/* requests to the Express backend.
   *
   * Why rewrites instead of hitting the Express server directly from the
   * browser? Because httpOnly cookies are set on the Next.js origin. If the
   * browser called Express directly (different port/domain), the cookie would
   * be cross-site and blocked by SameSite=Lax. The rewrite makes the browser
   * believe it's talking to one origin while Next.js proxies internally.
   */
  async rewrites() {
    const apiUrl = process.env.API_URL ?? 'http://localhost:4000';
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

export default config;
