import Foundation

struct WidgetBillItem: Codable, Hashable {
    var label: String
    var dueDateIso: String
    var amount: Double
}

struct WidgetGoalItem: Codable, Hashable {
    var id: String
    var name: String
    var progressPct: Double
    var balance: Double
    var target: Double
}

struct WidgetIncomeVsSpend: Codable, Hashable {
    var monthKey: String
    var primaryIncome: Double
    var partnerIncome: Double
    var primarySpent: Double
    var partnerSpent: Double
    var primaryLeft: Double
    var partnerLeft: Double
    var primaryOver: Double
    var partnerOver: Double
}

struct WidgetCacheV1: Codable {
    var version: Int
    var generatedAtIso: String
    var householdId: String?
    var monthKey: String
    var nextDue: WidgetBillItem?
    var overdue: [WidgetBillItem]
    var goals: [WidgetGoalItem]
    var incomeVsSpend: WidgetIncomeVsSpend
}

enum WidgetCacheStore {
    static let appGroupId = "group.cloud.solofi.finance"
    static let fileName = "widget-cache-v1.json"

    static func readCache() -> WidgetCacheV1? {
        guard let dir = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupId) else {
            return nil
        }
        let url = dir.appendingPathComponent(fileName)
        guard let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(WidgetCacheV1.self, from: data)
    }
}

