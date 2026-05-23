package cloud.solofi.finance;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  private static final String CHANNEL_BILL_REMINDERS = "bill_reminders";

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
    createNotificationChannels();
  }

  private void createNotificationChannels() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return;
    }
    NotificationChannel channel =
        new NotificationChannel(
            CHANNEL_BILL_REMINDERS,
            "Bill reminders",
            NotificationManager.IMPORTANCE_DEFAULT);
    channel.setDescription("Overdue and upcoming bill alerts from Our Finance");
    NotificationManager manager = getSystemService(NotificationManager.class);
    if (manager != null) {
      manager.createNotificationChannel(channel);
    }
  }
}
