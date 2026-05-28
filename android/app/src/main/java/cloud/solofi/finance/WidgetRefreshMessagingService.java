package cloud.solofi.finance;

import android.appwidget.AppWidgetManager;
import android.content.Intent;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

public class WidgetRefreshMessagingService extends FirebaseMessagingService {
  @Override
  public void onMessageReceived(RemoteMessage message) {
    Map<String, String> data = message.getData();
    if (data == null) return;
    String type = data.get("type");
    if (!"widgets_refresh".equals(type)) return;

    Intent i1 = new Intent(this, BillsWidgetProvider.class);
    i1.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
    sendBroadcast(i1);

    Intent i2 = new Intent(this, GoalsWidgetProvider.class);
    i2.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
    sendBroadcast(i2);

    Intent i3 = new Intent(this, IncomeSpendWidgetProvider.class);
    i3.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
    sendBroadcast(i3);

    Intent i4 = new Intent(this, PayLogWidgetProvider.class);
    i4.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
    sendBroadcast(i4);
  }
}

