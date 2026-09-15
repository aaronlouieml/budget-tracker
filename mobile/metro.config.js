const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite's web implementation loads a WASM build of SQLite; Metro needs
// to treat .wasm as a bundled asset (only relevant for `expo start --web` -
// native iOS/Android builds use real SQLite and never touch this).
config.resolver.assetExts.push('wasm');

module.exports = config;
