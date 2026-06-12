package cloud.solofi.finance;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.SweepGradient;
import android.graphics.Typeface;

/** Shared canvas drawing for home-screen widgets — dark HUD / neon teal palette. */
public final class WidgetArt {
  public static final int ACCENT_TEAL = 0xFF2DD4BF;
  public static final int ACCENT_AMBER = 0xFFFBBF24;
  public static final int ACCENT_VIOLET = 0xFFA78BFA;
  public static final int ACCENT_CYAN = 0xFF22D3EE;

  private WidgetArt() {}

  /** Grid + corner brackets overlay (set on full-widget ImageView). */
  public static Bitmap drawHudOverlay(int width, int height, int accentArgb) {
    int w = Math.max(1, width);
    int h = Math.max(1, height);
    Bitmap b = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
    Canvas c = new Canvas(b);

    Paint grid = new Paint(Paint.ANTI_ALIAS_FLAG);
    grid.setColor(0x18FFFFFF);
    grid.setStrokeWidth(1f);
    float step = Math.max(14f, Math.min(w, h) / 8f);
    for (float x = step; x < w; x += step) {
      c.drawLine(x, 0, x, h, grid);
    }
    for (float y = step; y < h; y += step) {
      c.drawLine(0, y, w, y, grid);
    }

    Paint glow = new Paint(Paint.ANTI_ALIAS_FLAG);
    glow.setColor(accentArgb & 0x55FFFFFF | 0x22000000);
    glow.setStrokeWidth(2f);
    c.drawLine(0, 3f, w, 3f, glow);

    Paint bracket = new Paint(Paint.ANTI_ALIAS_FLAG);
    bracket.setStyle(Paint.Style.STROKE);
    bracket.setStrokeWidth(2f);
    bracket.setColor(accentArgb);
    float len = Math.min(18f, w * 0.08f);
    float pad = 10f;
    Path p = new Path();
    p.moveTo(pad, pad + len);
    p.lineTo(pad, pad);
    p.lineTo(pad + len, pad);
    c.drawPath(p, bracket);
    p.reset();
    p.moveTo(w - pad - len, pad);
    p.lineTo(w - pad, pad);
    p.lineTo(w - pad, pad + len);
    c.drawPath(p, bracket);
    p.reset();
    p.moveTo(pad, h - pad - len);
    p.lineTo(pad, h - pad);
    p.lineTo(pad + len, h - pad);
    c.drawPath(p, bracket);
    p.reset();
    p.moveTo(w - pad - len, h - pad);
    p.lineTo(w - pad, h - pad);
    p.lineTo(w - pad, h - pad - len);
    c.drawPath(p, bracket);

    return b;
  }

  public static Bitmap drawLiveDot(int size) {
    int s = Math.max(8, size);
    Bitmap b = Bitmap.createBitmap(s, s, Bitmap.Config.ARGB_8888);
    Canvas c = new Canvas(b);
    Paint glow = new Paint(Paint.ANTI_ALIAS_FLAG);
    glow.setColor(0x5510B981);
    c.drawCircle(s / 2f, s / 2f, s / 2f, glow);
    Paint core = new Paint(Paint.ANTI_ALIAS_FLAG);
    core.setColor(0xFF34D399);
    c.drawCircle(s / 2f, s / 2f, s * 0.28f, core);
    return b;
  }

  public static Bitmap drawGoalRing(int size, float pct) {
    return drawGoalRing(size, pct, null);
  }

  public static Bitmap drawGoalRing(int size, float pct, String centerLabel) {
    Bitmap b = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
    Canvas c = new Canvas(b);
    float stroke = Math.max(6f, size * 0.11f);
    float inset = stroke / 2f + 1f;
    RectF r = new RectF(inset, inset, size - inset, size - inset);

    Paint glow = new Paint(Paint.ANTI_ALIAS_FLAG);
    glow.setStyle(Paint.Style.STROKE);
    glow.setStrokeWidth(stroke + 4f);
    glow.setStrokeCap(Paint.Cap.ROUND);
    glow.setColor(0x332DD4BF);

    Paint track = new Paint(Paint.ANTI_ALIAS_FLAG);
    track.setStyle(Paint.Style.STROKE);
    track.setStrokeWidth(stroke);
    track.setStrokeCap(Paint.Cap.ROUND);
    track.setColor(0x40FFFFFF);

    Paint fg = new Paint(Paint.ANTI_ALIAS_FLAG);
    fg.setStyle(Paint.Style.STROKE);
    fg.setStrokeWidth(stroke);
    fg.setStrokeCap(Paint.Cap.ROUND);
    fg.setShader(
        new SweepGradient(
            size / 2f,
            size / 2f,
            new int[] {0xFF5EEAD4, 0xFF14B8A6, 0xFF10B981, 0xFF5EEAD4},
            new float[] {0f, 0.35f, 0.7f, 1f}));

    c.drawArc(r, 0, 360f, false, track);
    float sweep = 360f * (Math.max(0f, Math.min(100f, pct)) / 100f);
    if (sweep > 0.5f) {
      c.drawArc(r, -90, sweep, false, glow);
      c.drawArc(r, -90, sweep, false, fg);
    }

    Paint text = new Paint(Paint.ANTI_ALIAS_FLAG);
    text.setColor(0xFF5EEAD4);
    text.setTextAlign(Paint.Align.CENTER);
    text.setTypeface(Typeface.MONOSPACE);
    text.setFakeBoldText(true);
    String label = centerLabel != null ? centerLabel : (Math.round(pct) + "%");
    text.setTextSize(size * (label.length() > 3 ? 0.16f : 0.22f));
    Paint.FontMetrics fm = text.getFontMetrics();
    c.drawText(label, size / 2f, size / 2f - (fm.ascent + fm.descent) / 2f, text);
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
    trackPaint.setColor(0x28FFFFFF);
    c.drawRoundRect(track, radius, radius, trackPaint);

    Paint tick = new Paint(Paint.ANTI_ALIAS_FLAG);
    tick.setColor(0x35FFFFFF);
    tick.setStrokeWidth(1f);
    for (int i = 1; i < 4; i++) {
      float x = w * (i / 4f);
      c.drawLine(x, h * 0.2f, x, h * 0.8f, tick);
    }

    float fillW = w * (Math.max(0, Math.min(100, pct)) / 100f);
    if (fillW > 1f) {
      RectF fill = new RectF(0, 0, fillW, h);
      Paint fillPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
      int start;
      int end;
      int glowColor;
      if (overdue) {
        start = 0xFFF87171;
        end = 0xFFDC2626;
        glowColor = 0x66F87171;
      } else if (urgent) {
        start = 0xFFFCD34D;
        end = 0xFFD97706;
        glowColor = 0x66FBBF24;
      } else {
        start = 0xFF5EEAD4;
        end = 0xFF0F766E;
        glowColor = 0x662DD4BF;
      }
      fillPaint.setShader(new LinearGradient(0, 0, fillW, 0, start, end, Shader.TileMode.CLAMP));
      c.drawRoundRect(fill, radius, radius, fillPaint);

      Paint edgeGlow = new Paint(Paint.ANTI_ALIAS_FLAG);
      edgeGlow.setColor(glowColor);
      c.drawRect(Math.max(0, fillW - 6f), 0, fillW, h, edgeGlow);
    }
    return b;
  }

  public static Bitmap drawIncomeBars(int width, int height, WidgetCache.IncomeVsSpend v) {
    int w = Math.max(1, width);
    int h = Math.max(1, height);
    Bitmap b = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
    Canvas c = new Canvas(b);

    Paint baseline = new Paint(Paint.ANTI_ALIAS_FLAG);
    baseline.setColor(0x25FFFFFF);
    baseline.setStrokeWidth(1f);
    c.drawLine(0, h - 1, w, h - 1, baseline);

    Paint track = new Paint(Paint.ANTI_ALIAS_FLAG);
    track.setColor(0x30FFFFFF);
    Paint incomeOwner = new Paint(Paint.ANTI_ALIAS_FLAG);
    incomeOwner.setShader(new LinearGradient(0, 0, w, 0, 0x885EEAD4, 0x4414B8A6, Shader.TileMode.CLAMP));
    Paint spentOwner = new Paint(Paint.ANTI_ALIAS_FLAG);
    spentOwner.setShader(new LinearGradient(0, 0, w, 0, 0xCC0F766E, 0x99115559, Shader.TileMode.CLAMP));
    Paint incomePartner = new Paint(Paint.ANTI_ALIAS_FLAG);
    incomePartner.setShader(new LinearGradient(0, 0, w, 0, 0x8822D3EE, 0x440EA5E9, Shader.TileMode.CLAMP));
    Paint spentPartner = new Paint(Paint.ANTI_ALIAS_FLAG);
    spentPartner.setShader(new LinearGradient(0, 0, w, 0, 0xCC0C4A6E, 0x991E3A8A, Shader.TileMode.CLAMP));
    Paint over = new Paint(Paint.ANTI_ALIAS_FLAG);
    over.setColor(0xFFEF4444);

    float pad = 2f;
    float gap = 10f;
    float barH = (height - gap - pad * 2) / 2f;
    float radius = Math.min(12f, barH / 2f);

    RectF r1 = new RectF(pad, pad, w - pad, pad + barH);
    RectF r2 = new RectF(pad, pad + barH + gap, w - pad, pad + barH + gap + barH);

    c.drawRoundRect(r1, radius, radius, track);
    c.drawRoundRect(r2, radius, radius, track);

    double ownerIncome = Math.max(0, v.primaryIncome + v.primaryCarryIn);
    double partnerIncome = Math.max(0, v.partnerIncome + v.partnerCarryIn);
    double ownerSpentWithinIncome = Math.max(0, Math.min(ownerIncome, ownerIncome - Math.max(0, v.primaryLeft)));
    double partnerSpentWithinIncome = Math.max(0, Math.min(partnerIncome, partnerIncome - Math.max(0, v.partnerLeft)));

    float ownerIncomePct = ownerIncome <= 0 ? 0f : 1f;
    float partnerIncomePct = partnerIncome <= 0 ? 0f : 1f;
    float ownerSpentPct = ownerIncome <= 0 ? 0f : (float) (ownerSpentWithinIncome / ownerIncome);
    float partnerSpentPct = partnerIncome <= 0 ? 0f : (float) (partnerSpentWithinIncome / partnerIncome);

    float r1w = r1.width();
    float r2w = r2.width();

    RectF ownerIncomeRect = new RectF(r1.left, r1.top, r1.left + r1w * ownerIncomePct, r1.bottom);
    c.drawRoundRect(ownerIncomeRect, radius, radius, incomeOwner);
    RectF ownerSpentRect = new RectF(r1.left, r1.top, r1.left + r1w * ownerSpentPct, r1.bottom);
    c.drawRoundRect(ownerSpentRect, radius, radius, spentOwner);
    if (ownerSpentPct > 0.05f) {
      c.drawRect(ownerSpentRect.right - radius, r1.top, ownerSpentRect.right, r1.bottom, spentOwner);
    }

    RectF partnerIncomeRect = new RectF(r2.left, r2.top, r2.left + r2w * partnerIncomePct, r2.bottom);
    c.drawRoundRect(partnerIncomeRect, radius, radius, incomePartner);
    RectF partnerSpentRect = new RectF(r2.left, r2.top, r2.left + r2w * partnerSpentPct, r2.bottom);
    c.drawRoundRect(partnerSpentRect, radius, radius, spentPartner);
    if (partnerSpentPct > 0.05f) {
      c.drawRect(partnerSpentRect.right - radius, r2.top, partnerSpentRect.right, r2.bottom, spentPartner);
    }

    if (v.primaryOver > 0) {
      RectF overRect =
          new RectF(
              ownerIncomeRect.right,
              r1.top,
              Math.min(r1.right, ownerIncomeRect.right + Math.min(22f, r1w * 0.2f)),
              r1.bottom);
      c.drawRoundRect(overRect, radius, radius, over);
    }
    if (v.partnerOver > 0) {
      RectF overRect =
          new RectF(
              partnerIncomeRect.right,
              r2.top,
              Math.min(r2.right, partnerIncomeRect.right + Math.min(22f, r2w * 0.2f)),
              r2.bottom);
      c.drawRoundRect(overRect, radius, radius, over);
    }

    Paint label = new Paint(Paint.ANTI_ALIAS_FLAG);
    label.setColor(0x99FFFFFF);
    label.setTextSize(Math.max(8f, barH * 0.45f));
    label.setTypeface(Typeface.MONOSPACE);
    c.drawText("PRI", r1.left + 4f, r1.top + barH * 0.62f, label);
    c.drawText("PTN", r2.left + 4f, r2.top + barH * 0.62f, label);

    return b;
  }

  public static Bitmap drawPayFab(int size) {
    int s = Math.max(48, size);
    Bitmap b = Bitmap.createBitmap(s, s, Bitmap.Config.ARGB_8888);
    Canvas c = new Canvas(b);
    float cx = s / 2f;
    float cy = s / 2f;
    float outer = s * 0.48f;

    Paint halo = new Paint(Paint.ANTI_ALIAS_FLAG);
    halo.setColor(0x442DD4BF);
    c.drawCircle(cx, cy, outer + 6f, halo);

    Paint ring = new Paint(Paint.ANTI_ALIAS_FLAG);
    ring.setStyle(Paint.Style.STROKE);
    ring.setStrokeWidth(2f);
    ring.setColor(0x885EEAD4);
    c.drawCircle(cx, cy, outer, ring);

    Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG);
    fill.setShader(
        new LinearGradient(0, 0, s, s, 0xFF2DD4BF, 0xFF0D9488, Shader.TileMode.CLAMP));
    c.drawCircle(cx, cy, outer - 2f, fill);

    Paint plus = new Paint(Paint.ANTI_ALIAS_FLAG);
    plus.setColor(0xFFFFFFFF);
    plus.setStrokeWidth(Math.max(3f, s * 0.07f));
    plus.setStrokeCap(Paint.Cap.ROUND);
    float arm = s * 0.18f;
    c.drawLine(cx - arm, cy, cx + arm, cy, plus);
    c.drawLine(cx, cy - arm, cx, cy + arm, plus);
    return b;
  }
}
