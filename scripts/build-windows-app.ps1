param(
  [string]$Configuration = "Release",
  [string]$Runtime = "win-x64"
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Release = Join-Path $Root "release"
$WindowsRelease = Join-Path $Release "windows"
$Publish = Join-Path $WindowsRelease "publish"
$Project = Join-Path $Root "windows\TarimExamdeck.Windows.csproj"
$InstallerScript = Join-Path $Root "installer\windows\TarimExamdeck.iss"

if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
  throw "未找到 dotnet。请在 Windows 构建机安装 .NET 8 SDK。"
}

Push-Location $Root
try {
  if (-not (Test-Path "node_modules")) {
    npm ci
  }

  $env:VITE_DISABLE_QUESTION_BANK_EXPORT = "1"
  npm run build
  Remove-Item Env:\VITE_DISABLE_QUESTION_BANK_EXPORT -ErrorAction SilentlyContinue

  if (Test-Path $Publish) {
    Remove-Item $Publish -Recurse -Force
  }

  dotnet publish $Project `
    -c $Configuration `
    -r $Runtime `
    --self-contained true `
    -p:PublishSingleFile=false `
    -o $Publish

  $makensis = Get-Command makensis -ErrorAction SilentlyContinue
  $nsisScript = Join-Path $Root "installer\windows\TarimExamdeck.nsi"
  if ($makensis) {
    & $makensis.Source $nsisScript
    Write-Host "已生成 NSIS 安装包：" (Join-Path $Release "塔里木刷题王-setup.exe")
  } elseif (Get-Command ISCC.exe -ErrorAction SilentlyContinue) {
    $iscc = Get-Command ISCC.exe
    & $iscc.Source $InstallerScript
    Write-Host "已生成 Inno Setup 安装包：" (Join-Path $Release "塔里木刷题王-setup.exe")
  } else {
    Write-Warning "未找到 makensis 或 Inno Setup ISCC.exe，已跳过 setup.exe。"
  }
}
finally {
  Pop-Location
  Remove-Item Env:\VITE_DISABLE_QUESTION_BANK_EXPORT -ErrorAction SilentlyContinue
}
