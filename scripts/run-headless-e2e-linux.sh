#!/usr/bin/env bash
set -euo pipefail

missing_tools=()
for tool in dbus-run-session gnome-keyring-daemon xvfb-run; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    missing_tools+=("$tool")
  fi
done

if [ "${#missing_tools[@]}" -gt 0 ]; then
  printf 'Missing required headless e2e runtime tools: %s\n' "${missing_tools[*]}" >&2
  printf 'Install Xvfb, DBus, and gnome-keyring Secret Service support before running pnpm test:e2e:headless.\n' >&2
  printf 'On NixOS, include packages such as xvfb-run, dbus, and gnome-keyring in the dev shell.\n' >&2
  exit 127
fi

export XDG_SESSION_TYPE=x11
export ELECTRON_OZONE_PLATFORM_HINT=x11
unset WAYLAND_DISPLAY

exec dbus-run-session -- bash -c '
set -euo pipefail
export XDG_SESSION_TYPE=x11
export ELECTRON_OZONE_PLATFORM_HINT=x11
unset WAYLAND_DISPLAY

if keyring_env="$(printf "%s\n" "" | gnome-keyring-daemon --unlock --components=secrets)"; then
  if [ -n "$keyring_env" ]; then
    eval "$keyring_env"
  fi
else
  keyring_env="$(gnome-keyring-daemon --start --components=secrets)"
  if [ -n "$keyring_env" ]; then
    eval "$keyring_env"
  fi
fi

exec xvfb-run -a pnpm test:e2e
'
