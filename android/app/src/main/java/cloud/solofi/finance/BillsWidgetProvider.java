package cloud.solofi.finance;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.view.View;
import android.widget.RemoteViews;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

public class BillsWidgetProvider extends AppWidgetProvider {
  @Override
  public void onEnabled(Context context) {
    WidgetRefresh.updateAll(context.getApplicationContext());
  }

  private static int clamp(int n, int lo, int hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  private static int dueProgress(String dueIso) {
    try {
      LocalDate due = LocalDate.parse(dueIso);
      long days = ChronoUnit.DAYS.between(LocalDate.now(), due);
      int left = (int) days;
      int pct = 100 - (left * 100 / 14);
      return clamp(pct, 0, 100);
    } catch (Exception e) {
      return 0;
    }
  }

  private static boolean isUrgent(String dueIso) {
    try {
      long days = ChronoUnit.DAYS.between(LocalDate.now(), LocalDate.parse(dueIso));
      return days >= 0 && days <= 3;
    } catch (Exception e) {
      return false;
    }
  }

  private static boolean isOverdue(String dueIso) {
    try {
      return ChronoUnit.DAYS.between(LocalDate.now(), LocalDate.parse(dueIso)) < 0;
    } catch (Exception e) {
      return false;
    }
  }

  private static String countdownLine(String dueIso, double amount) {
    try {
      long days = ChronoUnit.DAYS.between(LocalDate.now(), LocalDate.parse(dueIso));
      int amt = (int) Math.round(amount);
      if (days < 0) {
        return "OVERDUE T+" + Math.abs(days) + "D · $" + amt;
      }
      if (days == 0) {
        return "DUE TODAY · $" + amt;
      }
      return "T-" + days + "D · " + dueIso + " · $" + amt;
    } catch (Exception e) {
      return dueIso + " · $" + (int) Math.round(amount);
    }
  }

  @Override
  public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
    String json = WidgetBridgePlugin.readCacheJson(context);
    WidgetCache cache = WidgetCache.parse(json);
    boolean live = cache != null;

    for (int id : appWidgetIds) {
      try {
        RemoteViews rv = new RemoteViews(context.getPackageName(), R.layout.widget_bills);
        WidgetUi.applyChrome(rv, context, appWidgetManager, id, WidgetArt.ACCENT_AMBER, live, 180, 180, true);

        int progressPct = 0;
        boolean urgent = false;
        boolean overdue = false;

        if (cache != null && cache.nextDue != null) {
          rv.setTextViewText(R.id.widget_title, "NEXT DUE");
          rv.setTextViewText(R.id.widget_line1, cache.nextDue.label);
          rv.setTextViewText(
              R.id.widget_line2, countdownLine(cache.nextDue.dueDateIso, cache.nextDue.amount));
          progressPct = dueProgress(cache.nextDue.dueDateIso);
          urgent = isUrgent(cache.nextDue.dueDateIso);
          overdue = isOverdue(cache.nextDue.dueDateIso);

          if (cache.overdue.size() > 0) {
            rv.setViewVisibility(R.id.widget_meta, View.VISIBLE);
            rv.setTextViewText(
                R.id.widget_meta, "ALERT // " + cache.overdue.size() + " OVERDUE");
          } else {
            rv.setViewVisibility(R.id.widget_meta, View.GONE);
          }
        } else {
          rv.setTextViewText(R.id.widget_title, "BILLS MODULE");
          rv.setTextViewText(R.id.widget_line1, "Open app to sync");
          rv.setTextViewText(R.id.widget_line2, "STATUS // AWAITING DATA");
          rv.setViewVisibility(R.id.widget_meta, View.GONE);
        }

        int[] size = WidgetUi.overlaySizePx(context, appWidgetManager, id, 180, 180);
        rv.setImageViewBitmap(
            R.id.widget_progress_bitmap,
            WidgetArt.drawDueProgress(Math.max(280, size[0] - 28), 20, progressPct, urgent, overdue));

        Intent open = new Intent(context, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        open.putExtra("route", "#widget=bills");
        PendingIntent pi =
            PendingIntent.getActivity(
                context, id, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        rv.setOnClickPendingIntent(R.id.widget_root, pi);

        appWidgetManager.updateAppWidget(id, rv);
      } catch (Exception e) {
        android.util.Log.e("BillsWidget", "onUpdate failed", e);
      }
    }
  }
}
