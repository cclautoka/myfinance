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
        WidgetHudContainer(accent: .cyan, live: true) {
            VStack(spacing: 8) {
                WidgetHeader(accent: .cyan, title: "LOG DEPOSIT", live: true)
                ZStack {
                    Circle()
                        .fill(Color.teal.opacity(0.25))
                        .frame(width: 58, height: 58)
                        .blur(radius: 6)
                    Circle()
                        .stroke(Color(red: 0.36, green: 0.92, blue: 0.82).opacity(0.55), lineWidth: 2)
                        .frame(width: 52, height: 52)
                    Circle()
                        .fill(
                            LinearGradient(
                                colors: [Color(red: 0.18, green: 0.83, blue: 0.75), Color(red: 0.05, green: 0.58, blue: 0.53)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 48, height: 48)
                    Image(systemName: "plus")
                        .font(.system(size: 22, weight: .bold))
                        .foregroundStyle(.white)
                }
                Text("Tap to open paycheque log")
                    .font(.system(size: 10, design: .monospaced))
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .widgetURL(URL(string: "https://localhost/#widget=paylog"))
        .containerBackground(for: .widget) {
            WidgetHudBackground(accent: .cyan)
        }
    }
}

struct PayLogWidget: Widget {
    let kind = "OurFinancePayLogWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: PayLogProvider()) { entry in
            PayLogWidgetView(entry: entry)
        }
        .configurationDisplayName("Pay logging")
        .description("Quick neon shortcut to log a deposit.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular])
    }
}
