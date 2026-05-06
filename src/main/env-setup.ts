import { app } from 'electron';
import { readlinkSync } from 'node:fs';
import path from 'node:path';
import { RUNTIME_IS_PACKAGED_ENV, isPackagedRuntime } from './runtime';

function inferLinuxTimeZone(): string | null {
  if (process.platform !== 'linux') {
    return null;
  }

  try {
    const localtimeTarget = readlinkSync('/etc/localtime');
    const marker = '/zoneinfo/';
    const markerIndex = localtimeTarget.indexOf(marker);
    if (markerIndex === -1) {
      return null;
    }

    const timeZone = localtimeTarget.slice(markerIndex + marker.length);
    return timeZone.length > 0 ? timeZone : null;
  } catch {
    return null;
  }
}

const inferredTimeZone = inferLinuxTimeZone();
if (!process.env.TZ && inferredTimeZone) {
  process.env.TZ = inferredTimeZone;
}

const runtimeIsPackaged = isPackagedRuntime(app.isPackaged);
process.env[RUNTIME_IS_PACKAGED_ENV] = runtimeIsPackaged ? '1' : '0';

export function getRuntimeTimeZone(): string {
  return process.env.TZ || inferredTimeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function getRuntimeTimeZoneOffsetMinutes(): number {
  return -new Date().getTimezoneOffset();
}

if (!runtimeIsPackaged) {
  const e2eUserDataDir = process.env.INKLINE_E2E_USER_DATA_DIR;
  app.setPath(
    'userData',
    e2eUserDataDir && e2eUserDataDir.length > 0 ? e2eUserDataDir : path.join(app.getPath('userData'), 'dev'),
  );
}

export {};
