import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Mark native Node.js modules as external (server-side only)
  serverExternalPackages: [
    "@mapbox/node-pre-gyp",
    "@tensorflow/tfjs-node",
    "@vladmandic/human/dist/human.node.js",
  ],
  webpack: (config, { isServer }) => {
    // Ignore HTML files from node_modules
    config.module.rules.push({
      test: /\.html$/,
      include: /node_modules/,
      type: "asset/resource",
    });

    // For client-side builds, prioritize browser field and ignore Node.js modules
    if (!isServer) {
      config.resolve.mainFields = ["browser", "module", "main"];
      config.resolve.alias = {
        ...config.resolve.alias,
        "@tensorflow/tfjs-node": false,
        "@mapbox/node-pre-gyp": false,
      };
    }

    return config;
  },
};

export default nextConfig;
