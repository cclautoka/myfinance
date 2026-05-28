import Foundation
import Capacitor
import WidgetKit

@objc(WidgetBridgePlugin)
public class WidgetBridgePlugin: CAPPlugin {
    private let appGroupId = "group.cloud.solofi.finance"
    private let fileName = "widget-cache-v1.json"

    @objc func writeCache(_ call: CAPPluginCall) {
        guard let json = call.getString("json") else {
            call.reject("json required")
            return
        }
        guard let dir = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupId) else {
            call.reject("App Group container not available")
            return
        }
        let url = dir.appendingPathComponent(fileName)
        do {
            try json.data(using: .utf8)?.write(to: url, options: [.atomic])
            call.resolve()
        } catch {
            call.reject("Failed to write cache")
        }
    }

    @objc func requestRefresh(_ call: CAPPluginCall) {
        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }
        call.resolve()
    }
}

