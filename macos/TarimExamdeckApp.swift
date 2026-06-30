import Cocoa
import UniformTypeIdentifiers
import WebKit

final class AppSchemeHandler: NSObject, WKURLSchemeHandler {
    private let rootURL: URL

    init(rootURL: URL) {
        self.rootURL = rootURL
        super.init()
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let requestURL = urlSchemeTask.request.url else {
            urlSchemeTask.didFailWithError(NSError(domain: "TarimExamdeck", code: 400))
            return
        }

        let requestPath = requestURL.path == "/" ? "/index.html" : requestURL.path
        let relativePath = requestPath.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let fileURL = rootURL.appendingPathComponent(relativePath)

        do {
            let data = try Data(contentsOf: fileURL)
            let response = URLResponse(
                url: requestURL,
                mimeType: mimeType(for: fileURL.pathExtension),
                expectedContentLength: data.count,
                textEncodingName: nil
            )
            urlSchemeTask.didReceive(response)
            urlSchemeTask.didReceive(data)
            urlSchemeTask.didFinish()
        } catch {
            urlSchemeTask.didFailWithError(error)
        }
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}

    private func mimeType(for fileExtension: String) -> String {
        switch fileExtension.lowercased() {
        case "html": return "text/html"
        case "js", "mjs": return "text/javascript"
        case "css": return "text/css"
        case "json": return "application/json"
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "svg": return "image/svg+xml"
        case "xlsx": return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        case "zip": return "application/zip"
        case "woff": return "font/woff"
        case "woff2": return "font/woff2"
        case "ttf": return "font/ttf"
        default: return "application/octet-stream"
        }
    }
}

private struct NativeSaveSession {
    let fileName: String
    let mimeType: String
    let totalChunks: Int
    var chunks: [Int: Data] = [:]
}

final class AppDelegate: NSObject, NSApplicationDelegate, WKUIDelegate, WKNavigationDelegate, WKScriptMessageHandler {
    private var window: NSWindow!
    private var webView: WKWebView!
    private var schemeHandler: AppSchemeHandler!
    private var nativeSaveSessions: [String: NativeSaveSession] = [:]

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        NSApp.mainMenu = buildMenu()

        guard let distURL = Bundle.main.resourceURL?.appendingPathComponent("dist", isDirectory: true) else {
            fatalError("未找到桌面版资源目录 dist")
        }

        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.userContentController.add(self, name: "examdeckNativeSaveFile")
        schemeHandler = AppSchemeHandler(rootURL: distURL)
        configuration.setURLSchemeHandler(schemeHandler, forURLScheme: "examdeck")

        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.uiDelegate = self
        webView.navigationDelegate = self
        webView.allowsBackForwardNavigationGestures = true

        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1440, height: 920),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.center()
        window.title = "塔里木刷题王"
        window.minSize = NSSize(width: 1100, height: 720)
        window.contentView = webView
        window.makeKeyAndOrderFront(nil)

        NSApp.activate(ignoringOtherApps: true)
        webView.load(URLRequest(url: URL(string: "examdeck://app/index.html")!))
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if let url = navigationAction.request.url,
           let scheme = url.scheme,
           scheme != "examdeck",
           scheme != "about",
           navigationAction.navigationType == .linkActivated {
            NSWorkspace.shared.open(url)
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.canChooseDirectories = parameters.allowsDirectories
        panel.canChooseFiles = true
        panel.begin { result in
            completionHandler(result == .OK ? panel.urls : nil)
        }
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = NSAlert()
        alert.messageText = "塔里木刷题王"
        alert.informativeText = message
        alert.alertStyle = .informational
        alert.addButton(withTitle: "确定")
        alert.beginSheetModal(for: window) { _ in
            completionHandler()
        }
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = NSAlert()
        alert.messageText = "请确认"
        alert.informativeText = message
        alert.alertStyle = .warning
        alert.addButton(withTitle: "继续")
        alert.addButton(withTitle: "取消")
        alert.beginSheetModal(for: window) { response in
            completionHandler(response == .alertFirstButtonReturn)
        }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "examdeckNativeSaveFile",
              let body = message.body as? [String: Any],
              let type = body["type"] as? String,
              let request = body["request"] as? [String: Any],
              let id = request["id"] as? String else {
            return
        }

        switch type {
        case "start":
            let fileName = request["fileName"] as? String ?? "导出文件"
            let mimeType = request["mimeType"] as? String ?? "application/octet-stream"
            let totalChunks = max(1, request["totalChunks"] as? Int ?? 1)
            nativeSaveSessions[id] = NativeSaveSession(fileName: fileName, mimeType: mimeType, totalChunks: totalChunks)
        case "chunk":
            guard var session = nativeSaveSessions[id],
                  let chunkIndex = request["chunkIndex"] as? Int,
                  let base64 = request["base64"] as? String,
                  let data = Data(base64Encoded: base64) else {
                sendNativeSaveResult(id: id, status: "error", message: "导出数据接收失败")
                nativeSaveSessions[id] = nil
                return
            }
            session.chunks[chunkIndex] = data
            nativeSaveSessions[id] = session
        case "finish":
            guard let session = nativeSaveSessions[id] else {
                sendNativeSaveResult(id: id, status: "error", message: "导出会话不存在")
                return
            }
            guard session.chunks.count == session.totalChunks else {
                sendNativeSaveResult(id: id, status: "error", message: "导出数据不完整")
                nativeSaveSessions[id] = nil
                return
            }

            var fileData = Data()
            for index in 0..<session.totalChunks {
                guard let chunk = session.chunks[index] else {
                    sendNativeSaveResult(id: id, status: "error", message: "导出数据缺少分片")
                    nativeSaveSessions[id] = nil
                    return
                }
                fileData.append(chunk)
            }
            nativeSaveSessions[id] = nil
            showSavePanel(id: id, fileName: session.fileName, data: fileData)
        default:
            break
        }
    }

    private func showSavePanel(id: String, fileName: String, data: Data) {
        let panel = NSSavePanel()
        panel.nameFieldStringValue = fileName
        panel.canCreateDirectories = true
        panel.isExtensionHidden = false
        if let fileExtension = fileName.split(separator: ".").last.map(String.init), fileExtension != fileName {
            panel.allowedContentTypes = [UTType(filenameExtension: fileExtension) ?? .data]
        }

        panel.beginSheetModal(for: window) { [weak self] result in
            guard let self else { return }
            if result != .OK {
                self.sendNativeSaveResult(id: id, status: "cancelled", message: nil)
                return
            }
            guard let url = panel.url else {
                self.sendNativeSaveResult(id: id, status: "error", message: "未选择保存路径")
                return
            }

            do {
                try data.write(to: url, options: .atomic)
                self.sendNativeSaveResult(id: id, status: "saved", message: nil)
            } catch {
                self.sendNativeSaveResult(id: id, status: "error", message: error.localizedDescription)
            }
        }
    }

    private func sendNativeSaveResult(id: String, status: String, message: String?) {
        var detail: [String: Any] = ["id": id, "status": status]
        if let message {
            detail["message"] = message
        }

        guard let detailData = try? JSONSerialization.data(withJSONObject: detail),
              let detailJSON = String(data: detailData, encoding: .utf8) else {
            return
        }

        webView.evaluateJavaScript("window.dispatchEvent(new CustomEvent('examdeck-save-file-result', { detail: \(detailJSON) }))")
    }

    private func buildMenu() -> NSMenu {
        let mainMenu = NSMenu()

        let appMenuItem = NSMenuItem()
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "退出塔里木刷题王", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appMenuItem.submenu = appMenu
        mainMenu.addItem(appMenuItem)

        let editMenuItem = NSMenuItem()
        let editMenu = NSMenu(title: "编辑")
        editMenu.addItem(withTitle: "撤销", action: Selector(("undo:")), keyEquivalent: "z")
        editMenu.addItem(withTitle: "重做", action: Selector(("redo:")), keyEquivalent: "Z")
        editMenu.addItem(NSMenuItem.separator())
        editMenu.addItem(withTitle: "剪切", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "复制", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "粘贴", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: "全选", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        editMenuItem.submenu = editMenu
        mainMenu.addItem(editMenuItem)

        return mainMenu
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
