/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // The landing page is a self-contained static file in public/index.html.
  async rewrites() {
    return {
      beforeFiles: [{ source: '/', destination: '/index.html' }],
    }
  },
}

export default nextConfig
