import WidgetKit
import SwiftUI

struct BillsEntry: TimelineEntry {
    let date: Date
    let cache: WidgetCacheV1?
}

struct BillsProvider: TimelineProvider {
    func placeholder(in context: Context) -> BillsEntry {
        BillsEntry(date: Date(), cache: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (BillsEntry) -> Void) {
        completion(BillsEntry(date: Date(), cache: WidgetCacheStore.readCache()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<BillsEntry>) -> Void) {
        let entry = BillsEntry(date: Date(), cache: WidgetCacheStore.readCache())
        // Best-effort: refresh periodically; push/app can also request reload.
        let next = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date().addingTimeInterval(1800)
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

struct BillsWidgetView: View {
    var entry: BillsProvider.Entry

    var body: some View {
        let cache = entry.cache
        VStack(alignment: .leading, spacing: 6) {
            Text("Bills")
                .font(.caption).fontWeight(.semibold)
            if let next = cache?.nextDue {
                Text("Next: \(next.label)")
                    .font(.headline)
                    .lineLimit(1)
                Text(next.dueDateIso.isEmpty ? "" : "Due \(next.dueDateIso) • $\(Int(next.amount))")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            } else {
                Text("Open app to sync")
                    .font(.headline)
            }
            if let overdue = cache?.overdue, !overdue.isEmpty {
                Text("Overdue: \(overdue.count)")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .widgetURL(URL(string: "https://localhost/#widget=bills"))
        .containerBackground(.fill.tertiary, for: .widget)
    }
}

struct BillsWidget: Widget {
    let kind = "OurFinanceBillsWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: BillsProvider()) { entry in
            BillsWidgetView(entry: entry)
        }
        .configurationDisplayName("Next due + overdue")
        .description("Shows the next bill due and overdue count.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryRectangular, .accessoryCircular])
    }
}

