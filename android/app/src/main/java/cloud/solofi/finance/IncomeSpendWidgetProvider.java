package cloud.solofi.finance;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

public class IncomeSpendWidgetProvider extends AppWidgetProvider {
  @Override
  public void onEnabled(Context context) {
    WidgetRefresh.updateAll(context.getApplicationContext());
  }

  @Override
  public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
    WidgetCache cache = WidgetCache.parse(WidgetBridgePlugin.readCacheJson(context));
    boolean live = cache != null;

    for (int id : appWidgetIds) {
      RemoteViews rv = new RemoteViews(context.getPackageName(), R.layout.widget_income_spend);
      WidgetUi.applyChrome(rv, context, appWidgetManager, id, WidgetArt.ACCENT_TEAL, live, 180, 110, true);
      rv.setTextViewText(R.id.widget_title, "INCOME VS SPEND");

      int w = 320;
      int h = 44;
      int[] size = WidgetUi.overlaySizePx(context, appWidgetManager, id, 180, 110);
      w = Math.max(220, size[0] - 28);
      if (size[1] >= 140) h = 52;

      if (cache != null) {
        if (cache.income.primaryOver > 0) {
          rv.setTextViewText(R.id.widget_line1, "PRI OVER +$" + (int) cache.income.primaryOver);
        } else {
          rv.setTextViewText(R.id.widget_line1, "PRI $" + (int) cache.income.primaryLeft + " LEFT");
        }
        if (cache.income.partnerOver > 0) {
          rv.setTextViewText(R.id.widget_line2, "PTN OVER +$" + (int) cache.income.partnerOver);
        } else {
          rv.setTextViewText(R.id.widget_line2, "PTN $" + (int) cache.income.partnerLeft + " LEFT");
        }
        rv.setImageViewBitmap(R.id.widget_chart, WidgetArt.drawIncomeBars(w, h, cache.income));
      } else {
        rv.setTextViewText(R.id.widget_line1, "OPEN APP TO SYNC");
        rv.setTextViewText(R.id.widget_line2, "STATUS // OFFLINE");
        rv.setImageViewBitmap(
            R.id.widget_chart,
            WidgetArt.drawIncomeBars(w, h, new WidgetCache.IncomeVsSpend(0, 0, 0, 0, 0, 0, 0, 0)));
      }

      Intent open = new Intent(context, MainActivity.class);
      open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
      open.putExtra("route", "#widget=income");
      PendingIntent pi =
          PendingIntent.getActivity(context, id, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
      rv.setOnClickPendingIntent(R.id.widget_root, pi);

      appWidgetManager.updateAppWidget(id, rv);
    }
  }
}
