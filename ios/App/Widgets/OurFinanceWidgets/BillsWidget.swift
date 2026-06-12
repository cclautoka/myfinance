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
        let next = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date().addingTimeInterval(1800)
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

struct BillsWidgetView: View {
    var entry: BillsProvider.Entry

    var body: some View {
        let cache = entry.cache
        WidgetHudContainer(accent: .amber, live: cache != nil) {
            VStack(alignment: .leading, spacing: 8) {
                WidgetHeader(accent: .amber, title: "NEXT DUE", live: cache != nil)
                if let next = cache?.nextDue {
                    Text(next.label)
                        .font(.system(size: 17, weight: .bold))
                        .lineLimit(1)
                    TechProgressBar(progress: dueProgress(next.dueDateIso), urgent: isUrgent(next.dueDateIso), overdue: isOverdue(next.dueDateIso))
                    Text(countdownLine(next.dueDateIso, amount: next.amount))
                        .font(.system(size: 10, weight: .medium, design: .monospaced))
                        .foregroundStyle(Color(red: 0.13, green: 0.83, blue: 0.93))
                        .lineLimit(1)
                    if let overdue = cache?.overdue, !overdue.isEmpty {
                        Text("ALERT // \(overdue.count) OVERDUE")
                            .font(.system(size: 9, weight: .bold, design: .monospaced))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(Color.red.opacity(0.25))
                            .clipShape(Capsule())
                    }
                } else {
                    Text("Open app to sync")
                        .font(.headline)
                    Text("STATUS // AWAITING DATA")
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundStyle(.secondary)
                }
            }
        }
        .widgetURL(URL(string: "https://localhost/#widget=bills"))
        .containerBackground(for: .widget) {
            WidgetHudBackground(accent: .amber)
        }
    }

    private func dueProgress(_ iso: String) -> Double {
        guard let due = ISO8601DateFormatter().date(from: iso + "T00:00:00Z") ?? parseYmd(iso) else { return 0 }
        let days = Calendar.current.dateComponents([.day], from: Calendar.current.startOfDay(for: Date()), to: Calendar.current.startOfDay(for: due)).day ?? 0
        let pct = 100 - (days * 100 / 14)
        return Double(min(max(pct, 0), 100)) / 100.0
    }

    private func isUrgent(_ iso: String) -> Bool {
        guard let due = parseYmd(iso) else { return false }
        let days = Calendar.current.dateComponents([.day], from: Calendar.current.startOfDay(for: Date()), to: Calendar.current.startOfDay(for: due)).day ?? 99
        return days >= 0 && days <= 3
    }

    private func isOverdue(_ iso: String) -> Bool {
        guard let due = parseYmd(iso) else { return false }
        return due < Calendar.current.startOfDay(for: Date())
    }

    private func countdownLine(_ iso: String, amount: Double) -> String {
        guard let due = parseYmd(iso) else { return iso + " · $\(Int(amount))" }
        let days = Calendar.current.dateComponents([.day], from: Calendar.current.startOfDay(for: Date()), to: Calendar.current.startOfDay(for: due)).day ?? 0
        let amt = Int(amount)
        if days < 0 { return "OVERDUE T+\(abs(days))D · $\(amt)" }
        if days == 0 { return "DUE TODAY · $\(amt)" }
        return "T-\(days)D · \(iso) · $\(amt)"
    }

    private func parseYmd(_ iso: String) -> Date? {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = TimeZone.current
        return f.date(from: iso)
    }
}

struct BillsWidget: Widget {
    let kind = "OurFinanceBillsWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: BillsProvider()) { entry in
            BillsWidgetView(entry: entry)
        }
        .configurationDisplayName("Next due + overdue")
        .description("HUD-style bill countdown and overdue alerts.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryRectangular, .accessoryCircular])
    }
}
