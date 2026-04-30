import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const nativeModules = ['better-sqlite3', 'bindings', 'file-uri-to-path', 'keytar'];

const config: ForgeConfig = {
  packagerConfig: {
    asar: {
      unpack: '*.{node,dll}',
    },
    extraResource: ['drizzle'],
  },
  rebuildConfig: {
    force: true,
    onlyModules: ['better-sqlite3'],
  },
  hooks: {
    packageAfterCopy: async (_forgeConfig, buildPath) => {
      const sourceNodeModulesPath = path.resolve(projectRoot, 'node_modules');
      const destNodeModulesPath = path.resolve(buildPath, 'node_modules');

      await Promise.all(
        nativeModules.map(async (packageName) => {
          const sourcePath = path.join(sourceNodeModulesPath, packageName);
          const destPath = path.join(destNodeModulesPath, packageName);
          await mkdir(path.dirname(destPath), { recursive: true });
          await cp(sourcePath, destPath, { recursive: true, preserveTimestamps: true });
        }),
      );
    },
  },
  makers: [new MakerSquirrel({}), new MakerZIP({}, ['darwin']), new MakerRpm({}), new MakerDeb({})],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: 'src/main/index.ts',
          config: 'vite.main.config.ts',
        },
        {
          entry: { preload: 'src/preload/index.ts' },
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
  ],
};

export default config;
