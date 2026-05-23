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

### Costs: Firebase vs Apple

| Service | Cost | Needed for |
|--------|------|------------|
| **Firebase (FCM)** | **Free** for normal notification volume | Sending pushes from your server to Android + iPhone |
| **Apple Developer Program** | **$99 USD / year** | **iPhone lock-screen push** (APNs). Not a Firebase fee. |

You can use **Android push + email** without paying Apple. **iPhone push requires the paid Apple account** — there is no workaround for real APNs on a personal/free signing team.

### Server (Firebase Cloud Messaging)

Push delivery uses **FCM** for both platforms (one service account on the server):

1. [Firebase Console](https://console.firebase.google.com/) → project **Our Finance** (`our-finance-4271e`).
2. **Android:** add app `cloud.solofi.finance` → download **`google-services.json`** → `android/app/google-services.json` (gitignored).
3. **iOS:** add app with bundle ID `cloud.solofi.finance` → download **`GoogleService-Info.plist`** → copy to **`ios/App/App/GoogleService-Info.plist`** (gitignored; already wired in the Xcode project).
4. **iOS APNs in Firebase:** Project settings → **Cloud Messaging** → Apple app configuration → upload **APNs Authentication Key** (.p8 from [Apple Developer](https://developer.apple.com/account/resources/authkeys/list) — requires paid membership).

#### Firebase wizard steps 3–4 (iOS): skip for this Capacitor app

Firebase Console will show **Add Firebase SDK** (Swift Package Manager) and **Add initialization code** (`FirebaseApp.configure()` in `AppDelegate`). **Do not add those** for Our Finance:

- Push uses **`@capacitor/push-notifications`** → Apple **APNs** on the device; your **server** sends via **FCM** using the service account + APNs key in Firebase.
- Adding `firebase-ios-sdk` and `import FirebaseCore` would duplicate that stack and is not required.

In the wizard: complete step 2 (plist), upload APNs in Cloud Messaging, then **Continue to console**. Skip SPM and `AppDelegate` snippets.
5. **Service account:** Project settings → Service accounts → Generate new private key → enable **Firebase Cloud Messaging API** in Google Cloud if prompted.
6. On the notify server (`server/env.example`):
   - `FCM_SERVICE_ACCOUNT_PATH=/path/to/service-account.json`, or
   - `FCM_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'`

Run `npm run db:migrate` (or restart the server so `push_device_token` exists).

Save-summary emails are **debounced** and only sent when workbook fields actually change; the **7am** cron (`REMINDER_CRON_*`) is unchanged.

### iOS Xcode (push capability)

- For **paid** Apple Developer: set `App/App.entitlements` to `aps-environment` = `development` (USB debug) or `production` (TestFlight/App Store).
- Add `remote-notification` under **UIBackgroundModes** in `Info.plist` if missing.
- **Free personal team:** Xcode cannot enable push; the app installs without `aps-environment` and **Enable on this device** on iPhone will not deliver real pushes until you use a paid team.

### Android

- `POST_NOTIFICATIONS` is declared; Android 13+ shows a runtime permission (handled by the Capacitor plugin).
- Without `google-services.json`, the app builds but **push registration on Android will fail**.
- **`google-services.json` is gitignored** — keep your copy in `android/app/` only (not the repo root).

### Samsung duplicate app icon

If two **Our Finance** icons appear (one with a dual-app badge), our install script removes clones on secondary Android users. Long-press the extra icon → **Remove**, or uninstall via Settings. Dual Messenger does not list Our Finance; the duplicate is usually a **clone user** or **home-screen shortcut**, not a second Firebase app.

## Workflow reminder

After any web change:

```bash
npm run cap:sync
```

Re-run the app from Xcode or Android Studio (or use live reload during development).
