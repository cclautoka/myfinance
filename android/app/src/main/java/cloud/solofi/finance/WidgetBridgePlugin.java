package cloud.solofi.finance;

import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {
  private static final String PREFS = "finance_widget_cache";
  private static final String KEY_JSON = "widget-cache-v1.json";
  private static final String KEY_TOKEN = "household-session-token";
  private static final String KEY_HOUSEHOLD = "household-id";

  @PluginMethod
  public void writeCache(PluginCall call) {
    String json = call.getString("json");
    if (json == null) {
      call.reject("json required");
      return;
    }
    String token = call.getString("token");
    String householdId = call.getString("householdId");
    Context ctx = getContext();
    SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    SharedPreferences.Editor ed = sp.edit().putString(KEY_JSON, json);
    if (token != null && !token.trim().isEmpty()) ed.putString(KEY_TOKEN, token.trim());
    if (householdId != null && !householdId.trim().isEmpty()) ed.putString(KEY_HOUSEHOLD, householdId.trim());
    ed.apply();
    WidgetRefresh.updateAll(ctx);
    call.resolve();
  }

  @PluginMethod
  public void requestRefresh(PluginCall call) {
    WidgetRefresh.updateAll(getContext());
    call.resolve();
  }

  public static String readCacheJson(Context ctx) {
    SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    return sp.getString(KEY_JSON, null);
  }

  public static String readHouseholdToken(Context ctx) {
    SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    return sp.getString(KEY_TOKEN, null);
  }

  public static String readHouseholdId(Context ctx) {
    SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    return sp.getString(KEY_HOUSEHOLD, null);
  }
}

