; installer.iss — InWallz cashier installer (Inno Setup 6).
; Bundles the staging tree and runs install-services.ps1 with the activation
; key the technician enters. Build with:  iscc packaging\installer.iss
;
; Expects this tree next to the .iss (see PACKAGING.md for how to assemble it):
;   staging\node\        portable Node runtime
;   staging\mysql\       MySQL Community (extracted ZIP)
;   staging\app\         output of build-app.ps1 (build\ + backend\)
;   staging\app\inwallz_schema.sql   schema-only dump
;   staging\nssm.exe
;   staging\install-services.ps1     (copy of this folder's script)

#define AppName "InWallz Billing"
#define AppVer  "1.0.0"

[Setup]
AppName={#AppName}
AppVersion={#AppVer}
; Install to a no-spaces path so MySQL/NSSM never mis-parse the datadir, and it
; works regardless of whether 8.3 short names are enabled on the machine.
DefaultDirName={sd}\InWallz
DefaultGroupName=InWallz
DisableProgramGroupPage=yes
DisableDirPage=yes
PrivilegesRequired=admin
; Bundled MySQL/Node are 64-bit — only install on 64-bit Windows.
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputBaseFilename=InWallzSetup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern

[Files]
Source: "staging\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs

[Icons]
; Till shortcut: opens as a STANDALONE app window (no tabs/address bar), so it
; looks and behaves like a native app and can be pinned to the taskbar.
; (For a locked-down production kiosk, swap --app for:
;  --kiosk http://localhost:5000 --edge-kiosk-type=fullscreen)
Name: "{commondesktop}\InWallz Till"; Filename: "{cmd}"; \
  Parameters: "/c start msedge --app=http://localhost:5050"; \
  IconFilename: "{app}\app\build\favicon.ico"

[Code]
var
  ActPage: TInputQueryWizardPage;

procedure InitializeWizard;
begin
  ActPage := CreateInputQueryPage(wpSelectDir,
    'Activation', 'Enter the restaurant activation key',
    'This links this PC to the restaurant. Get the key from your InWallz admin.');
  ActPage.Add('Activation key (e.g. INWZ-XXXX-XXXX):', False);
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if (CurPageID = ActPage.ID) and (Trim(ActPage.Values[0]) = '') then begin
    MsgBox('Please enter the activation key.', mbError, MB_OK);
    Result := False;
  end;
end;

[Run]
; After files are copied, run the service installer with the entered key.
Filename: "powershell.exe"; \
  Parameters: "-ExecutionPolicy Bypass -File ""{app}\install-services.ps1"" -InstallDir ""{app}"" -ActivationKey ""{code:GetKey}"""; \
  StatusMsg: "Setting up services (this can take a minute)..."; \
  Flags: runhidden waituntilterminated

[Code]
function GetKey(Param: String): String;
begin
  Result := Trim(ActPage.Values[0]);
end;

[UninstallRun]
; Remove services on uninstall.
Filename: "{app}\nssm.exe"; Parameters: "stop InWallzServer";  Flags: runhidden; RunOnceId: "stopsrv"
Filename: "{app}\nssm.exe"; Parameters: "remove InWallzServer confirm"; Flags: runhidden; RunOnceId: "rmsrv"
Filename: "{app}\nssm.exe"; Parameters: "stop InWallzMySQL";   Flags: runhidden; RunOnceId: "stopdb"
Filename: "{app}\nssm.exe"; Parameters: "remove InWallzMySQL confirm";  Flags: runhidden; RunOnceId: "rmdb"
; Remove the Edge app-install policy added by install-services.ps1.
Filename: "reg.exe"; Parameters: "delete ""HKLM\SOFTWARE\Policies\Microsoft\Edge\WebAppInstallForceList"" /f"; Flags: runhidden; RunOnceId: "rmedgepol"
