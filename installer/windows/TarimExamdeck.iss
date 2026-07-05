#define MyAppName "Tarim ExamDeck"
#ifndef MyAppVersion
#define MyAppVersion "1.0.38"
#endif
#ifndef OutputBaseFilename
#define OutputBaseFilename "tarim-examdeck-windows-setup-v" + MyAppVersion
#endif
#define MyAppPublisher "Tarim ExamDeck"
#define MyAppExeName "TarimExamdeck.exe"

[Setup]
AppId={{9B6E1E3B-7B8E-4F7D-9DAA-23B97B83D942}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={localappdata}\Programs\TarimExamdeck
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir=..\..\release
OutputBaseFilename={#OutputBaseFilename}
SetupIconFile=..\..\windows\Assets\AppIcon.ico
Compression=lzma
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional tasks:"; Flags: unchecked

[Files]
Source: "..\..\release\windows\publish\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\..\windows\Assets\AppIcon.ico"; DestDir: "{app}"; DestName: "AppIcon.ico"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\AppIcon.ico"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\AppIcon.ico"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Launch {#MyAppName}"; Flags: nowait postinstall skipifsilent
