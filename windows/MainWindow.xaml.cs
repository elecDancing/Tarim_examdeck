using Microsoft.Web.WebView2.Core;
using Microsoft.Win32;
using System;
using System.ComponentModel;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows;

namespace TarimExamdeck.Windows;

public partial class MainWindow : Window
{
    private const string AppHostName = "app.examdeck.local";
    private readonly Dictionary<string, NativeSaveSession> _saveSessions = new();
    private bool _flushBeforeCloseCompleted;

    public MainWindow()
    {
        InitializeComponent();
        Loaded += async (_, _) => await InitializeBrowserAsync();
        Closing += OnClosing;
    }

    private async void OnClosing(object? sender, CancelEventArgs e)
    {
        if (_flushBeforeCloseCompleted || Browser.CoreWebView2 is null) return;
        e.Cancel = true;
        try
        {
            await Browser.CoreWebView2.ExecuteScriptAsync("window.examdeckFlushData ? window.examdeckFlushData() : null");
            await Task.Delay(350);
        }
        catch
        {
            // Closing should continue even if the page is already gone.
        }
        _flushBeforeCloseCompleted = true;
        Close();
    }

    private async Task InitializeBrowserAsync()
    {
        var distPath = ResolveDistPath();
        if (!Directory.Exists(distPath))
        {
            MessageBox.Show($"未找到桌面版资源目录：{distPath}", "塔里木刷题王", MessageBoxButton.OK, MessageBoxImage.Error);
            Close();
            return;
        }

        Browser.CreationProperties = new Microsoft.Web.WebView2.Wpf.CoreWebView2CreationProperties
        {
            UserDataFolder = App.WebViewDataDirectory
        };
        await Browser.EnsureCoreWebView2Async();
        Browser.CoreWebView2.Settings.AreDevToolsEnabled = false;
        Browser.CoreWebView2.Settings.AreDefaultContextMenusEnabled = true;
        Browser.CoreWebView2.Settings.IsStatusBarEnabled = false;
        Browser.CoreWebView2.SetVirtualHostNameToFolderMapping(
            AppHostName,
            distPath,
            CoreWebView2HostResourceAccessKind.Allow);
        Browser.CoreWebView2.WebMessageReceived += OnWebMessageReceived;
        Browser.CoreWebView2.NavigationStarting += OnNavigationStarting;
        Browser.CoreWebView2.Navigate($"https://{AppHostName}/index.html");
    }

    private static string ResolveDistPath()
    {
        var baseDir = AppContext.BaseDirectory;
        var candidates = new[]
        {
            Path.Combine(baseDir, "dist"),
            Path.GetFullPath(Path.Combine(baseDir, "..", "dist")),
            Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", "..", "dist"))
        };
        foreach (var candidate in candidates)
        {
            if (File.Exists(Path.Combine(candidate, "index.html"))) return candidate;
        }
        return candidates[0];
    }

    private void OnNavigationStarting(object? sender, CoreWebView2NavigationStartingEventArgs e)
    {
        if (!Uri.TryCreate(e.Uri, UriKind.Absolute, out var uri)) return;
        if (uri.Host.Equals(AppHostName, StringComparison.OrdinalIgnoreCase)) return;
        if (uri.Scheme.Equals("about", StringComparison.OrdinalIgnoreCase)) return;

        e.Cancel = true;
        try
        {
            Process.Start(new ProcessStartInfo(uri.ToString()) { UseShellExecute = true });
        }
        catch
        {
            // Ignore external navigation failures; the in-app content should continue running.
        }
    }

    private async void OnWebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        try
        {
            using var document = JsonDocument.Parse(e.WebMessageAsJson);
            var root = document.RootElement;
            if (!root.TryGetProperty("channel", out var channel) || channel.GetString() != "examdeckNativeSaveFile") return;
            if (!root.TryGetProperty("type", out var typeElement)) return;
            if (!root.TryGetProperty("request", out var request)) return;
            if (!request.TryGetProperty("id", out var idElement)) return;

            var id = idElement.GetString();
            var type = typeElement.GetString();
            if (string.IsNullOrWhiteSpace(id) || string.IsNullOrWhiteSpace(type)) return;

            switch (type)
            {
                case "start":
                    StartSaveSession(id, request);
                    break;
                case "chunk":
                    ReceiveSaveChunk(id, request);
                    break;
                case "finish":
                    await FinishSaveSessionAsync(id);
                    break;
            }
        }
        catch (Exception error)
        {
            MessageBox.Show(error.Message, "保存文件失败", MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private void StartSaveSession(string id, JsonElement request)
    {
        var fileName = request.TryGetProperty("fileName", out var fileNameElement)
            ? fileNameElement.GetString() ?? "导出文件"
            : "导出文件";
        var mimeType = request.TryGetProperty("mimeType", out var mimeTypeElement)
            ? mimeTypeElement.GetString() ?? "application/octet-stream"
            : "application/octet-stream";
        var totalChunks = request.TryGetProperty("totalChunks", out var totalChunksElement)
            ? Math.Max(1, totalChunksElement.GetInt32())
            : 1;

        _saveSessions[id] = new NativeSaveSession(fileName, mimeType, totalChunks);
    }

    private void ReceiveSaveChunk(string id, JsonElement request)
    {
        if (!_saveSessions.TryGetValue(id, out var session))
        {
            SendNativeSaveResult(id, "error", "导出会话不存在");
            return;
        }
        var chunkIndex = request.GetProperty("chunkIndex").GetInt32();
        var base64 = request.GetProperty("base64").GetString() ?? "";
        session.Chunks[chunkIndex] = Convert.FromBase64String(base64);
    }

    private async Task FinishSaveSessionAsync(string id)
    {
        if (!_saveSessions.TryGetValue(id, out var session))
        {
            SendNativeSaveResult(id, "error", "导出会话不存在");
            return;
        }

        if (session.Chunks.Count != session.TotalChunks)
        {
            _saveSessions.Remove(id);
            SendNativeSaveResult(id, "error", "导出数据不完整");
            return;
        }

        using var output = new MemoryStream();
        for (var index = 0; index < session.TotalChunks; index += 1)
        {
            if (!session.Chunks.TryGetValue(index, out var chunk))
            {
                _saveSessions.Remove(id);
                SendNativeSaveResult(id, "error", "导出数据缺少分片");
                return;
            }
            await output.WriteAsync(chunk);
        }
        _saveSessions.Remove(id);

        var dialog = new SaveFileDialog
        {
            FileName = session.FileName,
            AddExtension = true,
            OverwritePrompt = true,
            Filter = BuildFilter(session.FileName)
        };
        if (dialog.ShowDialog(this) != true)
        {
            SendNativeSaveResult(id, "cancelled", null);
            return;
        }

        try
        {
            await File.WriteAllBytesAsync(dialog.FileName, output.ToArray());
            SendNativeSaveResult(id, "saved", null);
        }
        catch (Exception error)
        {
            SendNativeSaveResult(id, "error", error.Message);
        }
    }

    private static string BuildFilter(string fileName)
    {
        var extension = Path.GetExtension(fileName).TrimStart('.').ToLowerInvariant();
        return extension switch
        {
            "json" => "JSON 文件 (*.json)|*.json|所有文件 (*.*)|*.*",
            "xlsx" => "Excel 文件 (*.xlsx)|*.xlsx|所有文件 (*.*)|*.*",
            "zip" => "ZIP 文件 (*.zip)|*.zip|所有文件 (*.*)|*.*",
            _ => "所有文件 (*.*)|*.*"
        };
    }

    private void SendNativeSaveResult(string id, string status, string? message)
    {
        var detail = new Dictionary<string, string?>
        {
            ["id"] = id,
            ["status"] = status
        };
        if (!string.IsNullOrWhiteSpace(message)) detail["message"] = message;

        var json = JsonSerializer.Serialize(detail, new JsonSerializerOptions
        {
            Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
        });
        Browser.CoreWebView2?.ExecuteScriptAsync(
            $"window.dispatchEvent(new CustomEvent('examdeck-save-file-result', {{ detail: {json} }}));");
    }

    private sealed class NativeSaveSession
    {
        public NativeSaveSession(string fileName, string mimeType, int totalChunks)
        {
            FileName = fileName;
            MimeType = mimeType;
            TotalChunks = totalChunks;
        }

        public string FileName { get; }
        public string MimeType { get; }
        public int TotalChunks { get; }
        public Dictionary<int, byte[]> Chunks { get; } = new();
    }
}
