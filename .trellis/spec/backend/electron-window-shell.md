# Electron Window Shell

> Native window chrome, titlebar, menu bar, and frame blending rules for the Electron main process.

---

## Scenario: Native Window Chrome Integration

### 1. Scope / Trigger

Use this spec when changing `BrowserWindow` options that affect native shell appearance:

- title bar visibility or style
- menu bar visibility
- traffic-light/window-control placement
- titlebar overlay colors or heights
- background material or frame blending
- renderer drag-region assumptions

These changes are platform-sensitive. Do not apply a single titlebar configuration to all operating systems.

### 2. Signatures

Main process window setup:

```typescript
new BrowserWindow({
  autoHideMenuBar?: boolean;
  backgroundColor?: string;
  backgroundMaterial?: 'auto' | 'none' | 'mica' | 'acrylic' | 'tabbed';
  titleBarOverlay?: boolean | Electron.TitleBarOverlay;
  titleBarStyle?: 'default' | 'hidden' | 'hiddenInset' | 'customButtonsOnHover';
  trafficLightPosition?: Electron.Point;
});
```

Renderer drag contract:

```css
.app-window-drag-strip {
  -webkit-app-region: drag;
}

button,
input,
textarea,
select,
a,
[role='button'],
.scrollable {
  -webkit-app-region: no-drag;
}
```

### 3. Contracts

| Platform | Required behavior |
| -------- | ----------------- |
| macOS | Use native traffic lights. Prefer `titleBarStyle: 'hiddenInset'` for a blended top area. Set `trafficLightPosition` only after checking sidebar/content spacing. |
| Windows | Use `autoHideMenuBar: true` and `setMenuBarVisibility(false)`. If hiding the titlebar, use `titleBarStyle: 'hidden'` with `titleBarOverlay` colors that match renderer tokens. |
| Linux | Keep the titlebar conservative unless a target desktop environment is explicitly tested. Use `autoHideMenuBar: true`, `setMenuBarVisibility(false)`, and a matching `backgroundColor`. Do not assume `titleBarOverlay` behaves consistently across Linux window managers. |
| Renderer | Provide a draggable top region whenever native chrome is hidden or blended. Mark all interactive controls and scroll containers as `no-drag`. |

### 4. Validation & Error Matrix

| Condition | Required response |
| --------- | ----------------- |
| Hidden native titlebar with no drag region | Add a renderer drag strip before merging. |
| Interactive controls inside a drag region | Add `-webkit-app-region: no-drag` to the control or containing component. |
| Linux receives Windows-style `titleBarOverlay` by default | Reject or split platform branches. |
| Window background differs from renderer shell background | Update `backgroundColor` and overlay colors to match design tokens. |
| macOS traffic lights overlap app navigation | Adjust `trafficLightPosition` or renderer top/sidebar spacing. |

### 5. Good/Base/Bad Cases

- Good: macOS uses hidden inset titlebar, Windows uses hidden titlebar overlay, Linux only hides the menu bar and keeps normal titlebar behavior.
- Base: all platforms set `backgroundColor` to the renderer shell background.
- Bad: all platforms use `titleBarStyle: 'hidden'` plus `titleBarOverlay` without Linux visual testing.

### 6. Tests Required

- Typecheck must pass for all `BrowserWindowConstructorOptions` usage.
- Lint must pass after adding platform branches or helper functions.
- `git diff --check` must pass because CSS drag-region changes are spacing-sensitive.
- Smoke-test the running Electron window on each affected OS before release when native chrome behavior changes.

### 7. Wrong vs Correct

#### Wrong

```typescript
const shellOptions = {
  autoHideMenuBar: true,
  titleBarOverlay: true,
  titleBarStyle: 'hidden',
};
```

This assumes Windows titlebar overlay behavior is safe on macOS and Linux.

#### Correct

```typescript
function getNativeShellOptions(): Electron.BrowserWindowConstructorOptions {
  if (process.platform === 'darwin') {
    return { backgroundColor: '#faf8f3', titleBarStyle: 'hiddenInset' };
  }

  if (process.platform === 'win32') {
    return {
      autoHideMenuBar: true,
      backgroundColor: '#faf8f3',
      titleBarOverlay: { color: '#faf8f3', symbolColor: '#242936', height: 40 },
      titleBarStyle: 'hidden',
    };
  }

  return { autoHideMenuBar: true, backgroundColor: '#faf8f3' };
}
```
