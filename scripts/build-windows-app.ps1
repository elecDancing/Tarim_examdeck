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
$AppVersion = (Get-Content (Join-Path $Root "package.json") -Raw | ConvertFrom-Json).version
$InstallerFileName = "tarim-examdeck-windows-setup-v$AppVersion.exe"
$InstallerPath = Join-Path $Release $InstallerFileName

if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
  throw "dotnet was not found. Install .NET 8 SDK on the Windows build machine."
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
    -p:Version=$AppVersion `
    -o $Publish

  $makensis = Get-Command makensis -ErrorAction SilentlyContinue
  $makensisPath = $null
  if ($makensis) {
    $makensisPath = $makensis.Source
  } else {
    $candidateMakensisPaths = @(
      (Join-Path ${env:ProgramFiles(x86)} "NSIS\makensis.exe"),
      (Join-Path ${env:ProgramFiles} "NSIS\makensis.exe")
    )
    $makensisPath = $candidateMakensisPaths | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
  }
  $nsisScript = Join-Path $Root "installer\windows\TarimExamdeck.nsi"
  if ($makensisPath) {
    & $makensisPath "/DAPP_VERSION=$AppVersion" "/DSETUP_OUTFILE=$InstallerPath" $nsisScript
    Write-Host "Generated NSIS installer:" $InstallerPath
  } elseif (Get-Command ISCC.exe -ErrorAction SilentlyContinue) {
    $iscc = Get-Command ISCC.exe
    & $iscc.Source "/DMyAppVersion=$AppVersion" "/DOutputBaseFilename=tarim-examdeck-windows-setup-v$AppVersion" $InstallerScript
    Write-Host "Generated Inno Setup installer:" $InstallerPath
  } else {
    Write-Warning "makensis or Inno Setup ISCC.exe was not found; skipped setup.exe generation."
  }
}
finally {
  Pop-Location
  Remove-Item Env:\VITE_DISABLE_QUESTION_BANK_EXPORT -ErrorAction SilentlyContinue
}
