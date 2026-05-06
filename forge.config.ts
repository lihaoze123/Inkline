import type { ForgeConfig } from '@electron-forge/shared-types';
import type { ForgePlatform } from '@electron-forge/shared-types';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerBase } from '@electron-forge/maker-base';
import type { MakerOptions } from '@electron-forge/maker-base';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { MakerAppImage } from '@reforged/maker-appimage';
import { build } from 'app-builder-lib';
import type { Configuration, NsisOptions } from 'app-builder-lib';
import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const nativeModules = ['better-sqlite3', 'bindings', 'file-uri-to-path', 'keytar'];
const iconBasePath = path.resolve(projectRoot, 'resources', 'icon');
const pngIconPath = `${iconBasePath}.png`;
const icoIconPath = `${iconBasePath}.ico`;
const electronZipDir = process.env.INKLINE_ELECTRON_ZIP_DIR;
const builderArchValues = ['x64', 'ia32', 'armv7l', 'arm64', 'universal'] as const;

type BuilderArch = (typeof builderArchValues)[number];

function toBuilderArch(arch: string): BuilderArch {
  if (builderArchValues.includes(arch as BuilderArch)) {
    return arch as BuilderArch;
  }

  throw new Error(`Unsupported NSIS target architecture: ${arch}`);
}

class MakerNsis extends MakerBase<NsisOptions> {
  name = 'nsis';
  defaultPlatforms: ForgePlatform[] = ['win32'];

  isSupportedOnCurrentPlatform(): boolean {
    return process.platform === 'win32';
  }

  async make({ dir, makeDir, targetArch, packageJSON }: MakerOptions): Promise<string[]> {
    const nsisOutputPath = path.join(makeDir, 'nsis', targetArch);
    const productName = packageJSON.productName ?? 'Inkline';
    const version = packageJSON.version;
    const arch = toBuilderArch(targetArch);
    const config: Configuration = {
      appId: 'com.lihaoze123.inkline',
      productName,
      directories: {
        output: nsisOutputPath,
      },
      win: {
        icon: icoIconPath,
      },
      nsis: {
        artifactName: `${productName}-${version}-Setup.${'${ext}'}`,
        oneClick: false,
        perMachine: false,
        allowElevation: true,
        allowToChangeInstallationDirectory: true,
        runAfterFinish: false,
        createDesktopShortcut: true,
        createStartMenuShortcut: true,
        shortcutName: 'Inkline',
        menuCategory: 'Inkline',
        ...this.config,
      },
    };

    return build({
      prepackaged: dir,
      win: [`nsis:${arch}`],
      publish: 'never',
      config,
    });
  }
}

const appleId = process.env.APPLE_ID;
const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD;
const appleTeamId = process.env.APPLE_TEAM_ID;

const macSignConfig = process.env.MAC_CODESIGN_IDENTITY
  ? {
      identity: process.env.MAC_CODESIGN_IDENTITY,
      hardenedRuntime: true,
      entitlements: 'resources/entitlements.mac.plist',
      'entitlements-inherit': 'resources/entitlements.mac.plist',
      'gatekeeper-assess': false,
    }
  : undefined;

const macNotarizeConfig =
  macSignConfig && appleId && appleIdPassword && appleTeamId
    ? {
        tool: 'notarytool',
        appleId,
        appleIdPassword,
        teamId: appleTeamId,
      }
    : undefined;

const config: ForgeConfig = {
  packagerConfig: {
    name: 'Inkline',
    ...(electronZipDir ? { electronZipDir } : {}),
    asar: {
      unpack: '*.{node,dll}',
    },
    icon: iconBasePath,
    executableName: 'inkline',
    osxSign: macSignConfig,
    osxNotarize: macNotarizeConfig,
    extraResource: ['drizzle', 'resources'],
  },
  rebuildConfig: {
    onlyModules: [],
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
  makers: [
    new MakerNsis(),
    new MakerDMG({
      format: 'ULFO',
    }),
    new MakerDeb({
      options: {
        icon: pngIconPath,
      },
    }),
    new MakerAppImage({
      options: {
        bin: 'inkline',
        categories: ['Education'],
        icon: pngIconPath,
      },
    }),
  ],
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
