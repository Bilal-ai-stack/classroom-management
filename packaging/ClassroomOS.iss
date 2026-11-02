; Script generated for ClassroomOS Windows Installer (Inno Setup 6+)
; Features:
; - Independent selection of program installation directory (C: or D:)
; - Interactive selection of persistent data directory (e.g. D:\ClassroomOSData or {localappdata}\ClassroomOS\data)
; - Generates storage_config.json in {app} and registers HKCU\Software\ClassroomOS\DataDir
; - Clean graphical launch without an exposed Command Prompt window
; - Full preservation of user database records, photographs, and backups across upgrades and uninstallations

#define MyAppName "ClassroomOS"
#define MyAppVersion "2.1.1"
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
DisableProgramGroupPage=no
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
; Clean up runtime caches and temporary files, BUT strictly preserve user persistent data directory
Type: filesandordirs; Name: "{app}\dist"
Type: files; Name: "{app}\*.log"

[Registry]
Root: HKCU; Subkey: "Software\ClassroomOS"; ValueType: string; ValueName: "DataDir"; ValueData: "{code:GetDataDir}"; Flags: noerror

[Code]
var
  DataDirPage: TInputDirWizardPage;

function StringReplaceAll(const S, OldSub, NewSub: string): string;
var
  Idx: Integer;
  Remainder: string;
begin
  Remainder := S;
  Result := '';
  repeat
    Idx := Pos(OldSub, Remainder);
    if Idx > 0 then
    begin
      Result := Result + Copy(Remainder, 1, Idx - 1) + NewSub;
      Remainder := Copy(Remainder, Idx + Length(OldSub), MaxInt);
    end
    else
      Result := Result + Remainder;
  until Idx = 0;
end;

function GetDataDir(Param: String): String;
begin
  if DataDirPage <> nil then
    Result := DataDirPage.Values[0]
  else
    Result := ExpandConstant('{localappdata}\ClassroomOS\data');
end;

procedure InitializeWizard;
var
  DefaultDataDir: String;
  ExistingRegDir: String;
begin
  { Check if registry already has a configured data dir from previous installation }
  if RegQueryStringValue(HKCU, 'Software\ClassroomOS', 'DataDir', ExistingRegDir) and (ExistingRegDir <> '') then
    DefaultDataDir := ExistingRegDir
  else
    DefaultDataDir := ExpandConstant('{localappdata}\ClassroomOS\data');

  DataDirPage := CreateInputDirPage(
    wpSelectDir,
    'Select Persistent Data Storage Directory',
    'Where should ClassroomOS store databases, student photos, and backups?',
    'ClassroomOS stores student records, portraits, branding logos, and backup archives in a persistent folder.'#13#10 +
    'You can select a directory on drive D: (e.g. D:\ClassroomOSData) or retain the default location on C:.'#13#10#13#10 +
    'To continue, click Next. If you would like to select a different folder, click Browse.',
    False, '');
  DataDirPage.Add('');
  DataDirPage.Values[0] := DefaultDataDir;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ChosenDataDir: String;
  ConfigFile: String;
  ConfigContent: String;
begin
  if CurStep = ssPostInstall then
  begin
    ChosenDataDir := GetDataDir('');
    { Ensure data subdirectories exist }
    ForceDirectories(ChosenDataDir);
    ForceDirectories(ChosenDataDir + '\photos\students');
    ForceDirectories(ChosenDataDir + '\branding');
    ForceDirectories(ChosenDataDir + '\backups');
    ForceDirectories(ChosenDataDir + '\logs');

    { Write storage_config.json in the application directory }
    ConfigFile := ExpandConstant('{app}\storage_config.json');
    ConfigContent := '{'#13#10 +
      '  "version": "' + '{#MyAppVersion}' + '",'#13#10 +
      '  "data_dir": "' + StringReplaceAll(ChosenDataDir, '\', '\\') + '"'#13#10 +
      '}';
    SaveStringToFile(ConfigFile, ConfigContent, False);
  end;
end;
