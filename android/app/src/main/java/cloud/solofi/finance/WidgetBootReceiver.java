package cloud.solofi.finance;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Refresh widgets after device reboot when cache already exists. */
public class WidgetBootReceiver extends BroadcastReceiver {
  @Override
  public void onReceive(Context context, Intent intent) {
    if (context == null || intent == null) return;
    String action = intent.getAction();
    if (Intent.ACTION_BOOT_COMPLETED.equals(action)
        || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
      WidgetRefresh.updateAll(context.getApplicationContext());
    }
  }
}
