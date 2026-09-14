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
; The InWallz logo as the installer's own icon (staged from public/favicon.ico).
SetupIconFile=staging\app\build\favicon.ico
Compression=lzma2
SolidCompression=yes
WizardStyle=modern

[Files]
Source: "staging\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs

; No [Icons] here on purpose. A cmd/"start msedge --app" shortcut launches a
; plain Edge window that Windows treats as a SEPARATE taskbar button from the
; pinned shortcut (two icons, generic icon). Instead we let Edge install the till
; as a real PWA (WebAppInstallForceList in install-services.ps1, with
; create_desktop_shortcut) and open it once at the end of setup so that shortcut
; is created. That shortcut launches the PWA, groups correctly when pinned, and
; carries the logo from the web manifest.

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

// Runs BEFORE files are copied. On an in-place update the InWallz services are
// running, so their binaries (mysqld/node .dlls) are locked and the copy fails
// with "DeleteFile failed; code 5. Access is denied." Stop the services first so
// the files can be replaced; the service installer restarts them afterwards.
// No-op on a fresh machine (the services don't exist yet).
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  rc: Integer;
begin
  Exec(ExpandConstant('{cmd}'), '/c net stop InWallzServer', '', SW_HIDE, ewWaitUntilTerminated, rc);
  Exec(ExpandConstant('{cmd}'), '/c net stop InWallzMySQL', '', SW_HIDE, ewWaitUntilTerminated, rc);
  // Close the native till window too, or its exe/DLLs can't be overwritten.
  Exec(ExpandConstant('{cmd}'), '/c taskkill /f /im InWallzTill.exe', '', SW_HIDE, ewWaitUntilTerminated, rc);
  // Give Windows a moment to release the file handles after the services stop.
  Sleep(2000);
  Result := '';
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
