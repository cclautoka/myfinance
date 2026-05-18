# iOS and Android (Capacitor)

Native shells wrap the same Vite React app. Setup follows [Capacitor — Installing Capacitor](https://capacitorjs.com/docs/getting-started).

## Prerequisites

- **Node** 20+ (same as the web app)
- **Android:** [Android Studio](https://developer.android.com/studio) with SDK 34+
- **iOS (Mac only):** Xcode 15+ and CocoaPods (`sudo gem install cocoapods` if `pod` is missing)

## One-time setup (already in repo)

```bash
npm install
```

Native projects live in `android/` and `ios/`. Config: [`capacitor.config.ts`](../capacitor.config.ts) (`webDir: dist`, app id `cloud.solofi.finance`).

## Build and open

```bash
# Build web assets for native (relative paths + production API URL)
npm run cap:sync

# Open IDE
npm run cap:open:android   # Android Studio
npm run cap:open:ios       # Xcode
```

Then run from Android Studio / Xcode on a device or simulator.

### Scripts

| Script | Purpose |
|--------|---------|
| `npm run build:capacitor` | Vite build with `base: ./` and `.env.capacitor` |
| `npm run cap:sync` | Build + copy into `android/` and `ios/` |
| `npm run cap:open:ios` | Open Xcode |
| `npm run cap:open:android` | Open Android Studio |

## API / backend

The mobile app does **not** bundle the Node server. It talks to your deployed API via [`VITE_PUBLIC_NOTIFY_URL`](../.env.capacitor) (default `https://finance.solofi.cloud/v1/notify`).

To point at another host, edit `.env.capacitor` and run `npm run cap:sync` again.

Ensure the server allows HTTPS from the app (same CORS rules as the browser; empty `NOTIFY_CORS_ORIGINS` on a single-host deploy is fine).

## Live reload (optional)

With the dev server running:

```bash
npm run dev
```

Uncomment and set `server.url` in `capacitor.config.ts` to your machine’s LAN IP (e.g. `http://192.168.1.10:5173`), then `npx cap sync`. See [Capacitor live reload](https://capacitorjs.com/docs/guides/live-reload).

## Store release

- **Android:** build signed APK/AAB in Android Studio → [Deploying to Google Play](https://capacitorjs.com/docs/android/deploying-to-google-play)
- **iOS:** archive in Xcode → [Deploying to App Store](https://capacitorjs.com/docs/ios/deploying-to-app-store)

Replace default launcher icons and splash screens under `android/app/src/main/res/` and `ios/App/App/Assets.xcassets/` before shipping.

## Workflow reminder

After any web change:

```bash
npm run cap:sync
```

Re-run the app from Xcode or Android Studio (or use live reload during development).
