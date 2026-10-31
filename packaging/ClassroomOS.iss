; Script generated for ClassroomOS Windows Installer (Inno Setup 6+)
; Preserves user database and audit records in {localappdata}\ClassroomOS\data across installs/uninstalls

#define MyAppName "ClassroomOS"
#define MyAppVersion "2.0.0"
#define MyAppPublisher "Bilal AI Stack"
#define MyAppURL "https://github.com/Bilal-ai-stack/classroom-management"
#define MyAppExeName "run-desktop.bat"

[Setup]
AppId={{C78D21B5-9B7E-4E61-8C53-A12B890F3B91}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={localappdata}\Programs\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
LicenseFile=..\README.md
PrivilegesRequired=lowest
OutputDir=..\dist_installer
OutputBaseFilename=ClassroomOS-Setup-{#MyAppVersion}
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "..\run-desktop.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\codebase\backend\*"; DestDir: "{app}\codebase\backend"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\codebase\frontend\dist\*"; DestDir: "{app}\codebase\frontend\dist"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon; WorkingDir: "{app}"

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: shellexec postinstall nowait skipifsilent

[UninstallDelete]
; Clean up runtime caches and temporary files, BUT preserve {localappdata}\ClassroomOS\data
Type: filesandordirs; Name: "{app}\codebase\backend\__pycache__"
Type: filesandordirs; Name: "{app}\codebase\backend\instance\temp_crops"
Type: files; Name: "{app}\*.log"
