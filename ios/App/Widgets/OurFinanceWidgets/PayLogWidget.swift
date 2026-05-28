import WidgetKit
import SwiftUI

struct PayLogEntry: TimelineEntry {
    let date: Date
}

struct PayLogProvider: TimelineProvider {
    func placeholder(in context: Context) -> PayLogEntry { PayLogEntry(date: Date()) }
    func getSnapshot(in context: Context, completion: @escaping (PayLogEntry) -> Void) { completion(PayLogEntry(date: Date())) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<PayLogEntry>) -> Void) {
        completion(Timeline(entries: [PayLogEntry(date: Date())], policy: .never))
    }
}

struct PayLogWidgetView: View {
    var entry: PayLogProvider.Entry
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Pay logging").font(.caption).fontWeight(.semibold)
            Text("Tap to log a deposit").font(.headline)
        }
        .widgetURL(URL(string: "https://localhost/#widget=paylog"))
        .containerBackground(.fill.tertiary, for: .widget)
    }
}

struct PayLogWidget: Widget {
    let kind = "OurFinancePayLogWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: PayLogProvider()) { entry in
            PayLogWidgetView(entry: entry)
        }
        .configurationDisplayName("Pay logging")
        .description("Quick shortcut to the paycheque log.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular])
    }
}

