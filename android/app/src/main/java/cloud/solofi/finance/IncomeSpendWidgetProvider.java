package cloud.solofi.finance;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

public class IncomeSpendWidgetProvider extends AppWidgetProvider {
  @Override
  public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
    WidgetCache cache = WidgetCache.parse(WidgetBridgePlugin.readCacheJson(context));
    for (int id : appWidgetIds) {
      RemoteViews rv = new RemoteViews(context.getPackageName(), R.layout.widget_income_spend);
      rv.setTextViewText(R.id.widget_title, "Income vs spend");
      if (cache != null) {
        rv.setTextViewText(R.id.widget_line1, "Primary left: $" + (int) cache.income.primaryLeft);
        if (cache.income.partnerOver > 0) {
          rv.setTextViewText(R.id.widget_line2, "Partner over: +$" + (int) cache.income.partnerOver);
        } else {
          rv.setTextViewText(R.id.widget_line2, "Partner left: $" + (int) cache.income.partnerLeft);
        }
      } else {
        rv.setTextViewText(R.id.widget_line1, "Open app to sync");
        rv.setTextViewText(R.id.widget_line2, "");
      }

      Intent open = new Intent(context, MainActivity.class);
      open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
      open.putExtra("route", "#widget=income");
      PendingIntent pi = PendingIntent.getActivity(context, id, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
      rv.setOnClickPendingIntent(R.id.widget_root, pi);

      appWidgetManager.updateAppWidget(id, rv);
    }
  }
}

