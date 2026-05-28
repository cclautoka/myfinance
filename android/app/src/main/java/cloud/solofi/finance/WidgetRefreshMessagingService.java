package cloud.solofi.finance;

import android.appwidget.AppWidgetManager;
import android.content.Intent;

import androidx.annotation.NonNull;
import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Map;

public class WidgetRefreshMessagingService extends MessagingService {
  private static String slurp(InputStream in) throws Exception {
    BufferedReader br = new BufferedReader(new InputStreamReader(in));
    StringBuilder sb = new StringBuilder();
    String line;
    while ((line = br.readLine()) != null) sb.append(line);
    return sb.toString();
  }

  private void refreshCacheFromServerBestEffort() {
    try {
      final String token = WidgetBridgePlugin.readHouseholdToken(this);
      final String householdId = WidgetBridgePlugin.readHouseholdId(this);
      if (token == null || token.trim().isEmpty()) return;
      if (householdId == null || householdId.trim().isEmpty()) return;

      URL url = new URL("https://finance.solofi.cloud/v1/state?id=" + householdId.trim());
      HttpURLConnection conn = (HttpURLConnection) url.openConnection();
      conn.setRequestMethod("GET");
      conn.setRequestProperty("Authorization", "Bearer " + token.trim());
      conn.setConnectTimeout(8000);
      conn.setReadTimeout(12000);
      int code = conn.getResponseCode();
      if (code < 200 || code >= 300) return;
      String body = slurp(conn.getInputStream());
      JSONObject j = new JSONObject(body);
      JSONObject state = j.optJSONObject("state");
      if (state == null) return;
      JSONObject cache = state.optJSONObject("_widgetCacheV1");
      if (cache == null) return;
      // Store updated widget cache json for providers to render immediately.
      getSharedPreferences("finance_widget_cache", MODE_PRIVATE)
        .edit()
        .putString("widget-cache-v1.json", cache.toString())
        .apply();
    } catch (Exception ignored) {
      // Best-effort; OS/network may block background work.
    }
  }

  @Override
  public void onMessageReceived(@NonNull RemoteMessage message) {
    // Forward all push payloads to Capacitor first so JS listeners fire (test pushes, bill reminders, etc).
    super.onMessageReceived(message);

    Map<String, String> data = message.getData();
    if (data == null) return;
    String type = data.get("type");
    if (!"widgets_refresh".equals(type)) return;

    // Background thread: network fetch + then trigger widget redraw.
    new Thread(() -> {
      refreshCacheFromServerBestEffort();

      Intent i1 = new Intent(this, BillsWidgetProvider.class);
      i1.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
      sendBroadcast(i1);

      Intent i2 = new Intent(this, GoalsWidgetProvider.class);
      i2.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
      sendBroadcast(i2);

      Intent i3 = new Intent(this, IncomeSpendWidgetProvider.class);
      i3.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
      sendBroadcast(i3);

      Intent i4 = new Intent(this, PayLogWidgetProvider.class);
      i4.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
      sendBroadcast(i4);
    }).start();
  }

  @Override
  public void onNewToken(@NonNull String token) {
    super.onNewToken(token);
  }
}

