/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'node .next/standalone/server.js',
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
};

module.exports = nextConfig;