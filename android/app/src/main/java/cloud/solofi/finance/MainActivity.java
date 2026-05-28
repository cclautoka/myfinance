package cloud.solofi.finance;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;
import android.webkit.WebView;

public class MainActivity extends BridgeActivity {
  private static final String CHANNEL_BILL_REMINDERS = "bill_reminders";

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    // Must register local plugins BEFORE BridgeActivity creates the bridge.
    registerPlugin(WidgetBridgePlugin.class);
    super.onCreate(savedInstanceState);
    WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
    createNotificationChannels();
    applyWidgetRoute(getIntent());
  }

  @Override
  protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
    applyWidgetRoute(intent);
  }

  private void applyWidgetRoute(Intent intent) {
    if (intent == null) return;
    final String route = intent.getStringExtra("route");
    if (route == null || route.trim().isEmpty()) return;
    if (getBridge() == null || getBridge().getWebView() == null) return;

    // Route is controlled by our own widget providers (e.g. "#widget=bills").
    final String safe = route.replace("\\", "\\\\").replace("'", "\\'");
    final WebView wv = getBridge().getWebView();
    // `loadUrl("javascript:...")` can show a blank white page on some Android builds.
    // `evaluateJavascript` runs in-page without navigating.
    wv.post(() -> wv.evaluateJavascript("window.location.hash='" + safe + "';", null));
  }

  private void createNotificationChannels() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return;
    }
    NotificationChannel channel =
        new NotificationChannel(
            CHANNEL_BILL_REMINDERS,
            "Bill reminders",
            NotificationManager.IMPORTANCE_HIGH);
    channel.setDescription("Overdue and upcoming bill alerts from Our Finance");
    NotificationManager manager = getSystemService(NotificationManager.class);
    if (manager != null) {
      manager.createNotificationChannel(channel);
    }
  }
}
