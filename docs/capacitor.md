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

## Push notifications (iOS & Android)

The native app can receive **bill reminder** pushes (same daily cron as email when configured).

### In the app

1. Sign in on the phone.
2. Open **Tools → App notifications** (management panel).
3. Turn on **Bill reminders (push)** for the household (syncs with your workbook).
4. Under **This device**, tap **Enable on this device** and allow the system prompt.
5. Review **Household devices** to see registered phones or remove old ones.

### Server (Firebase Cloud Messaging)

Push delivery uses **FCM** for both platforms:

1. Create a [Firebase](https://console.firebase.google.com/) project and add iOS (`cloud.solofi.finance`) and Android apps.
2. Download **`google-services.json`** into `android/app/` (enables the Google Services Gradle plugin).
3. Upload your **APNs key** in Firebase → Project settings → Cloud Messaging (iOS).
4. Create a service account with **Firebase Cloud Messaging API** enabled; download JSON.
5. On the notify server, set either:
   - `FCM_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'` (single line), or
   - `FCM_SERVICE_ACCOUNT_PATH=/path/to/service-account.json`

Run `npm run db:migrate` (or restart the server so `push_device_token` is created).

### iOS Xcode

- **Push Notifications** capability should be on via `App/App.entitlements` (`aps-environment`).
- For TestFlight/App Store builds, switch `aps-environment` to `production` or use separate entitlements per configuration.

### Android

- `POST_NOTIFICATIONS` is declared; Android 13+ shows a runtime permission (handled by the Capacitor plugin).
- Without `google-services.json`, the app builds but **push registration on Android will fail**.

## Workflow reminder

After any web change:

```bash
npm run cap:sync
```

Re-run the app from Xcode or Android Studio (or use live reload during development).
