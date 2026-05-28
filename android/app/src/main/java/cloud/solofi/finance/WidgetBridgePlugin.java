package cloud.solofi.finance;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {
  private static final String PREFS = "finance_widget_cache";
  private static final String KEY_JSON = "widget-cache-v1.json";

  @PluginMethod
  public void writeCache(PluginCall call) {
    String json = call.getString("json");
    if (json == null) {
      call.reject("json required");
      return;
    }
    Context ctx = getContext();
    SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    sp.edit().putString(KEY_JSON, json).apply();
    call.resolve();
  }

  @PluginMethod
  public void requestRefresh(PluginCall call) {
    Context ctx = getContext();
    Intent intent = new Intent(ctx, BillsWidgetProvider.class);
    intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
    ctx.sendBroadcast(intent);

    Intent intent2 = new Intent(ctx, GoalsWidgetProvider.class);
    intent2.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
    ctx.sendBroadcast(intent2);

    Intent intent3 = new Intent(ctx, IncomeSpendWidgetProvider.class);
    intent3.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
    ctx.sendBroadcast(intent3);

    Intent intent4 = new Intent(ctx, PayLogWidgetProvider.class);
    intent4.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
    ctx.sendBroadcast(intent4);

    call.resolve();
  }

  public static String readCacheJson(Context ctx) {
    SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    return sp.getString(KEY_JSON, null);
  }
}

