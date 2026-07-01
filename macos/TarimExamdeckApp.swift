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

final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate, WKUIDelegate, WKNavigationDelegate, WKScriptMessageHandler {
    private var window: NSWindow!
    private var webView: WKWebView!
    private var schemeHandler: AppSchemeHandler!
    private var nativeSaveSessions: [String: NativeSaveSession] = [:]
    private var closeConfirmationPassed = false
    private var pendingCloseRequestId: String?
    private var pendingTerminateRequest = false

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        NSApp.mainMenu = buildMenu()

        guard let distURL = Bundle.main.resourceURL?.appendingPathComponent("dist", isDirectory: true) else {
            fatalError("未找到桌面版资源目录 dist")
        }

        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.userContentController.add(self, name: "examdeckNativeSaveFile")
        configuration.userContentController.add(self, name: "examdeckNativeClose")
        configuration.userContentController.add(self, name: "examdeckQuestionBankSync")
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
        window.delegate = self
        window.contentView = webView
        window.makeKeyAndOrderFront(nil)

        NSApp.activate(ignoringOtherApps: true)
        webView.load(URLRequest(url: URL(string: "examdeck://app/index.html")!))
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }

    func windowShouldClose(_ sender: NSWindow) -> Bool {
        if closeConfirmationPassed {
            return true
        }
        requestCloseConfirmation(terminateApp: false)
        return false
    }

    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        if closeConfirmationPassed {
            return .terminateNow
        }
        requestCloseConfirmation(terminateApp: true)
        return .terminateLater
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
        if message.name == "examdeckQuestionBankSync" {
            handleQuestionBankSyncMessage(message.body)
            return
        }
        if message.name == "examdeckNativeClose" {
            handleNativeCloseMessage(message.body)
            return
        }
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

    private func handleQuestionBankSyncMessage(_ body: Any) {
        guard let payload = body as? [String: Any],
              let request = payload["request"] as? [String: Any],
              let requestId = request["id"] as? String,
              let question = request["question"] as? [String: Any] else {
            return
        }

        do {
            let path = try updateCanonicalQuestionBank(question: question)
            sendQuestionBankSyncResult(id: requestId, ok: true, message: nil, path: path)
        } catch {
            sendQuestionBankSyncResult(id: requestId, ok: false, message: error.localizedDescription, path: nil)
        }
    }

    private func updateCanonicalQuestionBank(question: [String: Any]) throws -> String {
        guard let questionId = question["id"] as? String else {
            throw NSError(domain: "TarimExamdeck", code: 422, userInfo: [NSLocalizedDescriptionKey: "题目缺少 ID"])
        }
        for url in canonicalQuestionBankURLs() where FileManager.default.fileExists(atPath: url.path) {
            let fileData = try Data(contentsOf: url)
            guard var root = try JSONSerialization.jsonObject(with: fileData) as? [String: Any] else {
                continue
            }
            var dataNode = (root["data"] as? [String: Any]) ?? root
            guard var questions = dataNode["questions"] as? [[String: Any]],
                  let index = questions.firstIndex(where: { ($0["id"] as? String) == questionId }) else {
                continue
            }
            questions[index] = question
            dataNode["questions"] = questions
            if root["data"] != nil {
                root["data"] = dataNode
            } else {
                root = dataNode
            }
            let output = try JSONSerialization.data(withJSONObject: root, options: [.prettyPrinted])
            try output.write(to: url, options: .atomic)
            return url.path
        }
        throw NSError(domain: "TarimExamdeck", code: 404, userInfo: [NSLocalizedDescriptionKey: "未找到可写入的内置题库源文件"])
    }

    private func canonicalQuestionBankURLs() -> [URL] {
        var urls: [URL] = []
        if let path = ProcessInfo.processInfo.environment["EXAMDECK_CANONICAL_BANK_PATH"], !path.isEmpty {
            urls.append(URL(fileURLWithPath: path))
        }
        urls.append(URL(fileURLWithPath: "/Users/xuepengzhang/Documents/国赛测试/examdeck/public/bootstrap/progress.json"))
        return urls
    }

    private func sendQuestionBankSyncResult(id: String, ok: Bool, message: String?, path: String?) {
        var detail: [String: Any] = ["id": id, "ok": ok]
        if let message { detail["message"] = message }
        if let path { detail["path"] = path }
        guard let data = try? JSONSerialization.data(withJSONObject: detail),
              let json = String(data: data, encoding: .utf8) else {
            return
        }
        webView.evaluateJavaScript("window.dispatchEvent(new CustomEvent('examdeck-question-bank-sync-result', { detail: \(json) }))")
    }

    private func requestCloseConfirmation(terminateApp: Bool) {
        if pendingCloseRequestId != nil {
            return
        }
        let requestId = UUID().uuidString
        pendingCloseRequestId = requestId
        pendingTerminateRequest = terminateApp
        webView.evaluateJavaScript("window.dispatchEvent(new CustomEvent('examdeck-native-close-request', { detail: { id: '\(requestId)' } }))") { [weak self] _, error in
            guard error != nil else { return }
            self?.flushAndCloseAfterFailedRequest(requestId: requestId)
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 7) { [weak self] in
            self?.flushAndCloseAfterFailedRequest(requestId: requestId)
        }
    }

    private func handleNativeCloseMessage(_ body: Any) {
        guard let payload = body as? [String: Any],
              let request = payload["request"] as? [String: Any],
              let requestId = request["id"] as? String,
              requestId == pendingCloseRequestId else {
            return
        }
        let allowClose = request["allowClose"] as? Bool ?? false
        completeCloseRequest(allowClose: allowClose)
    }

    private func flushAndCloseAfterFailedRequest(requestId: String) {
        guard pendingCloseRequestId == requestId else {
            return
        }
        webView.evaluateJavaScript("window.examdeckFlushData ? window.examdeckFlushData() : null") { [weak self] _, _ in
            self?.completeCloseRequest(allowClose: true)
        }
    }

    private func completeCloseRequest(allowClose: Bool) {
        let shouldTerminate = pendingTerminateRequest
        pendingCloseRequestId = nil
        pendingTerminateRequest = false
        if !allowClose {
            if shouldTerminate {
                NSApp.reply(toApplicationShouldTerminate: false)
            }
            return
        }
        closeConfirmationPassed = true
        if shouldTerminate {
            NSApp.reply(toApplicationShouldTerminate: true)
        } else {
            window.performClose(nil)
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
