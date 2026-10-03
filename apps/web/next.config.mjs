/** @type {import('next').NextConfig} */
const DEFAULT_API = 'https://agencyhubapi-production.up.railway.app';
const API_ORIGIN = new URL(process.env.API_URL || DEFAULT_API).origin;

const config = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy-Report-Only',
            value: `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ${API_ORIGIN}; frame-ancestors 'none'`,
          },
        ],
      },
    ];
  },
  async rewrites() {
    const apiUrl = (process.env.API_URL || DEFAULT_API).replace(/\/+$/, '');
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

export default config;