# Dev vs. Exe on the same PC

The installed **exe** runs `InWallzServer` on **port 5000** and its bundled
`InWallzMySQL` on **3306**. Your **dev stack** wants the *same* ports
(`npm run dev` -> 5000, MySQL -> 3306). Two things can't own one port, so on a
single machine you **switch modes** instead of running both at once.

Your friend hit this too — that's all it is: the exe is holding 5000, so the
dev backend can't start there.

## To develop
Run **`dev-mode.ps1`** (right-click → Run with PowerShell; it asks for admin).
It stops the exe services and starts your dev MySQL. Then:

```
cd backend
npm run dev        # backend  -> http://localhost:5000
```
```
npm start          # frontend -> http://localhost:3000
```

## To test the packaged exe again
Run **`exe-mode.ps1`**. It stops the dev MySQL / dev backend and starts the exe
services, so `http://localhost:5000` serves the installed till.

## Notes
- Both scripts self-elevate (need admin to stop/start Windows services).
- Default dev MySQL service is `MySQL80`. If yours is named differently
  (e.g. a XAMPP/portable one), pass it:
  `powershell -ExecutionPolicy Bypass -File dev-mode.ps1 -DevMySql "wampmysqld64"`
- The scripts set the services to **Manual** start, so after a reboot the PC
  won't auto-start the exe and grab 5000 — you decide the mode each session.
- **Cleanest of all:** on a machine you only use for coding, don't install the
  exe at all. The exe is for restaurant/production PCs.
