import Foundation
import Capacitor

/**
 * Register local Capacitor plugins that are not shipped as npm packages.
 * This keeps the web app code identical across iOS/Android while allowing native widget bridges.
 */
class WidgetBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        // Widget cache writer + refresh trigger for WidgetKit.
        self.bridge?.registerPluginInstance(WidgetBridgePlugin())
    }
}

