import { app } from 'electron';
import path from 'node:path';

if (!app.isPackaged) {
  app.setPath('userData', path.join(app.getPath('userData'), 'dev'));
}

export {};
