package cloud.solofi.finance;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.util.Log;

/** Reliable widget redraw (explicit onUpdate; broadcast alone is flaky on some OEMs). */
public final class WidgetRefresh {
  private static final String TAG = "WidgetRefresh";

  private WidgetRefresh() {}

  public static void updateAll(Context ctx) {
    if (ctx == null) return;
    AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
    safeUpdate(ctx, mgr, BillsWidgetProvider.class);
    safeUpdate(ctx, mgr, GoalsWidgetProvider.class);
    safeUpdate(ctx, mgr, IncomeSpendWidgetProvider.class);
    safeUpdate(ctx, mgr, PayLogWidgetProvider.class);
  }

  private static void safeUpdate(Context ctx, AppWidgetManager mgr, Class<? extends android.appwidget.AppWidgetProvider> cls) {
    try {
      int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, cls));
      if (ids == null || ids.length == 0) return;
      android.appwidget.AppWidgetProvider provider = cls.getDeclaredConstructor().newInstance();
      provider.onUpdate(ctx, mgr, ids);
    } catch (Exception e) {
      Log.w(TAG, "Widget update failed for " + cls.getSimpleName(), e);
    }
  }
}
