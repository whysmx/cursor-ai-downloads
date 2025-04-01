/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    unoptimized: true
  },
  // 为Next.js 12版本配置正确的静态导出
  exportPathMap: async function() {
    return {
      '/': { page: '/' },
      '/404': { page: '/404' },
      '/500': { page: '/500' }
    }
  },
  trailingSlash: true
}

module.exports = nextConfig 