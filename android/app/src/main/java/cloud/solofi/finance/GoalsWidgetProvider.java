package cloud.solofi.finance;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.os.Bundle;
import android.widget.RemoteViews;

public class GoalsWidgetProvider extends AppWidgetProvider {
  private static Bitmap drawPie(int size, float pct) {
    Bitmap b = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
    Canvas c = new Canvas(b);
    float stroke = Math.max(8f, size * 0.14f);
    float inset = stroke / 2f;
    RectF r = new RectF(inset, inset, size - inset, size - inset);

    Paint track = new Paint(Paint.ANTI_ALIAS_FLAG);
    track.setStyle(Paint.Style.STROKE);
    track.setStrokeWidth(stroke);
    track.setStrokeCap(Paint.Cap.ROUND);
    // Higher contrast: on dark gradient, low-alpha track reads as "missing".
    track.setColor(0x66FFFFFF);

    Paint fg = new Paint(Paint.ANTI_ALIAS_FLAG);
    fg.setStyle(Paint.Style.STROKE);
    fg.setStrokeWidth(stroke);
    fg.setStrokeCap(Paint.Cap.ROUND);
    fg.setColor(0xFFFFFFFF);

    c.drawArc(r, 0, 360f, false, track);
    c.drawArc(r, -90, 360f * (pct / 100f), false, fg);
    return b;
  }

  @Override
  public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
    WidgetCache cache = WidgetCache.parse(WidgetBridgePlugin.readCacheJson(context));
    String name = (cache != null && cache.goals.size() > 0) ? cache.goals.get(0).name : "Set goals";
    float pct = (cache != null && cache.goals.size() > 0) ? (float) cache.goals.get(0).progressPct : 0f;

    for (int id : appWidgetIds) {
      RemoteViews rv = new RemoteViews(context.getPackageName(), R.layout.widget_goals);
      rv.setTextViewText(R.id.widget_title, "Goals");
      rv.setTextViewText(R.id.widget_line1, name);
      if (cache != null && cache.goals.size() > 0) {
        WidgetCache.GoalItem g = cache.goals.get(0);
        if (g.target > 0 && g.balance > 0) {
          rv.setTextViewText(R.id.widget_meta, "$" + (int) g.balance + " / $" + (int) g.target);
        } else {
          rv.setTextViewText(R.id.widget_meta, ((int) pct) + "%");
        }
      } else {
        rv.setTextViewText(R.id.widget_meta, ((int) pct) + "%");
      }
      int px = 96;
      int rings = 1;
      try {
        Bundle opts = appWidgetManager.getAppWidgetOptions(id);
        int minWdp = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 120);
        int minHdp = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 80);
        int minDp = Math.min(minWdp, minHdp);
        float density = context.getResources().getDisplayMetrics().density;
        // Height is usually the limiting factor; aim for a ring that's clearly visible.
        px = Math.max(56, Math.min(160, (int) (minDp * density * 0.8)));
        // Show more goals when there is enough width.
        rings = (minWdp >= 240) ? 3 : (minWdp >= 180 ? 2 : 1);
      } catch (Exception e) {
        // ignore
      }

      // Composite rings (up to 3) into the one ImageView.
      int n = (cache != null && cache.goals != null) ? Math.min(rings, cache.goals.size()) : 0;
      if (n <= 0) {
        rv.setImageViewBitmap(R.id.widget_pie, drawPie(px, pct));
      } else if (n == 1) {
        rv.setImageViewBitmap(R.id.widget_pie, drawPie(px, (float) cache.goals.get(0).progressPct));
      } else {
        int gap = Math.max(8, (int) (px * 0.12f));
        int w = px * n + gap * (n - 1);
        Bitmap b = Bitmap.createBitmap(w, px, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(b);
        StringBuilder line = new StringBuilder();
        for (int i = 0; i < n; i++) {
          WidgetCache.GoalItem g = cache.goals.get(i);
          Bitmap ring = drawPie(px, (float) g.progressPct);
          c.drawBitmap(ring, i * (px + gap), 0, null);
          if (i == 0) {
            line.append(g.name);
          } else {
            line.append(" · ").append(g.name);
          }
        }
        rv.setImageViewBitmap(R.id.widget_pie, b);
        rv.setTextViewText(R.id.widget_line1, line.toString());
      }

      Intent open = new Intent(context, MainActivity.class);
      open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
      open.putExtra("route", "#widget=goals");
      PendingIntent pi = PendingIntent.getActivity(context, id, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
      rv.setOnClickPendingIntent(R.id.widget_root, pi);

      appWidgetManager.updateAppWidget(id, rv);
    }
  }
}

