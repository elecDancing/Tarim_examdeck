using System;
using System.IO;
using System.Windows;

namespace TarimExamdeck.Windows;

public partial class App : Application
{
    public static string AppDataDirectory { get; } = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
        "TarimExamdeck");

    public static string WebViewDataDirectory { get; } = Path.Combine(AppDataDirectory, "WebView2");

    protected override void OnStartup(StartupEventArgs e)
    {
        Directory.CreateDirectory(AppDataDirectory);
        Directory.CreateDirectory(WebViewDataDirectory);
        base.OnStartup(e);
        var window = new MainWindow();
        MainWindow = window;
        window.Show();
    }
}
