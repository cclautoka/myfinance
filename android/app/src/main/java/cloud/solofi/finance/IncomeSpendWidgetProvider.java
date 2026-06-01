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

public class IncomeSpendWidgetProvider extends AppWidgetProvider {
  private static int clamp(int n, int lo, int hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  private static float safePct(double spent, double total) {
    double t = Math.max(0, total);
    if (t <= 0) return 0f;
    double s = Math.max(0, spent);
    return (float) clamp((int) Math.round((s / t) * 100.0), 0, 100) / 100f;
  }

  private static Bitmap drawBars(int w, int h, WidgetCache.IncomeVsSpend v) {
    int width = Math.max(1, w);
    int height = Math.max(1, h);
    Bitmap b = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
    Canvas c = new Canvas(b);

    Paint track = new Paint(Paint.ANTI_ALIAS_FLAG);
    track.setColor(0x35FFFFFF);
    // Match in-app intent: light band = income, darker overlay = spent.
    Paint incomeOwner = new Paint(Paint.ANTI_ALIAS_FLAG);
    incomeOwner.setColor(0x5914B8A6); // teal 35%
    Paint spentOwner = new Paint(Paint.ANTI_ALIAS_FLAG);
    spentOwner.setColor(0xBF115E59); // teal dark ~75%
    Paint incomePartner = new Paint(Paint.ANTI_ALIAS_FLAG);
    incomePartner.setColor(0x5949A6FF); // sky 35%
    Paint spentPartner = new Paint(Paint.ANTI_ALIAS_FLAG);
    spentPartner.setColor(0xBF0C4A6E); // sky dark ~75%
    Paint over = new Paint(Paint.ANTI_ALIAS_FLAG);
    over.setColor(0xFFEF4444); // red

    float pad = 2f;
    float gap = 8f;
    float barH = (height - gap - pad * 2) / 2f;
    float radius = Math.min(10f, barH / 2f);

    RectF r1 = new RectF(pad, pad, width - pad, pad + barH);
    RectF r2 = new RectF(pad, pad + barH + gap, width - pad, pad + barH + gap + barH);

    c.drawRoundRect(r1, radius, radius, track);
    c.drawRoundRect(r2, radius, radius, track);

    double ownerIncome = Math.max(0, v.primaryIncome);
    double partnerIncome = Math.max(0, v.partnerIncome);

    double ownerSpentWithinIncome = Math.max(0, Math.min(ownerIncome, ownerIncome - Math.max(0, v.primaryLeft)));
    double ownerOver = Math.max(0, v.primaryOver);
    double partnerSpentWithinIncome = Math.max(0, Math.min(partnerIncome, partnerIncome - Math.max(0, v.partnerLeft)));
    double partnerOver = Math.max(0, v.partnerOver);

    float ownerIncomePct = safePct(ownerIncome, ownerIncome);
    float partnerIncomePct = safePct(partnerIncome, partnerIncome);
    float ownerSpentPct = safePct(ownerSpentWithinIncome, ownerIncome);
    float partnerSpentPct = safePct(partnerSpentWithinIncome, partnerIncome);

    // Owner bar: income band, spent overlay, overspend cap.
    float r1w = r1.width();
    float r2w = r2.width();

    RectF ownerIncomeRect = new RectF(r1.left, r1.top, r1.left + r1w * ownerIncomePct, r1.bottom);
    c.drawRoundRect(ownerIncomeRect, radius, radius, incomeOwner);
    RectF ownerSpentRect = new RectF(r1.left, r1.top, r1.left + r1w * ownerSpentPct, r1.bottom);
    c.drawRoundRect(ownerSpentRect, radius, radius, spentOwner);
    c.drawRect(ownerSpentRect.right - radius, r1.top, ownerSpentRect.right, r1.bottom, spentOwner);

    RectF partnerIncomeRect = new RectF(r2.left, r2.top, r2.left + r2w * partnerIncomePct, r2.bottom);
    c.drawRoundRect(partnerIncomeRect, radius, radius, incomePartner);
    RectF partnerSpentRect = new RectF(r2.left, r2.top, r2.left + r2w * partnerSpentPct, r2.bottom);
    c.drawRoundRect(partnerSpentRect, radius, radius, spentPartner);
    c.drawRect(partnerSpentRect.right - radius, r2.top, partnerSpentRect.right, r2.bottom, spentPartner);

    if (ownerOver > 0) {
      RectF overRect = new RectF(ownerIncomeRect.right, r1.top, Math.min(r1.right, ownerIncomeRect.right + Math.min(18f, r1w * 0.18f)), r1.bottom);
      c.drawRoundRect(overRect, radius, radius, over);
    }
    if (partnerOver > 0) {
      RectF overRect = new RectF(partnerIncomeRect.right, r2.top, Math.min(r2.right, partnerIncomeRect.right + Math.min(18f, r2w * 0.18f)), r2.bottom);
      c.drawRoundRect(overRect, radius, radius, over);
    }

    return b;
  }

  @Override
  public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
    WidgetCache cache = WidgetCache.parse(WidgetBridgePlugin.readCacheJson(context));
    for (int id : appWidgetIds) {
      RemoteViews rv = new RemoteViews(context.getPackageName(), R.layout.widget_income_spend);
      rv.setTextViewText(R.id.widget_title, "Income vs spend");
      if (cache != null) {
        if (cache.income.primaryOver > 0) {
          rv.setTextViewText(R.id.widget_line1, "Primary over: +$" + (int) cache.income.primaryOver);
        } else {
          rv.setTextViewText(R.id.widget_line1, "Primary left: $" + (int) cache.income.primaryLeft);
        }
        if (cache.income.partnerOver > 0) {
          rv.setTextViewText(R.id.widget_line2, "Partner over: +$" + (int) cache.income.partnerOver);
        } else {
          rv.setTextViewText(R.id.widget_line2, "Partner left: $" + (int) cache.income.partnerLeft);
        }

        int w = 320;
        int h = 40;
        try {
          Bundle opts = appWidgetManager.getAppWidgetOptions(id);
          int minWdp = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 180);
          int minHdp = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 72);
          float density = context.getResources().getDisplayMetrics().density;
          w = Math.max(220, (int) (minWdp * density));
          if (minHdp >= 140) h = 48;
        } catch (Exception e) {
          // ignore
        }
        rv.setImageViewBitmap(R.id.widget_chart, drawBars(w, h, cache.income));
      } else {
        rv.setTextViewText(R.id.widget_line1, "Open app to sync");
        rv.setTextViewText(R.id.widget_line2, "");
        rv.setImageViewBitmap(R.id.widget_chart, drawBars(320, 32, new WidgetCache.IncomeVsSpend(0, 0, 0, 0, 0, 0)));
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

