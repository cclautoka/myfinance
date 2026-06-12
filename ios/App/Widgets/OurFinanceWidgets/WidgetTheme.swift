import SwiftUI
import WidgetKit

enum WidgetAccent {
    case teal
    case amber
    case violet
    case cyan

    var color: Color {
        switch self {
        case .teal: return Color(red: 0.36, green: 0.92, blue: 0.82)
        case .amber: return Color(red: 0.98, green: 0.75, blue: 0.14)
        case .violet: return Color(red: 0.77, green: 0.71, blue: 0.99)
        case .cyan: return Color(red: 0.13, green: 0.83, blue: 0.93)
        }
    }

    var moduleLabel: String {
        switch self {
        case .teal: return "CASHFLOW"
        case .amber: return "BILLS"
        case .violet: return "GOALS"
        case .cyan: return "PAYLOG"
        }
    }
}

struct WidgetHudBackground: View {
    let accent: WidgetAccent

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color(red: 0.02, green: 0.03, blue: 0.05),
                    Color(red: 0.04, green: 0.07, blue: 0.12),
                    Color(red: 0.05, green: 0.24, blue: 0.22),
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            WidgetGridPattern().opacity(0.18)
            VStack {
                Rectangle()
                    .fill(accent.color.opacity(0.55))
                    .frame(height: 3)
                Spacer()
            }
            WidgetCornerBrackets(accent: accent.color)
        }
    }
}

struct WidgetGridPattern: View {
    var body: some View {
        Canvas { context, size in
            let step: CGFloat = max(14, min(size.width, size.height) / 8)
            var path = Path()
            var x: CGFloat = step
            while x < size.width {
                path.move(to: CGPoint(x: x, y: 0))
                path.addLine(to: CGPoint(x: x, y: size.height))
                x += step
            }
            var y: CGFloat = step
            while y < size.height {
                path.move(to: CGPoint(x: 0, y: y))
                path.addLine(to: CGPoint(x: size.width, y: y))
                y += step
            }
            context.stroke(path, with: .color(.white.opacity(0.08)), lineWidth: 0.5)
        }
    }
}

struct WidgetCornerBrackets: View {
    let accent: Color

    var body: some View {
        GeometryReader { geo in
            let len = min(16, geo.size.width * 0.08)
            let pad: CGFloat = 8
            Path { p in
                p.move(to: CGPoint(x: pad, y: pad + len))
                p.addLine(to: CGPoint(x: pad, y: pad))
                p.addLine(to: CGPoint(x: pad + len, y: pad))
                p.move(to: CGPoint(x: geo.size.width - pad - len, y: pad))
                p.addLine(to: CGPoint(x: geo.size.width - pad, y: pad))
                p.addLine(to: CGPoint(x: geo.size.width - pad, y: pad + len))
            }
            .stroke(accent.opacity(0.85), lineWidth: 1.5)
        }
    }
}

struct WidgetHeader: View {
    let accent: WidgetAccent
    let title: String
    let live: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                Text("◈ FINANCE / \(accent.moduleLabel)")
                    .font(.system(size: 9, weight: .bold, design: .monospaced))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                Spacer(minLength: 0)
                if live {
                    Circle()
                        .fill(Color.green.opacity(0.9))
                        .frame(width: 7, height: 7)
                        .shadow(color: .green.opacity(0.6), radius: 3)
                }
            }
            Text(title)
                .font(.system(size: 10, weight: .bold, design: .monospaced))
                .foregroundStyle(accent.color)
        }
    }
}

struct TechProgressBar: View {
    let progress: Double
    let urgent: Bool
    let overdue: Bool

    var body: some View {
        GeometryReader { geo in
            let pct = min(max(progress, 0), 1)
            ZStack(alignment: .leading) {
                Capsule().fill(Color.white.opacity(0.12))
                Capsule()
                    .fill(
                        LinearGradient(
                            colors: barColors,
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .frame(width: max(geo.size.width * pct, pct > 0 ? 6 : 0))
                    .shadow(color: barColors.first?.opacity(0.45) ?? .clear, radius: 4, x: 2)
            }
        }
        .frame(height: 8)
    }

    private var barColors: [Color] {
        if overdue { return [Color(red: 0.97, green: 0.44, blue: 0.44), Color(red: 0.86, green: 0.15, blue: 0.15)] }
        if urgent { return [Color(red: 0.99, green: 0.83, blue: 0.30), Color(red: 0.85, green: 0.47, blue: 0.02)] }
        return [Color(red: 0.36, green: 0.92, blue: 0.82), Color(red: 0.06, green: 0.46, blue: 0.43)]
    }
}

struct TechGoalRing: View {
    let progress: Double

    var body: some View {
        ZStack {
            Circle()
                .stroke(Color.white.opacity(0.15), lineWidth: 5)
            Circle()
                .trim(from: 0, to: min(max(progress / 100, 0), 1))
                .stroke(
                    AngularGradient(
                        colors: [Color(red: 0.36, green: 0.92, blue: 0.82), Color(red: 0.08, green: 0.72, blue: 0.65), Color(red: 0.06, green: 0.73, blue: 0.51)],
                        center: .center
                    ),
                    style: StrokeStyle(lineWidth: 5, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))
                .shadow(color: Color.teal.opacity(0.35), radius: 4)
            Text("\(Int(progress))%")
                .font(.system(size: 11, weight: .bold, design: .monospaced))
                .foregroundStyle(Color(red: 0.36, green: 0.92, blue: 0.82))
        }
        .frame(width: 44, height: 44)
    }
}

struct IncomeBarChart: View {
    let v: WidgetIncomeVsSpend

    var body: some View {
        VStack(spacing: 8) {
            incomeRow(label: "PRI", income: v.primaryIncome + v.primaryCarryIn, left: v.primaryLeft, over: v.primaryOver, tint: Color(red: 0.36, green: 0.92, blue: 0.82))
            incomeRow(label: "PTN", income: v.partnerIncome + v.partnerCarryIn, left: v.partnerLeft, over: v.partnerOver, tint: Color(red: 0.13, green: 0.83, blue: 0.93))
        }
        .frame(height: 44)
    }

    private func incomeRow(label: String, income: Double, left: Double, over: Double, tint: Color) -> some View {
        let total = max(income, 1)
        let spent = max(0, min(total, total - max(left, 0)))
        let spentPct = spent / total
        return GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(Color.white.opacity(0.10))
                Capsule().fill(tint.opacity(0.35)).frame(width: geo.size.width)
                Capsule().fill(tint.opacity(0.85)).frame(width: geo.size.width * spentPct)
                if over > 0 {
                    Capsule().fill(Color.red).frame(width: min(18, geo.size.width * 0.18))
                        .offset(x: geo.size.width * spentPct)
                }
                Text(label)
                    .font(.system(size: 8, weight: .bold, design: .monospaced))
                    .foregroundStyle(.white.opacity(0.55))
                    .padding(.leading, 4)
            }
        }
        .frame(height: 14)
    }
}

struct WidgetHudContainer<Content: View>: View {
    let accent: WidgetAccent
    let live: Bool
    @ViewBuilder let content: Content

    var body: some View {
        ZStack {
            WidgetHudBackground(accent: accent)
            content.padding(12)
        }
    }
}
