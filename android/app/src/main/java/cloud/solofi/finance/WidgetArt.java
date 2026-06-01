package cloud.solofi.finance;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.SweepGradient;

/** Shared canvas drawing for home-screen widgets (matches in-app teal / moss palette). */
public final class WidgetArt {
  private WidgetArt() {}

  public static Bitmap drawGoalRing(int size, float pct) {
    Bitmap b = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
    Canvas c = new Canvas(b);
    float stroke = Math.max(7f, size * 0.12f);
    float inset = stroke / 2f;
    RectF r = new RectF(inset, inset, size - inset, size - inset);

    Paint track = new Paint(Paint.ANTI_ALIAS_FLAG);
    track.setStyle(Paint.Style.STROKE);
    track.setStrokeWidth(stroke);
    track.setStrokeCap(Paint.Cap.ROUND);
    track.setColor(0x55FFFFFF);

    Paint fg = new Paint(Paint.ANTI_ALIAS_FLAG);
    fg.setStyle(Paint.Style.STROKE);
    fg.setStrokeWidth(stroke);
    fg.setStrokeCap(Paint.Cap.ROUND);
    fg.setShader(
        new SweepGradient(
            size / 2f,
            size / 2f,
            new int[] {0xFF2DD4BF, 0xFF14B8A6, 0xFF10B981, 0xFF2DD4BF},
            new float[] {0f, 0.35f, 0.7f, 1f}));

    c.drawArc(r, 0, 360f, false, track);
    float sweep = 360f * (Math.max(0f, Math.min(100f, pct)) / 100f);
    if (sweep > 0.5f) {
      c.drawArc(r, -90, sweep, false, fg);
    }
    return b;
  }

  public static Bitmap drawDueProgress(int width, int height, int pct, boolean urgent, boolean overdue) {
    int w = Math.max(1, width);
    int h = Math.max(1, height);
    Bitmap b = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
    Canvas c = new Canvas(b);
    float radius = h / 2f;
    RectF track = new RectF(0, 0, w, h);

    Paint trackPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    trackPaint.setColor(0x30FFFFFF);
    c.drawRoundRect(track, radius, radius, trackPaint);

    float fillW = w * (Math.max(0, Math.min(100, pct)) / 100f);
    if (fillW > 1f) {
      RectF fill = new RectF(0, 0, fillW, h);
      Paint fillPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
      int start;
      int end;
      if (overdue) {
        start = 0xFFF87171;
        end = 0xFFDC2626;
      } else if (urgent) {
        start = 0xFFFCD34D;
        end = 0xFFD97706;
      } else {
        start = 0xFF2DD4BF;
        end = 0xFF0F766E;
      }
      fillPaint.setShader(new LinearGradient(0, 0, fillW, 0, start, end, Shader.TileMode.CLAMP));
      c.drawRoundRect(fill, radius, radius, fillPaint);
    }
    return b;
  }
}
