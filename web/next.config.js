/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    unoptimized: true
  },
  // 设置为静态HTML导出模式
  output: 'export',
  // 禁用SSR功能
  trailingSlash: true
}

module.exports = nextConfig 