import WidgetKit
import SwiftUI

struct IncomeSpendEntry: TimelineEntry {
    let date: Date
    let cache: WidgetCacheV1?
}

struct IncomeSpendProvider: TimelineProvider {
    func placeholder(in context: Context) -> IncomeSpendEntry {
        IncomeSpendEntry(date: Date(), cache: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (IncomeSpendEntry) -> Void) {
        completion(IncomeSpendEntry(date: Date(), cache: WidgetCacheStore.readCache()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<IncomeSpendEntry>) -> Void) {
        let entry = IncomeSpendEntry(date: Date(), cache: WidgetCacheStore.readCache())
        let next = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date().addingTimeInterval(1800)
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

struct IncomeSpendWidgetView: View {
    var entry: IncomeSpendProvider.Entry

    var body: some View {
        let v = entry.cache?.incomeVsSpend
        WidgetHudContainer(accent: .teal, live: v != nil) {
            VStack(alignment: .leading, spacing: 8) {
                WidgetHeader(accent: .teal, title: "INCOME VS SPEND", live: v != nil)
                if let v = v {
                    HStack {
                        Text(primaryLine(v))
                            .font(.system(size: 10, weight: .bold, design: .monospaced))
                            .lineLimit(1)
                        Spacer(minLength: 4)
                        Text(partnerLine(v))
                            .font(.system(size: 10, weight: .bold, design: .monospaced))
                            .foregroundStyle(Color(red: 0.13, green: 0.83, blue: 0.93))
                            .lineLimit(1)
                    }
                    IncomeBarChart(v: v)
                } else {
                    Text("OPEN APP TO SYNC").font(.headline)
                    Text("STATUS // OFFLINE").font(.system(size: 10, design: .monospaced)).foregroundStyle(.secondary)
                }
            }
        }
        .widgetURL(URL(string: "https://localhost/#widget=income"))
        .containerBackground(for: .widget) {
            WidgetHudBackground(accent: .teal)
        }
    }

    private func primaryLine(_ v: WidgetIncomeVsSpend) -> String {
        if v.primaryOver > 0 { return "PRI OVER +$\(Int(v.primaryOver))" }
        return "PRI $\(Int(v.primaryLeft)) LEFT"
    }

    private func partnerLine(_ v: WidgetIncomeVsSpend) -> String {
        if v.partnerOver > 0 { return "PTN OVER +$\(Int(v.partnerOver))" }
        return "PTN $\(Int(v.partnerLeft)) LEFT"
    }
}

struct IncomeSpendWidget: Widget {
    let kind = "OurFinanceIncomeSpendWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: IncomeSpendProvider()) { entry in
            IncomeSpendWidgetView(entry: entry)
        }
        .configurationDisplayName("Income vs spend")
        .description("Dual-bar cashflow HUD for Primary and Partner.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryRectangular])
    }
}
