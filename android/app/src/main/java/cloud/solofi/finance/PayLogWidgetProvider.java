package cloud.solofi.finance;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

public class PayLogWidgetProvider extends AppWidgetProvider {
  @Override
  public void onEnabled(Context context) {
    WidgetRefresh.updateAll(context.getApplicationContext());
  }

  @Override
  public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
    for (int id : appWidgetIds) {
      RemoteViews rv = new RemoteViews(context.getPackageName(), R.layout.widget_paylog);
      Intent open = new Intent(context, MainActivity.class);
      open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
      open.putExtra("route", "#widget=paylog");
      PendingIntent pi = PendingIntent.getActivity(context, id, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
      rv.setOnClickPendingIntent(R.id.widget_root, pi);
      appWidgetManager.updateAppWidget(id, rv);
    }
  }
}

