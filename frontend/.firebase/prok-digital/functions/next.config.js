"use strict";

// next.config.js
var withPWA = require("next-pwa")({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true
});
var nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  output: "standalone",
  // Image optimization
  images: {
    domains: []
  },
  // Webpack configuration for client-side geolocation
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false
      };
    }
    return config;
  }
};
module.exports = withPWA(nextConfig);
