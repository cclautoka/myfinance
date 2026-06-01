package cloud.solofi.finance;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;

public class GoalsWidgetProvider extends AppWidgetProvider {
  @Override
  public void onEnabled(Context context) {
    WidgetRefresh.updateAll(context.getApplicationContext());
  }

  @Override
  public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
    WidgetCache cache = WidgetCache.parse(WidgetBridgePlugin.readCacheJson(context));

    for (int id : appWidgetIds) {
      try {
      applyUpdate(context, appWidgetManager, id, cache);
      } catch (Exception e) {
        android.util.Log.e("GoalsWidget", "onUpdate failed", e);
        RemoteViews rv = new RemoteViews(context.getPackageName(), R.layout.widget_goals);
        rv.setTextViewText(R.id.widget_title, "Savings goals");
        rv.setTextViewText(R.id.widget_goal1_label, "Open Our Finance");
        rv.setTextViewText(R.id.widget_goal1_meta, "Tap to load data");
        rv.setViewVisibility(R.id.widget_goal1, android.view.View.VISIBLE);
        appWidgetManager.updateAppWidget(id, rv);
      }
    }
  }

  private static void applyUpdate(Context context, AppWidgetManager appWidgetManager, int id, WidgetCache cache) {
      RemoteViews rv = new RemoteViews(context.getPackageName(), R.layout.widget_goals);
      rv.setTextViewText(R.id.widget_title, "Savings goals");
      int px = 96;
      int rings = 1;
      boolean shortHeight = false;
      try {
        Bundle opts = appWidgetManager.getAppWidgetOptions(id);
        int minWdp = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 120);
        int minHdp = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 80);
        shortHeight = minHdp <= 110;
        int minDp = Math.min(minWdp, minHdp);
        float density = context.getResources().getDisplayMetrics().density;
        // Height is usually the limiting factor; aim for a ring that's clearly visible.
        px = Math.max(44, Math.min(120, (int) (minDp * density * 0.55)));
        // Show more goals when there is enough width.
        rings = (minWdp >= 240) ? 3 : (minWdp >= 180 ? 2 : 1);
        // In a 1-row short widget, show one ring so the $ values fit.
        if (minHdp <= 90) rings = 1;
      } catch (Exception e) {
        // ignore
      }

      int available = (cache != null && cache.goals != null) ? cache.goals.size() : 0;
      int n = Math.min(rings, available);
      // Toggle slots.
      rv.setViewVisibility(R.id.widget_goal1, n >= 1 ? View.VISIBLE : View.GONE);
      rv.setViewVisibility(R.id.widget_goal2, n >= 2 ? View.VISIBLE : View.GONE);
      rv.setViewVisibility(R.id.widget_goal3, n >= 3 ? View.VISIBLE : View.GONE);
      // Always show titles so rings are identifiable. Layout ensures label is single-line.
      rv.setViewVisibility(R.id.widget_goal1_label, View.VISIBLE);
      rv.setViewVisibility(R.id.widget_goal2_label, View.VISIBLE);
      rv.setViewVisibility(R.id.widget_goal3_label, View.VISIBLE);

      if (n >= 1 && cache != null) {
        WidgetCache.GoalItem g = cache.goals.get(0);
        rv.setImageViewBitmap(R.id.widget_goal1_ring, WidgetArt.drawGoalRing(px, (float) g.progressPct));
        rv.setTextViewText(R.id.widget_goal1_label, g.name);
        rv.setTextViewText(R.id.widget_goal1_meta, "$" + (int) g.balance + " / $" + (int) g.target);
      }
      if (n >= 2 && cache != null) {
        WidgetCache.GoalItem g = cache.goals.get(1);
        rv.setImageViewBitmap(R.id.widget_goal2_ring, WidgetArt.drawGoalRing(px, (float) g.progressPct));
        rv.setTextViewText(R.id.widget_goal2_label, g.name);
        rv.setTextViewText(R.id.widget_goal2_meta, "$" + (int) g.balance + " / $" + (int) g.target);
      }
      if (n >= 3 && cache != null) {
        WidgetCache.GoalItem g = cache.goals.get(2);
        rv.setImageViewBitmap(R.id.widget_goal3_ring, WidgetArt.drawGoalRing(px, (float) g.progressPct));
        rv.setTextViewText(R.id.widget_goal3_label, g.name);
        rv.setTextViewText(R.id.widget_goal3_meta, "$" + (int) g.balance + " / $" + (int) g.target);
      }

      if (n < 1) {
        rv.setViewVisibility(R.id.widget_goal1, View.VISIBLE);
        rv.setViewVisibility(R.id.widget_goal2, View.GONE);
        rv.setViewVisibility(R.id.widget_goal3, View.GONE);
        rv.setImageViewBitmap(R.id.widget_goal1_ring, WidgetArt.drawGoalRing(px, 0f));
        rv.setTextViewText(
            R.id.widget_goal1_label,
            cache == null ? "Open Our Finance" : "Waiting for data");
        rv.setTextViewText(
            R.id.widget_goal1_meta,
            cache == null ? "Sign in, then open the app once" : "Open app to refresh");
      }

      Intent open = new Intent(context, MainActivity.class);
      open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
      open.putExtra("route", "#widget=goals");
      PendingIntent pi = PendingIntent.getActivity(context, id, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
      rv.setOnClickPendingIntent(R.id.widget_root, pi);

      appWidgetManager.updateAppWidget(id, rv);
  }
}

