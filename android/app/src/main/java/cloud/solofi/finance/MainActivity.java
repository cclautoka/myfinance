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
  private String pendingWidgetRoute = null;

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
    pendingWidgetRoute = route.trim();
    applyPendingWidgetRouteWhenReady();
  }

  private void applyPendingWidgetRouteWhenReady() {
    final String route = pendingWidgetRoute;
    if (route == null || route.trim().isEmpty()) return;
    if (getBridge() == null || getBridge().getWebView() == null) {
      getWindow().getDecorView().postDelayed(this::applyPendingWidgetRouteWhenReady, 200);
      return;
    }

    // Route is controlled by our own widget providers (e.g. "#widget=bills").
    final String safe = route.replace("\\", "\\\\").replace("'", "\\'");
    final WebView wv = getBridge().getWebView();
    // `loadUrl("javascript:...")` can show a blank white page on some Android builds.
    // `evaluateJavascript` runs in-page without navigating.
    wv.post(() -> wv.evaluateJavascript(
      "try { window.location.hash='" + safe + "'; } catch (e) {}",
      null
    ));

    // Keep route for a bit; some Android builds race when the page isn't hydrated yet.
    // Retry once more shortly, then clear.
    wv.postDelayed(() -> {
      try {
        wv.evaluateJavascript("try { window.location.hash='" + safe + "'; } catch (e) {}", null);
      } catch (Exception ignored) {}
      pendingWidgetRoute = null;
    }, 650);
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
