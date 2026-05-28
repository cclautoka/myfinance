package cloud.solofi.finance;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

public class BillsWidgetProvider extends AppWidgetProvider {
  @Override
  public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
    String json = WidgetBridgePlugin.readCacheJson(context);
    WidgetCache cache = WidgetCache.parse(json);

    for (int id : appWidgetIds) {
      RemoteViews rv = new RemoteViews(context.getPackageName(), R.layout.widget_bills);
      if (cache != null && cache.nextDue != null) {
        rv.setTextViewText(R.id.widget_title, "Next due");
        rv.setTextViewText(R.id.widget_line1, cache.nextDue.label);
        rv.setTextViewText(R.id.widget_line2, cache.nextDue.dueDateIso);
        rv.setTextViewText(R.id.widget_meta, cache.overdue.size() > 0 ? ("Overdue: " + cache.overdue.size()) : "No overdue");
      } else {
        rv.setTextViewText(R.id.widget_title, "Bills");
        rv.setTextViewText(R.id.widget_line1, "Open app to sync");
        rv.setTextViewText(R.id.widget_line2, "");
        rv.setTextViewText(R.id.widget_meta, "");
      }

      Intent open = new Intent(context, MainActivity.class);
      open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
      open.putExtra("route", "#widget=bills");
      PendingIntent pi = PendingIntent.getActivity(context, id, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
      rv.setOnClickPendingIntent(R.id.widget_root, pi);

      appWidgetManager.updateAppWidget(id, rv);
    }
  }
}

