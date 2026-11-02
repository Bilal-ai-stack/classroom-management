; Script generated for ClassroomOS Windows Installer (Inno Setup 6+)
; Preserves user database and audit records in {localappdata}\ClassroomOS\data across installs/uninstalls

#define MyAppName "ClassroomOS"
#define MyAppVersion "2.1.0"
#define MyAppPublisher "Bilal AI Stack"
#define MyAppURL "https://github.com/Bilal-ai-stack/classroom-management"
#define MyAppExeName "ClassroomOS.exe"

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
; Standalone Windows distribution directory compiled with PyInstaller
Source: "..\codebase\backend\dist\ClassroomOS\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon; WorkingDir: "{app}"

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: postinstall nowait skipifsilent

[UninstallDelete]
; Clean up runtime caches and temporary files, BUT preserve {localappdata}\ClassroomOS\data
Type: filesandordirs; Name: "{app}\dist"
Type: files; Name: "{app}\*.log"
