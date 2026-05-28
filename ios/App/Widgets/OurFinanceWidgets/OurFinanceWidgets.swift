import WidgetKit
import SwiftUI

@main
struct OurFinanceWidgetBundle: WidgetBundle {
    var body: some Widget {
        BillsWidget()
        GoalsWidget()
        IncomeSpendWidget()
        PayLogWidget()
    }
}

