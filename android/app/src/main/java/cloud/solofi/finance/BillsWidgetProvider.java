package cloud.solofi.finance;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

public class BillsWidgetProvider extends AppWidgetProvider {
  private static int clamp(int n, int lo, int hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  private static int dueProgress(String dueIso) {
    try {
      // 14-day horizon: 0 = far, 100 = due/overdue.
      LocalDate due = LocalDate.parse(dueIso);
      long days = ChronoUnit.DAYS.between(LocalDate.now(), due);
      int left = (int) days;
      int pct = 100 - (left * 100 / 14);
      return clamp(pct, 0, 100);
    } catch (Exception e) {
      return 0;
    }
  }

  @Override
  public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
    String json = WidgetBridgePlugin.readCacheJson(context);
    WidgetCache cache = WidgetCache.parse(json);

    for (int id : appWidgetIds) {
      RemoteViews rv = new RemoteViews(context.getPackageName(), R.layout.widget_bills);
      if (cache != null && cache.nextDue != null) {
        rv.setTextViewText(R.id.widget_title, "Due next");
        rv.setTextViewText(R.id.widget_line1, cache.nextDue.label);
        rv.setTextViewText(R.id.widget_line2, cache.nextDue.dueDateIso + " • $" + (int) cache.nextDue.amount);
        rv.setTextViewText(R.id.widget_meta, cache.overdue.size() > 0 ? ("Overdue: " + cache.overdue.size()) : "No overdue");
        rv.setProgressBar(R.id.widget_progress, 100, dueProgress(cache.nextDue.dueDateIso), false);
      } else {
        rv.setTextViewText(R.id.widget_title, "Bills");
        rv.setTextViewText(R.id.widget_line1, "Open app to sync");
        rv.setTextViewText(R.id.widget_line2, "");
        rv.setTextViewText(R.id.widget_meta, "");
        rv.setProgressBar(R.id.widget_progress, 100, 0, false);
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

