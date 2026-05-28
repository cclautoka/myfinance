import WidgetKit
import SwiftUI

struct GoalsEntry: TimelineEntry {
    let date: Date
    let cache: WidgetCacheV1?
}

struct GoalsProvider: TimelineProvider {
    func placeholder(in context: Context) -> GoalsEntry {
        GoalsEntry(date: Date(), cache: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (GoalsEntry) -> Void) {
        completion(GoalsEntry(date: Date(), cache: WidgetCacheStore.readCache()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<GoalsEntry>) -> Void) {
        let entry = GoalsEntry(date: Date(), cache: WidgetCacheStore.readCache())
        let next = Calendar.current.date(byAdding: .hour, value: 1, to: Date()) ?? Date().addingTimeInterval(3600)
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

struct GoalsWidgetView: View {
    var entry: GoalsProvider.Entry

    var body: some View {
        let goals = entry.cache?.goals ?? []
        VStack(alignment: .leading, spacing: 6) {
            Text("Goals")
                .font(.caption).fontWeight(.semibold)
            if let top = goals.first {
                Text(top.name).font(.headline).lineLimit(1)
                ProgressView(value: top.progressPct / 100.0)
                Text("\(Int(top.progressPct))% • $\(Int(top.balance)) / $\(Int(top.target))")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            } else {
                Text("Set goals in app").font(.headline)
            }
        }
        .widgetURL(URL(string: "https://localhost/#widget=goals"))
        .containerBackground(.fill.tertiary, for: .widget)
    }
}

struct GoalsWidget: Widget {
    let kind = "OurFinanceGoalsWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: GoalsProvider()) { entry in
            GoalsWidgetView(entry: entry)
        }
        .configurationDisplayName("Goals progress")
        .description("Shows savings goals progress.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryRectangular, .accessoryCircular])
    }
}

