# Waiter Mobile App — Task List

Converting the existing waiter page (`src/pages/Waiter/Dashboard.js` + `src/components/Waiter/*`)
into an Android app via **Capacitor** (wrapping the existing React code — not a React Native rewrite).

**Scope of this document:** everything that must change *before* the first APK is built,
plus the mobile-native features that come after.

---

## Deployment model — LAN-only, no internet

This is the **permanent architecture**, not a testing phase. The cashier page, the waiter app
and the backend all live on the restaurant's WiFi. **If the restaurant's internet goes down,
everything must keep working** — the devices only need each other.

```
   ┌─────────────── Restaurant WiFi router ───────────────┐
   │  (no internet required)                              │
   │                                                      │
   │   Waiter phone(s)          Cashier PC / tablet       │
   │   Capacitor APK            React web page            │
   │        │                        │                    │
   │        └────────┬───────────────┘                    │
   │                 ▼                                    │
   │      http://<SERVER-IP>:5000/api                     │
   │      Express + MySQL  (server PC on the same LAN)    │
   └──────────────────────────────────────────────────────┘
```

> `localhost` cannot be used from the phone — it resolves to the phone itself.
> Use the server PC's LAN IP (`ipconfig` → IPv4 Address, e.g. `192.168.1.7`).

### What LAN-only rules out

Anything needing the internet is **off the table** and must not creep back into the design:

| Ruled out | LAN-native replacement |
|---|---|
| FCM / push notifications | **Socket.IO over the LAN** — works fully offline |
| Sentry / hosted crash reporting | Local error log written to the server |
| OTA update services | Sideload, or host the APK on the server PC |
| CDN assets, Google Fonts | Bundle everything into the build |
| Cloud DB / hosted auth | Existing local MySQL + JWT |
| Play Store delivery | Sideload the APK |
| Public TLS cert (needs a CA) | Plain HTTP on the LAN, or a self-signed cert |

---

## Phase 0 — Connectivity (blockers: app cannot reach the backend without these)

- [ ] **0.1 Make the API base URL env-driven**
  `src/services/api.js:4` hardcodes `http://localhost:5000/api`.
  Change to `process.env.REACT_APP_API_URL || "http://localhost:5000/api"` so web dev keeps
  working off the fallback and the mobile build overrides it via `.env`.
  *Done when:* changing one `.env` line repoints the app, with no code edit.

- [ ] **0.2 Add Capacitor origins to CORS**
  `backend/server.js` currently allows only `localhost:3000-3002`.
  Add `https://localhost` (Android, with `androidScheme: 'https'`) and `capacitor://localhost` (iOS).
  *Done when:* a request from the APK does not 403 on preflight.

- [ ] **0.3 Allow cleartext HTTP to the server IP (Android)**
  Android 9+ blocks plain HTTP. Add `android/app/src/main/res/xml/network_security_config.xml`
  permitting cleartext **only** for the server address, referenced from `AndroidManifest.xml`.
  With no internet there is no public CA, so this exception is **permanent** here, not temporary.
  *Done when:* the APK gets a 200 instead of `CLEARTEXT_NOT_PERMITTED`.

- [ ] **0.4 Open port 5000 on the Windows firewall**
  Windows 11 blocks inbound :5000 from the LAN by default — without this the phone just times out.
  *Done when:* browsing `http://<SERVER-IP>:5000/api` from the phone's browser returns a response.

- [ ] **0.5 Confirm Express binds `0.0.0.0`, not `127.0.0.1`**
  *Done when:* the server is reachable from another device on the WiFi.

- [ ] **0.6 Give the server PC a stable address** ← *easy to miss, breaks everything at once*
  A DHCP-assigned LAN IP can change on router reboot, and then **every** device loses the backend
  simultaneously, mid-service. Set a DHCP reservation or a static IP on the server PC.
  Optionally add mDNS (`inwallz.local`) so the address is memorable.
  *Done when:* rebooting the router leaves the server on the same address.

- [ ] **0.7 Decide what happens when the server PC is off**
  The phones are useless without it. Confirm the PC is on a UPS, or accept the downtime explicitly.

---

## Phase 1 — Auth & identity (highest-severity correctness bugs)

- [ ] **1.1 Add a 401 response interceptor** ← *most important single fix*
  `src/services/api.js` has a request interceptor but **no response interceptor**.
  The JWT expires in 8h (`backend/models/authModel.js:64`) with no refresh, so when it expires
  mid-shift every call 401s and the waiter sees *"Failed to place order"* forever with no way to
  recover. In a browser you press F5; on a phone you're stuck.
  Catch 401 → clear storage → route to login with a "session expired" message.
  *Done when:* an expired token lands the waiter on the login screen, not on a dead dashboard.

- [ ] **1.2 Use the real logged-in waiter**
  `Dashboard.js:32` hardcodes `waiterName = "John"`; `Dashboard.js:554` hardcodes `Waiter ID: W102`.
  Every phone currently shows "John". Pull both from `authService.getUser()`.
  *Done when:* two phones logged in as different waiters show different names.

- [ ] **1.3 Remove the dead `waiter_id: 1` payload**
  `Dashboard.js:430`. The backend already sets `employee_id` from the JWT
  (`backend/controllers/orderController.js:63`), so this field is ignored today — but it *is*
  spread into the order object via `{...req.body}` and becomes a real bug the day a
  `waiter_id` column is added.

- [ ] **1.4 Consider a refresh token / longer shift token**
  8h expiry will cut out mid-service on a double shift. Either lengthen it or add refresh.

---

## Phase 2 — Order integrity (prevents duplicate kitchen tickets and lost orders)

- [ ] **2.1 Add an idempotency key to order creation**
  `Dashboard.js:428-433` sends `order_number: ORD-${Date.now()}`, which the server throws away —
  it generates its own from a sequence table (`backend/utils/orderNumber.js`). So there is currently
  **no** dedupe key at all: a retry on flaky WiFi creates a genuinely new order.
  Send a client-generated `idempotency_key` (UUID per send attempt), store it on the order,
  return the original response on a repeat.
  *Done when:* firing the same send twice produces one order.

- [ ] **2.2 Disable the send button while a request is in flight**
  `src/components/Waiter/CartSheet.js:47` disables only on an empty cart, not while submitting.
  A double-tap on a slow network = two tickets.

- [ ] **2.3 Persist cart + selected table to storage**
  `Dashboard.js:21` keeps the cart in `useState` only. Android kills backgrounded WebViews
  aggressively — a waiter takes a 12-item order, checks WhatsApp, comes back to an empty cart
  and has to retake the order at the table. Save on every change, restore on mount.
  *Done when:* force-stopping and reopening the app restores the in-progress order.

- [ ] **2.4 Fix the optimistic-serve rollback race**
  `Dashboard.js:335-348` flips `served: 1` locally and reverts on failure — but the 4s poller at
  `Dashboard.js:98` can overwrite the rollback, leaving the UI showing "served" for an item the
  server rejected.

- [ ] **2.5 Make bill-line removal a single request**
  `Dashboard.js:385` loops `cancelItem` per row sequentially. If row 3 of 5 fails you get a
  half-removed bill line with no rollback. Replace with one server-side endpoint.

---

## Phase 3 — WebView behaviour (stops it looking broken)

- [ ] **3.1 Replace all 19 `alert()` and 3 `window.confirm()` calls**
  All in `Dashboard.js`. In a WebView these are blocking native dialogs that freeze the JS thread
  and read as a crash. Convert to toasts (success/error) and bottom sheets (confirms).
  *Largest chunk of work here, and the most visible quality difference.*

- [ ] **3.2 Gate polling on app visibility**
  `Dashboard.js:55-101` runs four intervals (tables/orders 10s, menu 4s, table items 4s,
  all-items 4s while searching) — they keep running while backgrounded, draining battery and data.
  The `window.addEventListener("focus")` at `Dashboard.js:66` does **not** fire reliably in a
  WebView; use `document.visibilitychange` or Capacitor's `App.appStateChange`.
  *Done when:* backgrounding the app stops all network traffic.

- [ ] **3.3 Handle the Android hardware back button**
  Currently back exits the app from any screen. Must walk Cart → Menu → Tables → confirm-exit.
  Undefined back behaviour is the top reason a wrapped web app feels broken.

- [ ] **3.4 Add an offline banner**
  Every failure path is a generic alert, so the waiter can't tell "WiFi dead in this corner" from
  "server rejected it" — they retry and create duplicates. Minimum: a `navigator.onLine` banner.

---

## Phase 4 — Mobile UI polish

- [ ] **4.1 Guard the 20 `:hover` rules**
  `src/styles/pages/Waiter/Dashboard.css` has 20 hover rules and no hover guards. On touch these
  stick after a tap until you tap elsewhere, so buttons look permanently pressed.
  Wrap in `@media (hover: hover) { ... }`.

- [ ] **4.2 Fix the two narrow-screen layouts**
  The CSS is otherwise mobile-first already (440px sheets, `env(safe-area-inset-bottom)` on all
  three bottom bars, `interactive-widget=resizes-content` in the viewport meta) — but there are no
  `@media` queries at all in 900 lines, and two spots break at 360px:
  - 3-column stats row — `Dashboard.css:64`
  - 4-item bottom status bar — `Dashboard.js:790-807`

- [ ] **4.3 Delete unused components before porting**
  `OrderSummary.js`, `TableGrid.js`, `TableCard.js`, `Header.js` are all dead —
  `Dashboard.js` inlines that markup. (`OrderSummary.js:36` also has a `key={item.id}` bug that
  should be `lineId` — another reason not to carry it forward.)

- [ ] **4.4 Shrink the image payload**
  `src/components/Waiter/CartItem.js` statically imports 9 full-size JPEGs for one category
  thumbnail. Compress to WebP or drop them.

---

## Phase 5 — Backend hardening

- [ ] **5.1** CORS origins — see 0.2
- [ ] **5.2** Idempotency key column + middleware — see 2.1
- [ ] **5.3** Add `helmet`
- [ ] **5.4** Rate-limit `/auth/login` — the API is about to be reachable from every phone on the WiFi

---

## Phase 6 — Build the APK

- [ ] **6.1** Scaffold Capacitor over the existing build output
- [ ] **6.2** Set `androidScheme: 'https'` in `capacitor.config.ts`
- [ ] **6.3** App icon, splash, name
- [ ] **6.4** Build a debug APK, sideload, test on the LAN against the real backend
- [ ] **6.5** Run the full waiter flow on a phone: login → pick table → add items → send →
      serve items → bill → cashier settles

> **Consider first:** migrating the mobile app from `react-scripts` to Vite.
> CRA is unmaintained and its build output is awkward inside Capacitor.
> Optional for a first test APK; worth doing before real use.

---

## Phase 7 — Mobile-native features (after the APK works)

All LAN-native. Nothing here needs the internet.

- [ ] **7.1 Real-time sync (Socket.IO over the LAN)** ← *do this one first*
      Rooms per restaurant; events for `order:new`, `order:ready`, `item:served`, `table:status`,
      `menu:availability`. Deletes all four polling intervals from Phase 3.2, makes the served-count
      badge instant, and **replaces FCM entirely** — a LAN socket is actually better than push here,
      since it needs no internet and has lower latency.
      *This is the single highest-leverage item in the whole document.*

- [ ] **7.2 Offline order queue** — writes go to an IndexedDB outbox, UI updates optimistically,
      queue flushes on reconnect. Still needed even on a LAN: WiFi dead spots exist inside the
      building, and the server PC can be rebooted mid-service. Without it a waiter standing in a
      dead corner loses the order they just took.

- [ ] **7.3 Sound + haptics** when the kitchen marks an order ready (driven by the 7.1 socket
      event) — waiters aren't looking at the screen.

- [ ] **7.4 "My Tables" filter** alongside the existing All/Available/Occupied/Billed tabs.

- [ ] **7.5 PIN or biometric login** — waiters re-auth constantly; passwords are too slow.
      Biometric is fully on-device, so it works with no internet.

- [ ] **7.6 Auto-logout / app lock** — a waiter's phone left on a table is an open till.

- [ ] **7.7 Table QR scanning** — camera is local; jump straight to a table instead of hunting
      the grid.

- [ ] **7.8 Local error logging** (replaces Sentry) — currently everything is `console.error`
      (`Dashboard.js:186, 193, 238, 253…`) and nobody ever sees a phone's console. Ship errors to a
      `POST /api/logs` endpoint on the server PC and write them to a file or table.

- [ ] **7.9 Self-hosted APK updates** (replaces OTA services) — serve the latest APK from the
      server PC and have the app check its version on launch against a `/api/app-version` endpoint,
      prompting the waiter to install. Keeps updates a same-evening job instead of a
      device-by-device sideload round.

---

## Deferred / not planned

- **Domain + public TLS** — not applicable; the system is LAN-only by design.
  If remote access is ever wanted, that is a new decision, not a pending task.
- **Play Store listing** — delivery is by sideload.
- **iOS** — Android first. The Capacitor code is shared, but iOS needs a Mac and a paid
  developer account, and sideloading is far more restricted.

---

## Severity summary

| Priority | Tasks | Consequence if skipped |
|---|---|---|
| **Blocker** | 0.1 – 0.7 | App cannot reach the backend at all |
| **Data loss** | 1.1, 2.1, 2.3 | Lost orders, duplicate kitchen tickets, stuck sessions |
| **Looks broken** | 3.1 – 3.4 | Waiters distrust the app and go back to paper |
| **Polish** | 4.x | Feels like a website in a box |
| **Biggest win after launch** | 7.1 (LAN sockets) | Battery drain, stale table state, no kitchen alerts |
