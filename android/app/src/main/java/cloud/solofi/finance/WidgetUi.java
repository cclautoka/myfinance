package cloud.solofi.finance;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;

/** Shared RemoteViews chrome (HUD overlay + live indicator). */
public final class WidgetUi {
  private WidgetUi() {}

  public static int[] overlaySizePx(Context context, AppWidgetManager mgr, int widgetId, int fallbackWdp, int fallbackHdp) {
    float density = context.getResources().getDisplayMetrics().density;
    int w = (int) (fallbackWdp * density);
    int h = (int) (fallbackHdp * density);
    try {
      Bundle opts = mgr.getAppWidgetOptions(widgetId);
      w = Math.max(w, (int) (opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, fallbackWdp) * density));
      h = Math.max(h, (int) (opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, fallbackHdp) * density));
    } catch (Exception ignored) {
      // use fallback
    }
    return new int[] {w, h};
  }

  public static void applyChrome(
      RemoteViews rv,
      Context context,
      AppWidgetManager mgr,
      int widgetId,
      int accent,
      boolean live,
      int fallbackWdp,
      int fallbackHdp,
      boolean showLiveDot) {
    int[] size = overlaySizePx(context, mgr, widgetId, fallbackWdp, fallbackHdp);
    rv.setImageViewBitmap(R.id.widget_hud_overlay, WidgetArt.drawHudOverlay(size[0], size[1], accent));
    if (!showLiveDot) return;
    if (live) {
      rv.setImageViewBitmap(R.id.widget_live_dot, WidgetArt.drawLiveDot(20));
      rv.setViewVisibility(R.id.widget_live_dot, View.VISIBLE);
    } else {
      rv.setViewVisibility(R.id.widget_live_dot, View.GONE);
    }
  }
}
