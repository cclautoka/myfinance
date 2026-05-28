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
        VStack(alignment: .leading, spacing: 6) {
            Text("Income vs spend")
                .font(.caption).fontWeight(.semibold)
            if let v = v {
                HStack {
                    VStack(alignment: .leading) {
                        Text("Primary").font(.caption2).foregroundStyle(.secondary)
                        Text("$\(Int(v.primaryLeft)) left").font(.headline)
                    }
                    Spacer()
                    VStack(alignment: .leading) {
                        Text("Partner").font(.caption2).foregroundStyle(.secondary)
                        if v.partnerOver > 0 {
                            Text("+$\(Int(v.partnerOver)) over").font(.headline).foregroundStyle(.red)
                        } else {
                            Text("$\(Int(v.partnerLeft)) left").font(.headline)
                        }
                    }
                }
            } else {
                Text("Open app to sync").font(.headline)
            }
        }
        .widgetURL(URL(string: "https://localhost/#widget=income"))
        .containerBackground(.fill.tertiary, for: .widget)
    }
}

struct IncomeSpendWidget: Widget {
    let kind = "OurFinanceIncomeSpendWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: IncomeSpendProvider()) { entry in
            IncomeSpendWidgetView(entry: entry)
        }
        .configurationDisplayName("Income vs spend")
        .description("Shows Primary/Partner left or over for this month.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryRectangular])
    }
}

