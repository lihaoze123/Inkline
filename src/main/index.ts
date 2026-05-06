import { app, BrowserWindow } from 'electron';
import type { BrowserWindowConstructorOptions } from 'electron';
import './env-setup';
import path from 'node:path';
import { runMigrations } from './db/migrate';
import { getPackagedResourcesPath, isPackagedRuntime } from './runtime';
import { registerIpcHandlers } from './ipc/handlers';

const WINDOW_BACKGROUND_COLOR = '#faf8f3';
const WINDOW_CONTROL_SYMBOL_COLOR = '#242936';
const WINDOW_TITLE_BAR_HEIGHT = 40;

let mainWindow: BrowserWindow | null = null;

function getWindowIconPath(): string {
  if (isPackagedRuntime(app.isPackaged)) {
    return path.join(getPackagedResourcesPath(), 'resources', 'icon.png');
  }

  return path.join(app.getAppPath(), 'resources', 'icon.png');
}

type NativeShellOptions = Pick<
  BrowserWindowConstructorOptions,
  | 'autoHideMenuBar'
  | 'backgroundColor'
  | 'backgroundMaterial'
  | 'titleBarOverlay'
  | 'titleBarStyle'
  | 'trafficLightPosition'
>;

function getNativeShellOptions(): NativeShellOptions {
  const sharedOptions: NativeShellOptions = {
    backgroundColor: WINDOW_BACKGROUND_COLOR,
  };

  if (process.platform === 'darwin') {
    return {
      ...sharedOptions,
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 18, y: 18 },
    };
  }

  const titleBarOverlay = {
    color: WINDOW_BACKGROUND_COLOR,
    symbolColor: WINDOW_CONTROL_SYMBOL_COLOR,
    height: WINDOW_TITLE_BAR_HEIGHT,
  };

  if (process.platform === 'win32') {
    return {
      ...sharedOptions,
      autoHideMenuBar: true,
      backgroundMaterial: 'none',
      titleBarOverlay,
      titleBarStyle: 'hidden',
    };
  }

  return {
    ...sharedOptions,
    autoHideMenuBar: true,
  };
}

function createWindow(): void {
  const iconPath = process.platform === 'darwin' ? undefined : getWindowIconPath();

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 860,
    minHeight: 620,
    title: 'Inkline',
    ...getNativeShellOptions(),
    ...(iconPath ? { icon: iconPath } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (process.platform !== 'darwin') {
    mainWindow.setMenuBarVisibility(false);
  }

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    void mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }
}

app.whenReady().then(() => {
  const migrationResult = runMigrations();
  registerIpcHandlers(migrationResult);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
