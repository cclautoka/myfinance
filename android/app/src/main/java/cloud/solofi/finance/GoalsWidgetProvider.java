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
import android.widget.RemoteViews;

public class GoalsWidgetProvider extends AppWidgetProvider {
  private static Bitmap drawPie(int size, float pct) {
    Bitmap b = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
    Canvas c = new Canvas(b);
    Paint bg = new Paint(Paint.ANTI_ALIAS_FLAG);
    bg.setColor(0x2230A46C);
    Paint fg = new Paint(Paint.ANTI_ALIAS_FLAG);
    fg.setColor(0xFF0F766E);
    RectF r = new RectF(0, 0, size, size);
    c.drawOval(r, bg);
    c.drawArc(r, -90, 360f * (pct / 100f), true, fg);
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
      rv.setTextViewText(R.id.widget_meta, ((int) pct) + "%");
      rv.setImageViewBitmap(R.id.widget_pie, drawPie(96, pct));

      Intent open = new Intent(context, MainActivity.class);
      open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
      open.putExtra("route", "#widget=goals");
      PendingIntent pi = PendingIntent.getActivity(context, id, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
      rv.setOnClickPendingIntent(R.id.widget_root, pi);

      appWidgetManager.updateAppWidget(id, rv);
    }
  }
}

