// Only needed for web (dev server and the Vercel demo): expo-sqlite on web runs
// SQLite as WebAssembly and needs SharedArrayBuffer, which requires these
// headers. These apply to the dev server only; production sends the same
// headers from vercel.json. The Android app does not use any of this.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('wasm');

config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  middleware(req, res, next);
};

module.exports = config;
