package cloud.solofi.finance;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

public class WidgetCache {
  public static class BillItem {
    public final String label;
    public final String dueDateIso;
    public final double amount;

    public BillItem(String label, String dueDateIso, double amount) {
      this.label = label;
      this.dueDateIso = dueDateIso;
      this.amount = amount;
    }
  }

  public static class GoalItem {
    public final String name;
    public final double progressPct;
    public final double balance;
    public final double target;

    public GoalItem(String name, double progressPct, double balance, double target) {
      this.name = name;
      this.progressPct = progressPct;
      this.balance = balance;
      this.target = target;
    }
  }

  public static class IncomeVsSpend {
    public final double primaryIncome;
    public final double primaryCarryIn;
    public final double partnerIncome;
    public final double partnerCarryIn;
    public final double primaryLeft;
    public final double partnerLeft;
    public final double primaryOver;
    public final double partnerOver;

    public IncomeVsSpend(
      double pi,
      double pci,
      double pai,
      double paci,
      double pl,
      double pal,
      double pOver,
      double po
    ) {
      this.primaryIncome = pi;
      this.primaryCarryIn = pci;
      this.partnerIncome = pai;
      this.partnerCarryIn = paci;
      this.primaryLeft = pl;
      this.partnerLeft = pal;
      this.primaryOver = pOver;
      this.partnerOver = po;
    }
  }

  public final BillItem nextDue;
  public final List<BillItem> overdue;
  public final List<GoalItem> goals;
  public final IncomeVsSpend income;

  private WidgetCache(BillItem nextDue, List<BillItem> overdue, List<GoalItem> goals, IncomeVsSpend income) {
    this.nextDue = nextDue;
    this.overdue = overdue;
    this.goals = goals;
    this.income = income;
  }

  public static WidgetCache parse(String json) {
    if (json == null || json.trim().isEmpty()) return null;
    try {
      JSONObject j = new JSONObject(json);
      BillItem next = null;
      JSONObject nd = j.optJSONObject("nextDue");
      if (nd != null) next = new BillItem(nd.optString("label"), nd.optString("dueDateIso"), nd.optDouble("amount", 0));

      List<BillItem> overdue = new ArrayList<>();
      JSONArray od = j.optJSONArray("overdue");
      if (od != null) {
        for (int i = 0; i < od.length(); i++) {
          JSONObject it = od.optJSONObject(i);
          if (it == null) continue;
          overdue.add(new BillItem(it.optString("label"), it.optString("dueDateIso"), it.optDouble("amount", 0)));
        }
      }

      List<GoalItem> goals = new ArrayList<>();
      JSONArray gg = j.optJSONArray("goals");
      if (gg != null) {
        for (int i = 0; i < gg.length(); i++) {
          JSONObject it = gg.optJSONObject(i);
          if (it == null) continue;
          goals.add(
            new GoalItem(
              it.optString("name"),
              it.optDouble("progressPct", 0),
              it.optDouble("balance", 0),
              it.optDouble("target", 0)
            )
          );
        }
      }

      JSONObject ivs = j.optJSONObject("incomeVsSpend");
      IncomeVsSpend inc = new IncomeVsSpend(
        ivs != null ? ivs.optDouble("primaryIncome", 0) : 0,
        ivs != null ? ivs.optDouble("primaryCarryIn", 0) : 0,
        ivs != null ? ivs.optDouble("partnerIncome", 0) : 0,
        ivs != null ? ivs.optDouble("partnerCarryIn", 0) : 0,
        ivs != null ? ivs.optDouble("primaryLeft", 0) : 0,
        ivs != null ? ivs.optDouble("partnerLeft", 0) : 0,
        ivs != null ? ivs.optDouble("primaryOver", 0) : 0,
        ivs != null ? ivs.optDouble("partnerOver", 0) : 0
      );

      return new WidgetCache(next, overdue, goals, inc);
    } catch (JSONException e) {
      return null;
    }
  }
}

