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
        WidgetHudContainer(accent: .violet, live: !goals.isEmpty) {
            VStack(alignment: .leading, spacing: 8) {
                WidgetHeader(accent: .violet, title: "RESERVE TRACKER", live: !goals.isEmpty)
                if goals.isEmpty {
                    HStack(spacing: 10) {
                        TechGoalRing(progress: 0)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("OPEN OUR FINANCE").font(.system(size: 11, weight: .bold, design: .monospaced))
                            Text("Sign in once to sync").font(.system(size: 9, design: .monospaced)).foregroundStyle(.secondary)
                        }
                    }
                } else {
                    HStack(alignment: .top, spacing: 10) {
                        ForEach(Array(goals.prefix(3).enumerated()), id: \.offset) { _, g in
                            VStack(spacing: 4) {
                                TechGoalRing(progress: g.progressPct)
                                Text(g.name.uppercased())
                                    .font(.system(size: 8, weight: .bold, design: .monospaced))
                                    .lineLimit(1)
                                Text("$\(Int(g.balance)) / $\(Int(g.target))")
                                    .font(.system(size: 8, design: .monospaced))
                                    .foregroundStyle(.secondary)
                                    .lineLimit(1)
                            }
                            .frame(maxWidth: .infinity)
                        }
                    }
                }
            }
        }
        .widgetURL(URL(string: "https://localhost/#widget=goals"))
        .containerBackground(for: .widget) {
            WidgetHudBackground(accent: .violet)
        }
    }
}

struct GoalsWidget: Widget {
    let kind = "OurFinanceGoalsWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: GoalsProvider()) { entry in
            GoalsWidgetView(entry: entry)
        }
        .configurationDisplayName("Goals progress")
        .description("Neon reserve rings with live goal progress.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryRectangular, .accessoryCircular])
    }
}
