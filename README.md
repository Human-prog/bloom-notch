# Bloom Notch — Desktop Notch App

A MacBook **Notchy**-style bloom taskbar that lives at the **top center** of your screen (camera/notch area), always on top of your other windows.

## Project structure

```
bloom-notch-app/
├── package.json        # Electron app manifest
├── main.js             # Main process — creates the always-on-top notch window
├── preload.js          # Preload script — bridges Electron APIs to the page
└── bloom-notch.html    # The notch UI (hover to expand, Start menu, clock, apps)
```

## Run it

1. **Install dependencies** (one-time):
   ```bash
   npm install
   ```

2. **Start the app**:
   ```bash
   npm start
   ```

   Or with dev tools:
   ```bash
   npm start -- --dev
   ```

## What you get

| Feature | Behavior |
|---------|----------|
| **Notch at top center** | Frameless, transparent window pinned to `top: 0`, centered horizontally |
| **Always on top** | Stays above every other window |
| **Skip taskbar** | Doesn't appear in your Windows taskbar |
| **Hover to expand** | Collapsed pill expands downward into a bloom taskbar |
| **Bloom glow** | Active app icons pulse with a colored glow ring |
| **Start menu** | Click 🪟 → searchable pinned + all-apps menu |
| **Clock** | Live time + date inside the notch |

## Customize

- **Apps**: Edit the `APPS` array in `bloom-notch.html` (id, label, emoji icon, accent color).
- **Notch size**: Change `notchWidth` / `notchHeight` in `main.js`.
- **Colors**: Edit the CSS variables at the top of `bloom-notch.html`.

## Package for distribution

```bash
npm run pack       # unpacked build
npm run dist       # code-signed installer (needs electron-builder config)
```

## Notes

- The window is `transparent: true` and `frame: false` so it looks like a native notch pill rather than a browser window.
- `skipTaskbar: true` keeps it out of your Windows taskbar so it feels like a system overlay.
- If you want it to launch on startup, add a shortcut to your shell:startup folder or use Electron's `auto-launch` module.
