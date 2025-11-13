/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['shelby.xyz', 'api.shelbynet.shelby.xyz'],
  },
  // Vercel deployment optimization
  output: 'standalone',
}

module.exports = nextConfig

