import { app } from 'electron';
import { readlinkSync } from 'node:fs';
import path from 'node:path';

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

process.env.INKLINE_RUNTIME_IS_PACKAGED = app.isPackaged ? '1' : '0';

export function getRuntimeTimeZone(): string {
  return process.env.TZ || inferredTimeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function getRuntimeTimeZoneOffsetMinutes(): number {
  return -new Date().getTimezoneOffset();
}

if (!app.isPackaged) {
  const e2eUserDataDir = process.env.INKLINE_E2E_USER_DATA_DIR;
  app.setPath(
    'userData',
    e2eUserDataDir && e2eUserDataDir.length > 0 ? e2eUserDataDir : path.join(app.getPath('userData'), 'dev'),
  );
}

export {};
