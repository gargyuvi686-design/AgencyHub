/** @type {import('next').NextConfig} */
const DEFAULT_API = 'https://agencyhubapi-production.up.railway.app';

const config = {
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