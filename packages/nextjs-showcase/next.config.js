/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@fhevm-sdk'],
  
  // CORS headers for FHEVM WebAssembly threads support
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups', // Allow wallet popups
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'credentialless', // Changed from require-corp to avoid CORS issues
          },
        ],
      },
    ];
  },
  
  // Webpack configuration to handle React Native dependencies
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        '@react-native-async-storage/async-storage': false,
        'pino-pretty': false,
        fs: false,
        net: false,
        tls: false,
      };
    }
    
    config.ignoreWarnings = [
      { module: /@metamask\/sdk/ },
      { module: /@react-native-async-storage/ },
      { module: /pino-pretty/ },
    ];
    
    return config;
  },
};

module.exports = nextConfig;

