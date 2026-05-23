#!/usr/bin/env bash
# Removes extra Our Finance installs (Samsung clone / secondary user). Keeps primary (user 0).
set -euo pipefail
ADB="${ANDROID_HOME:-$HOME/.local/android-build/sdk}/platform-tools/adb"
PKG=cloud.solofi.finance

echo "Our Finance installs per user:"
"$ADB" shell pm list packages --user all "$PKG" 2>/dev/null || true

for user in $("$ADB" shell pm list users 2>/dev/null | sed -n 's/.*UserInfo{\([0-9]*\).*/\1/p'); do
  if [[ "$user" == "0" ]]; then continue; fi
  if "$ADB" shell pm list packages --user "$user" 2>/dev/null | grep -q "$PKG"; then
    echo "Uninstalling clone on user $user…"
    "$ADB" shell pm uninstall --user "$user" "$PKG" || true
  fi
done

echo "Done. If two icons remain, long-press one → App info → Uninstall (duplicate shortcut)."
