/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow images from WhatsApp CDN and other sources
  images: {
    domains: ['lookaside.fbsbx.com', 'scontent.whatsapp.net'],
  },
  // Required for socket.io
  webpack: (config) => {
    config.externals.push({
      'utf-8-validate': 'commonjs utf-8-validate',
      bufferutil: 'commonjs bufferutil',
    });
    return config;
  },
};

module.exports = nextConfig;
