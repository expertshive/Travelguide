const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  watchFolders: [monorepoRoot],
  server: {
    port: 8081,
  },
  resolver: {
    unstable_enableSymlinks: true,
    nodeModulesPaths: [
      path.resolve(projectRoot, 'node_modules'),
      path.resolve(monorepoRoot, 'node_modules'),
    ],
    blockList: /.*[/\\](\.git|android[/\\](build|\.gradle|app[/\\]build)|apps[/\\](?!mobile)[^/\\]+|infrastructure)[/\\].*/,
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
