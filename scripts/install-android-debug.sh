#!/usr/bin/env bash
# Install debug APK on the primary user only (avoids Samsung "dual app" duplicate icons).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export JAVA_HOME="${JAVA_HOME:-$HOME/.local/android-build/jdk21/Contents/Home}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/.local/android-build/sdk}"
ADB="$ANDROID_HOME/platform-tools/adb"
APK="$ROOT/android/app/build/outputs/apk/debug/app-debug.apk"
PKG=cloud.solofi.finance

if [[ ! -f "$APK" ]]; then
  echo "APK missing — building…"
  cd "$ROOT"
  npm run build:capacitor
  npx cap sync android
  cd android && ./gradlew assembleDebug --no-daemon
fi

echo "Waiting for device (USB debugging + authorize this Mac)…"
"$ADB" wait-for-device
"$ADB" devices -l

echo "Removing old installs on secondary users (Samsung dual-app clones)…"
while read -r user _; do
  [[ "$user" =~ ^[0-9]+$ ]] || continue
  if [[ "$user" == "0" ]]; then continue; fi
  if "$ADB" shell pm list packages --user "$user" 2>/dev/null | grep -q "$PKG"; then
    echo "  uninstall user $user"
    "$ADB" shell pm uninstall --user "$user" "$PKG" 2>/dev/null || true
  fi
done < <("$ADB" shell pm list users 2>/dev/null | sed -n 's/.*UserInfo{\([0-9]*\).*/\1/p')

echo "Installing on primary user (0)…"
"$ADB" install -r --user 0 "$APK"
echo "Installed $PKG on user 0."
echo "If two icons remain: long-press the duplicate → Remove shortcut, or Settings → Apps → Our Finance."
