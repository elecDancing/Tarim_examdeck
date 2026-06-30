using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using System.Text;

const int Port = 17830;
var distPath = Path.Combine(AppContext.BaseDirectory, "dist");
var dataPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "TarimExamdeck");
Directory.CreateDirectory(dataPath);

var listener = new TcpListener(IPAddress.Loopback, Port);
try
{
    listener.Start();
}
catch (SocketException)
{
    LaunchApp(Port, dataPath);
    return;
}

using var cts = new CancellationTokenSource();
var serverTask = RunServerAsync(listener, distPath, cts.Token);
var process = LaunchApp(Port, dataPath);
if (process is not null)
{
    await process.WaitForExitAsync();
}
else
{
    await Task.Delay(Timeout.InfiniteTimeSpan, cts.Token).ContinueWith(_ => { });
}

cts.Cancel();
listener.Stop();
await serverTask.ContinueWith(_ => { });

static async Task RunServerAsync(TcpListener listener, string distPath, CancellationToken token)
{
    while (!token.IsCancellationRequested)
    {
        TcpClient client;
        try
        {
            client = await listener.AcceptTcpClientAsync(token);
        }
        catch
        {
            break;
        }
        _ = Task.Run(() => ServeClientAsync(client, distPath, token), token);
    }
}

static async Task ServeClientAsync(TcpClient client, string distPath, CancellationToken token)
{
    using (client)
    {
        using var stream = client.GetStream();
        using var reader = new StreamReader(stream, Encoding.ASCII, leaveOpen: true);
        var requestLine = await reader.ReadLineAsync(token).ConfigureAwait(false);
        if (string.IsNullOrWhiteSpace(requestLine))
        {
            return;
        }

        var parts = requestLine.Split(' ');
        var method = parts.ElementAtOrDefault(0) ?? "GET";
        var rawPath = parts.ElementAtOrDefault(1) ?? "/";
        while (!string.IsNullOrEmpty(await reader.ReadLineAsync(token).ConfigureAwait(false)))
        {
        }

        var pathOnly = rawPath.Split('?', '#')[0];
        var relative = Uri.UnescapeDataString(pathOnly.TrimStart('/')).Replace('/', Path.DirectorySeparatorChar);
        if (string.IsNullOrWhiteSpace(relative))
        {
            relative = "index.html";
        }
        if (relative.Contains(".."))
        {
            await WriteResponseAsync(stream, "403 Forbidden", "text/plain; charset=utf-8", Encoding.UTF8.GetBytes("Forbidden"), method, token);
            return;
        }

        var filePath = Path.Combine(distPath, relative);
        if (!File.Exists(filePath))
        {
            filePath = Path.Combine(distPath, "index.html");
        }
        if (!File.Exists(filePath))
        {
            await WriteResponseAsync(stream, "404 Not Found", "text/plain; charset=utf-8", Encoding.UTF8.GetBytes("Not Found"), method, token);
            return;
        }

        var bytes = await File.ReadAllBytesAsync(filePath, token).ConfigureAwait(false);
        await WriteResponseAsync(stream, "200 OK", GetMimeType(filePath), bytes, method, token);
    }
}

static async Task WriteResponseAsync(Stream stream, string status, string contentType, byte[] body, string method, CancellationToken token)
{
    var headers = Encoding.ASCII.GetBytes(
        $"HTTP/1.1 {status}\r\nContent-Type: {contentType}\r\nContent-Length: {body.Length}\r\nCache-Control: no-cache\r\nConnection: close\r\n\r\n");
    await stream.WriteAsync(headers, token).ConfigureAwait(false);
    if (!method.Equals("HEAD", StringComparison.OrdinalIgnoreCase))
    {
        await stream.WriteAsync(body, token).ConfigureAwait(false);
    }
}

static Process? LaunchApp(int port, string dataPath)
{
    var url = $"http://127.0.0.1:{port}/index.html";
    var edgePath = FindEdgePath();
    try
    {
        if (edgePath is not null)
        {
            var profilePath = Path.Combine(dataPath, "EdgeApp");
            Directory.CreateDirectory(profilePath);
            var info = new ProcessStartInfo(edgePath) { UseShellExecute = false };
            info.ArgumentList.Add($"--app={url}");
            info.ArgumentList.Add($"--user-data-dir={profilePath}");
            return Process.Start(info);
        }
        Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
    }
    catch
    {
    }
    return null;
}

static string? FindEdgePath()
{
    var candidates = new[]
    {
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Microsoft", "Edge", "Application", "msedge.exe"),
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Microsoft", "Edge", "Application", "msedge.exe"),
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Microsoft", "Edge", "Application", "msedge.exe")
    };
    return candidates.FirstOrDefault(File.Exists);
}

static string GetMimeType(string filePath)
{
    return Path.GetExtension(filePath).ToLowerInvariant() switch
    {
        ".html" => "text/html; charset=utf-8",
        ".js" => "text/javascript; charset=utf-8",
        ".css" => "text/css; charset=utf-8",
        ".json" => "application/json; charset=utf-8",
        ".png" => "image/png",
        ".jpg" or ".jpeg" => "image/jpeg",
        ".svg" => "image/svg+xml",
        ".woff" => "font/woff",
        ".woff2" => "font/woff2",
        ".ttf" => "font/ttf",
        _ => "application/octet-stream"
    };
}
