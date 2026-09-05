/**
 * Generates the three InWallz POS tester documents (Abishek / Arthi / Rahul).
 *
 *   node testing/generate-test-docs.js
 *
 * Each output is ONE self-contained .html file: no internet, no server, no
 * install. The tester double-clicks it, fills the header, marks every case
 * Pass / Fail / Blocked / N-A, then clicks "Export report" and mails the file
 * back. Progress auto-saves in the browser and can also be saved to a .json.
 */

const fs = require("fs");
const path = require("path");

/* ------------------------------------------------------------------ *
 *  SHARED BLOCKS (reused across the three documents)
 * ------------------------------------------------------------------ */

const CREDS = `
<table class="creds">
  <tr><th>Role</th><th>Username</th><th>Password</th><th>Lands on</th></tr>
  <tr><td>Super Admin</td><td><code>inwallz</code></td><td><code>Admin@123</code></td><td>/super_admin</td></tr>
  <tr><td>Admin</td><td><code>&lt;admin&gt;@&lt;restaurant&gt;</code></td><td>(given by Arun)</td><td>/admin/dashboard</td></tr>
  <tr><td>Cashier</td><td><code>&lt;name&gt;_cashier@&lt;restaurant&gt;</code></td><td>(given by Arun)</td><td>/cashier</td></tr>
  <tr><td>Waiter</td><td><code>&lt;name&gt;_waiter@&lt;restaurant&gt;</code></td><td>(given by Arun)</td><td>/waiter</td></tr>
  <tr><td>Kitchen</td><td><code>kitchen@inwallz</code></td><td><code>Kitchen@123</code></td><td>/kitchen</td></tr>
</table>`;

const SEV_HELP = `
<ul class="sevhelp">
  <li><b>Critical</b> — money is wrong, an order/bill is lost or duplicated, or the app cannot be used at all.</li>
  <li><b>High</b> — a main flow fails but there is a workaround; wrong data shown to staff.</li>
  <li><b>Medium</b> — a secondary feature is broken; validation missing.</li>
  <li><b>Low</b> — cosmetic, wording, alignment, spacing.</li>
</ul>`;

/* ------------------------------------------------------------------ *
 *  DOCUMENT 1 — ABISHEK  (Windows till + Android waiter app)
 * ------------------------------------------------------------------ */

const ABISHEK = {
  file: "TEST-01-Abishek-Windows-Android.html",
  code: "AB",
  tester: "Abishek",
  devices: "Windows PC (till) + Android phone",
  title: "InWallz POS — Test Report 1",
  scope: "Windows .exe / cashier till, kitchen display, printing, and the Android waiter APK (core flows).",
  brief: `
<p>You own <b>the till and the floor</b>. You are the only tester who can prove the
Windows installer, the real printers and the phone app work together, so please do
these in order — the later sections need the earlier ones to have passed.</p>
<p><b>You need:</b> a Windows PC (ideally a spare one / VM for the installer section),
a thermal or normal printer if available, an Android phone on the <u>same WiFi</u>
as the PC, and the latest APK
(<code>InWallz-Waiter-YYYYMMDD-HHMM-AUTO.apk</code>).</p>
<p><b>If a section is impossible</b> (no printer, no spare PC) mark those rows
<b>Blocked</b> and write why — do not mark them Pass.</p>`,
  sections: [
    {
      id: "A", title: "Environment & setup (do first)",
      note: "Nothing below is valid until these pass. Record the exact versions/IPs in the header box at the top of this page.",
      cases: [
        { id: 1, t: "Backend starts and answers", pri: "Critical",
          s: ["Start the backend (service, or `node server.js` in billing-software/backend).", "In the PC browser open http://localhost:5000/api/health"],
          e: "A JSON response containing service: \"inwallz-billing\". No error page." },
        { id: 2, t: "Till UI loads on the PC", pri: "Critical",
          s: ["Open http://localhost:5000 (or http://localhost:3000 in dev mode)."],
          e: "The login screen renders fully — logo, username, password, eye icon, Login button. No blank white page, no console error overlay." },
        { id: 3, t: "PC has a fixed LAN IP", pri: "High",
          s: ["Run `ipconfig`, note the IPv4 address.", "Restart the WiFi router.", "Run `ipconfig` again."],
          e: "The IPv4 address is the same after the reboot (static IP or DHCP reservation). Write the IP in the header box." },
        { id: 4, t: "Port 5000 reachable from another device", pri: "Critical",
          s: ["On the Android phone's browser (same WiFi) open http://<PC-IP>:5000/api/health"],
          e: "The same JSON appears on the phone. If it times out, the Windows firewall rule for port 5000 (Private) is missing." },
        { id: 5, t: "Server binds to the network, not just localhost", pri: "High",
          s: ["From a second PC/phone on the WiFi open http://<PC-IP>:5000"],
          e: "The login page loads on the other device." },
        { id: 6, t: "Database is loaded with test data", pri: "High",
          s: ["Log in as admin and open Menu, Categories, Tables."],
          e: "There is at least 1 category, 5+ menu items and 3+ tables to test with. If empty, ask Arun for the SQL dump before continuing." },
      ]
    },
    {
      id: "B", title: "Windows installer — InWallzSetup.exe",
      note: "Arun's note: this section has never been run on a clean machine. Failures here are EXPECTED and valuable — capture the exact error text and a screenshot. Use a spare PC or a VM, never your daily machine.",
      cases: [
        { id: 1, t: "Installer launches", pri: "Critical",
          s: ["Copy packaging/Output/InWallzSetup.exe to the clean PC.", "Right-click → Run as administrator."],
          e: "The setup wizard opens with the InWallz name/branding. No SmartScreen hard-block that cannot be bypassed." },
        { id: 2, t: "Activation key is requested", pri: "High",
          s: ["Step through the wizard."],
          e: "One field asks for an activation key in the form INWZ-XXXX-XXXX." },
        { id: 3, t: "Bad activation key is rejected clearly", pri: "High",
          s: ["Enter a wrong key such as INWZ-0000-0000 and continue."],
          e: "A readable message says the key is invalid. The installer does not crash and lets you retype it." },
        { id: 4, t: "Install completes with a valid key", pri: "Critical",
          s: ["Enter the real key given by Arun and finish the wizard."],
          e: "Install finishes with no error dialog. Files exist in C:\\Program Files\\InWallz\\." },
        { id: 5, t: "Both Windows services are registered and running", pri: "Critical",
          s: ["Open services.msc."],
          e: "InWallzMySQL and InWallzServer both exist, are Running, and Startup type is Automatic." },
        { id: 6, t: "Firewall rule was created", pri: "High",
          s: ["Windows Defender Firewall → Advanced → Inbound Rules, search InWallz / port 5000."],
          e: "An inbound allow rule for port 5000 exists, scoped to the Private profile." },
        { id: 7, t: "First boot pulls the catalog from the cloud", pri: "Critical",
          s: ["With internet connected, wait ~1 minute after install.", "Open the till and log in as the restaurant's cashier."],
          e: "The menu, categories, tables and staff from the cloud are present on the fresh machine — not an empty menu." },
        { id: 8, t: "Reboot test — the till comes up on its own", pri: "Critical",
          s: ["Restart the PC.", "Do NOT open a terminal or start anything by hand.", "Time how long until the till is usable."],
          e: "Within ~60 seconds the desktop shortcut opens a working till. Record the actual seconds in Notes. This is the single most important installer test." },
        { id: 9, t: "Desktop / kiosk shortcut", pri: "Medium",
          s: ["Double-click the InWallz desktop shortcut."],
          e: "The browser opens full-screen (kiosk) on the till page, with no address bar to wander off from." },
        { id: 10, t: "MySQL survives a hard power cut", pri: "High",
          s: ["With the till idle, pull the power (or force-off the VM).", "Power back on and wait."],
          e: "Services restart, the database recovers, and the till loads. No 'cannot connect to database' screen at 9am." },
        { id: 11, t: "Nightly backup task exists", pri: "Medium",
          s: ["Open Task Scheduler and look for an InWallz backup / mysqldump task."],
          e: "A scheduled task exists and its last-run result is not an error." },
        { id: 12, t: "Uninstall is clean", pri: "Low",
          s: ["Apps & Features → uninstall InWallz (do this LAST, after every other section).", "Re-check services.msc and the install folder."],
          e: "Both services are removed and the program folder is gone. Note anything left behind." },
      ]
    },
    {
      id: "C", title: "Login, roles & session (on the till)",
      cases: [
        { id: 1, t: "Valid cashier login", pri: "Critical",
          s: ["Enter the cashier username and password, press Login."],
          e: "Lands directly on the cashier POS screen (/cashier)." },
        { id: 2, t: "Wrong password", pri: "High",
          s: ["Enter a correct username with a wrong password."],
          e: "A clear 'invalid credentials' message. It must NOT say whether the username exists, and must not leave the screen stuck on a spinner." },
        { id: 3, t: "Empty fields", pri: "Medium",
          s: ["Press Login with both fields blank."],
          e: "The form blocks submission and points at the empty fields. No request is sent." },
        { id: 4, t: "Show / hide password", pri: "Low",
          s: ["Type a password, click the eye icon, click it again."],
          e: "The characters reveal and hide correctly and the icon changes." },
        { id: 5, t: "Username with spaces / different case", pri: "Medium",
          s: ["Log in with the username in CAPITALS, then with a trailing space."],
          e: "Record what happens. Expected: it works, or gives a clear error — never a server 500." },
        { id: 6, t: "Kitchen login goes to the kitchen board", pri: "High",
          s: ["Log in as kitchen@inwallz / Kitchen@123."],
          e: "Lands on /kitchen showing the kitchen display." },
        { id: 7, t: "Cashier cannot open admin pages", pri: "Critical",
          s: ["Logged in as cashier, type http://<host>/admin/dashboard in the address bar."],
          e: "Access is refused / bounced back. The admin dashboard must never render for a cashier." },
        { id: 8, t: "Logout clears the session", pri: "High",
          s: ["Click Logout.", "Press the browser Back button."],
          e: "You stay on the login screen. The previous page must not come back with live data." },
        { id: 9, t: "Unknown URL", pri: "Low",
          s: ["Open http://<host>/some/random/page while logged in."],
          e: "You are redirected to your own home screen, not a crash or blank page." },
        { id: 10, t: "Refresh keeps you logged in", pri: "High",
          s: ["On the cashier screen press F5."],
          e: "You stay logged in on /cashier with the same table/bill state." },
      ]
    },
    {
      id: "D", title: "Cashier — table orders",
      cases: [
        { id: 1, t: "Top bar shows live figures", pri: "Medium",
          s: ["Look at the top bar: today's totals, active count, cashier name, logout."],
          e: "The cashier's real name is shown (not a placeholder) and the counts match reality." },
        { id: 2, t: "Table chips show the right state", pri: "High",
          s: ["Look at the T1/T2/T3… chips."],
          e: "Each chip shows Free / Occupied / Billed correctly, and occupied ones show a served count like 2/5." },
        { id: 3, t: "Select a free table", pri: "Critical",
          s: ["Click a Free table chip."],
          e: "The bill panel on the right switches to that table and is empty." },
        { id: 4, t: "Menu grid loads with categories and search", pri: "High",
          s: ["Browse categories, then type part of an item name in search."],
          e: "Filtering works, veg/non-veg dots are correct, prices match the admin Menu page." },
        { id: 5, t: "Add items with the stepper", pri: "Critical",
          s: ["Press + on one item three times, + on another once, then − once."],
          e: "Quantities are 3 and 0/removed correctly; the layout does NOT jump or reflow while adding." },
        { id: 6, t: "Unavailable items cannot be added", pri: "High",
          s: ["Mark an item unavailable (Menu availability screen), come back and try to add it."],
          e: "The item is greyed out / cannot be added and says it is unavailable." },
        { id: 7, t: "Per-item cooking note", pri: "High",
          s: ["Add 2 of the same drink, put 'no ice' on one line and 'with ice' on another."],
          e: "Both notes are kept separately and appear on the bill panel." },
        { id: 8, t: "Live totals are arithmetically right", pri: "Critical",
          s: ["Add items with known prices.", "Check Subtotal, GST 5%, Service 2%, Total with a calculator."],
          e: "Subtotal = Σ(price × qty). GST and service are computed on the subtotal. Total = subtotal + gst + service (+ any charges). Write the numbers you saw in Notes if they differ." },
        { id: 9, t: "Send to kitchen", pri: "Critical",
          s: ["Press the send/update button for the table."],
          e: "The order is created, the table turns Occupied, and the items move into the 'Current order (unpaid)' block." },
        { id: 10, t: "Order appears on the kitchen board within seconds", pri: "Critical",
          s: ["On a second screen open the kitchen display."],
          e: "The order shows under the right table within ~5 seconds, with the cooking notes." },
        { id: 11, t: "Add a second round to the same table", pri: "Critical",
          s: ["With the table still occupied, add 2 more items and send again."],
          e: "A new-items kitchen ticket goes out; the old items are NOT sent again; the bill shows both rounds." },
        { id: 12, t: "Serve an item from the cashier screen", pri: "High",
          s: ["Press Serve on one line in the current order."],
          e: "The line marks ✓ Served, the served count on the table chip goes up, and the kitchen board reflects it." },
        { id: 13, t: "Double-click the send button", pri: "Critical",
          s: ["Add items, then click send twice as fast as you can."],
          e: "Exactly ONE order/ticket is created. If two appear, this is a Critical defect — say so in Notes." },
        { id: 14, t: "Send an empty order", pri: "Medium",
          s: ["With no items selected, press send."],
          e: "Blocked with a clear message. No empty order is created." },
        { id: 15, t: "Cancel order", pri: "High",
          s: ["Press ✕ Cancel Order on an open table order and confirm."],
          e: "It asks for confirmation first; after confirming the table returns to Free and the kitchen board drops it." },
        { id: 16, t: "Cancel — but press No", pri: "Medium",
          s: ["Press Cancel Order and then decline the confirmation."],
          e: "Nothing changes; the order is still there." },
      ]
    },
    {
      id: "E", title: "Cashier — counter / walk-in orders",
      cases: [
        { id: 1, t: "Counter mode selects with no table", pri: "High",
          s: ["Click the Counter chip."],
          e: "The bill panel switches to a counter/walk-in bill; no table is highlighted." },
        { id: 2, t: "Send & Bill in one step", pri: "Critical",
          s: ["Add 2 items in counter mode and press Send & Bill."],
          e: "The order is created (kitchen gets it) AND the payment screen opens immediately — one action, not two." },
        { id: 3, t: "No 'Update Order' in counter mode", pri: "Medium",
          s: ["Look at the buttons available in counter mode."],
          e: "There is no Update Order button (by design)." },
        { id: 4, t: "Counter order on the kitchen board", pri: "High",
          s: ["Check the kitchen display."],
          e: "A 'Counter' card appears labelled with its order number, separate from the table cards." },
        { id: 5, t: "Counter card stays until every item is served", pri: "Medium",
          s: ["Pay the counter bill but leave one item unserved.", "Watch the kitchen board."],
          e: "The counter card stays on the board until all items are served — paying alone does not remove it." },
        { id: 6, t: "Multiple counter orders at once", pri: "Medium",
          s: ["Create three counter orders back to back."],
          e: "Three separate cards with three distinct order numbers. No merging, no duplicate numbers." },
      ]
    },
    {
      id: "F", title: "Cashier — bill edit, payment & settle",
      cases: [
        { id: 1, t: "Open the bill for a table", pri: "Critical",
          s: ["Press 🧾 Generate Bill on an occupied table."],
          e: "The bill modal opens listing every item, qty, rate, amount, and the tax/charge lines." },
        { id: 2, t: "Change a quantity on the bill", pri: "Critical",
          s: ["Reduce a line from 3 to 1 and save."],
          e: "Line amount and every total recalculate correctly and persist after closing/reopening the bill." },
        { id: 3, t: "Cancel a single bill line", pri: "Critical",
          s: ["Remove one line from the bill."],
          e: "The line disappears and all totals drop by exactly that line's amount." },
        { id: 4, t: "Add an item from inside the bill", pri: "High",
          s: ["Use ＋ add item inside the bill editor."],
          e: "The item is added, totals update, and the kitchen is informed if the printer mode requires it." },
        { id: 5, t: "Set a quantity of 0 or a negative number", pri: "High",
          s: ["Try to type 0, then -1, then 9999 as a quantity."],
          e: "0/negative are rejected or treated as a removal — never a negative bill total. Note what actually happens." },
        { id: 6, t: "Payment — cash with change", pri: "Critical",
          s: ["Settle a ₹237 bill by tendering ₹500 cash."],
          e: "Change shows exactly ₹263. Wrong change is Critical." },
        { id: 7, t: "Payment — card / UPI", pri: "High",
          s: ["Settle another bill by each of the other payment methods."],
          e: "Each method saves and shows on the bill and later in reports." },
        { id: 8, t: "Under-payment", pri: "High",
          s: ["Tender less cash than the total."],
          e: "It is blocked or clearly marked partial/pending — it must not silently mark the bill fully paid." },
        { id: 9, t: "Print & Settle frees the table", pri: "Critical",
          s: ["Complete the payment."],
          e: "The table goes back to Free/Available, drops off the kitchen board, and the bill lands in Bills history." },
        { id: 10, t: "A settled table can start a fresh order", pri: "Critical",
          s: ["Immediately start a new order on that same table."],
          e: "A brand-new order with a new order number. None of the previous items reappear." },
        { id: 11, t: "Bill numbers are unique and sequential", pri: "High",
          s: ["Create and settle 3 bills in a row; note the numbers."],
          e: "Order/bill numbers increase and never repeat. Record them in Notes." },
        { id: 12, t: "Settle the same bill twice", pri: "Critical",
          s: ["Settle a bill, then try to settle it again (reopen from Bills history)."],
          e: "The second attempt is refused. A double-count of money is Critical." },
        { id: 13, t: "Bill respects the admin's billing format", pri: "High",
          s: ["Ask Arthi to change a toggle in Admin → Billing (e.g. hide GSTIN), then print a bill."],
          e: "The printed/preview bill follows the admin's settings." },
        { id: 14, t: "Currency shows as Rs. on paper", pri: "Medium",
          s: ["Look at a printed slip (not the screen)."],
          e: "Money prints as 'Rs.' — if you see □ boxes instead of a symbol, report it." },
      ]
    },
    {
      id: "G", title: "Cashier — side pages (bills history, menu availability, alerts)",
      cases: [
        { id: 1, t: "Sidebar opens and closes", pri: "Low",
          s: ["Open the left drawer, then click the dark area outside it."],
          e: "It opens and closes smoothly; the page underneath is not left scrolled/broken." },
        { id: 2, t: "Bills history lists today's bills", pri: "High",
          s: ["Open the Bills page after settling a few bills."],
          e: "All of today's bills appear with number, time, amount and payment method." },
        { id: 3, t: "Reopen a bill from history", pri: "High",
          s: ["Click a past bill."],
          e: "It opens read-only or reprintable with exactly the amounts that were charged." },
        { id: 4, t: "Reprint a past bill", pri: "Medium",
          s: ["Reprint a settled bill."],
          e: "The reprint matches the original — same items, same total, same bill number." },
        { id: 5, t: "Menu availability toggle", pri: "High",
          s: ["Open 🍽 Menu availability, switch an item off."],
          e: "Within ~10 seconds the item is unavailable on the cashier grid AND on the waiter phone." },
        { id: 6, t: "Turn an item back on", pri: "Medium",
          s: ["Switch the same item back on."],
          e: "It becomes orderable again on both devices." },
        { id: 7, t: "Running orders / 🔔 alert", pri: "Medium",
          s: ["With unpaid orders open, check the 🔔 running-orders indicator."],
          e: "The count matches the number of open orders and clicking it shows them." },
        { id: 8, t: "Bills-to-print indicator", pri: "High",
          s: ["From the waiter phone, send a table to billing."],
          e: "The cashier's '🔔 Bills to print' indicator picks it up without a page refresh." },
      ]
    },
    {
      id: "H", title: "Printer setup & direct printing",
      note: "If you have no physical printer, install the 'Microsoft Print to PDF' printer and use that — most of these still work.",
      cases: [
        { id: 1, t: "Printer page shows the right number of boxes", pri: "High",
          s: ["With the admin set to Dual printer, open the cashier's 🖨 Printer page.", "Then have it changed to Cashier + KDS and reload."],
          e: "Dual printer → two boxes (cashier + kitchen). Other two modes → one box only." },
        { id: 2, t: "The dropdown lists this PC's real printers", pri: "High",
          s: ["Open the printer name dropdown.", "Compare with Windows Settings → Printers."],
          e: "The same printers are listed. This only works when the backend runs on the till itself." },
        { id: 3, t: "Status is honest", pri: "High",
          s: ["Pick a printer, then switch that printer off / unplug it."],
          e: "The page shows Offline or Not installed — not a permanently green 'Connected'." },
        { id: 4, t: "Test print", pri: "Critical",
          s: ["Press Test print on the cashier printer."],
          e: "A short slip prints with no Windows print dialog appearing." },
        { id: 5, t: "Printer choice survives a restart", pri: "High",
          s: ["Save the printers, close the browser completely, reopen the till."],
          e: "The saved printer names are still there (they are stored per restaurant, not in the browser)." },
        { id: 6, t: "Bill prints with no dialog", pri: "Critical",
          s: ["Settle a bill on the till."],
          e: "The bill prints straight to the cashier printer. No Windows/Chrome print dialog." },
        { id: 7, t: "Printing off does not break the sale", pri: "Critical",
          s: ["Switch the printer off / remove the printer name, then settle a bill."],
          e: "The sale still completes and is saved. At worst the browser print dialog appears as a fallback. The bill must never be lost because paper failed." },
        { id: 8, t: "Receipt content is complete", pri: "High",
          s: ["Read a printed bill end to end."],
          e: "Restaurant name, bill number, date/time, table, every item with qty and amount, subtotal, GST, service, total, footer. Nothing cut off at the paper edge." },
        { id: 9, t: "58mm vs 80mm layout", pri: "Medium",
          s: ["Have the admin switch the paper size in Admin → Billing and print again."],
          e: "The slip re-flows to the narrower/wider width without wrapping mid-word or losing the right-hand amounts." },
        { id: 10, t: "Kitchen ticket (KOT) content", pri: "High",
          s: ["In dual-printer mode, send an order to the kitchen."],
          e: "The kitchen ticket prints on the KITCHEN printer with table, KOT number, items, quantities and cooking notes — and no prices." },
      ]
    },
    {
      id: "I", title: "Printer-mode matrix (ask Arthi to switch the mode in Admin → Settings)",
      note: "For each mode do BOTH a table order and a counter order. This matrix is the most error-prone part of the product.",
      cases: [
        { id: 1, t: "Dual printer — table order", pri: "Critical",
          s: ["Mode = Dual printer.", "Send a table order, then settle it."],
          e: "KOT prints on the kitchen printer when sent; the customer bill prints on the cashier printer at settle." },
        { id: 2, t: "Dual printer — counter order", pri: "Critical",
          s: ["Send & Bill a counter order."],
          e: "KOT on the kitchen printer at send, bill on the cashier printer at settle." },
        { id: 3, t: "Cashier + Kitchen Display — table order", pri: "Critical",
          s: ["Mode = Cashier printer + Kitchen Display.", "Send and settle a table order."],
          e: "NO kitchen ticket is printed at all (the kitchen screen shows it instead). Only the bill prints." },
        { id: 4, t: "Cashier + Kitchen Display — counter order", pri: "High",
          s: ["Send & Bill a counter order in this mode."],
          e: "Bill only, no KOT." },
        { id: 5, t: "Single printer — table order", pri: "Critical",
          s: ["Mode = Single printer.", "Send and settle a table order."],
          e: "Bill only — no KOT (the kitchen is told by hand)." },
        { id: 6, t: "Single printer — counter order", pri: "Critical",
          s: ["Send & Bill a counter order in single-printer mode."],
          e: "TWO slips on the one printer: the customer bill first, then the kitchen copy." },
        { id: 7, t: "Mode change reaches the till without a reload", pri: "High",
          s: ["Have the mode changed in admin while you sit on the cashier screen. Wait ~15 seconds."],
          e: "The cashier picks up the new mode by itself (it re-reads every 10s) — no F5 needed." },
        { id: 8, t: "Mode change reaches the waiter phone", pri: "High",
          s: ["Do the same while the waiter app is open."],
          e: "The waiter app follows the same rule — the two screens must never disagree about printing." },
      ]
    },
    {
      id: "J", title: "Kitchen display",
      cases: [
        { id: 1, t: "Board groups by table", pri: "High",
          s: ["With several tables open, look at the board."],
          e: "One card per table, table names in caps, plus separate Counter cards." },
        { id: 2, t: "Top table strip with pending badges", pri: "Medium",
          s: ["Look at the strip at the top and click a table name."],
          e: "The badge shows the number of unserved items and the click jumps to that card." },
        { id: 3, t: "New items appear on top with a NEW tag", pri: "High",
          s: ["Send an extra item to an existing table and watch the board."],
          e: "It appears at the top of that card with a NEW tag (which fades after ~90 seconds)." },
        { id: 4, t: "Serve strikes through and sinks", pri: "High",
          s: ["Press Serve on an item."],
          e: "It strikes through, marks ✓ served, and moves to the bottom of the card." },
        { id: 5, t: "Served count on the card header", pri: "Medium",
          s: ["Serve 2 of 5 items."],
          e: "The header reads 2/5 served, and the card highlights when all are served." },
        { id: 6, t: "Cooking notes are visible", pri: "High",
          s: ["Send an item with a note like 'less spicy'."],
          e: "The note shows next to the item on the kitchen card." },
        { id: 7, t: "Table drops off once billed", pri: "High",
          s: ["Bill that table from the waiter or cashier."],
          e: "The table's card disappears from the kitchen board automatically." },
        { id: 8, t: "Auto-refresh without reload", pri: "High",
          s: ["Leave the kitchen screen untouched and send a new order from the cashier."],
          e: "It appears within ~5 seconds with no manual refresh." },
        { id: 9, t: "Empty state", pri: "Low",
          s: ["Settle everything so no tables are active."],
          e: "A friendly 'No active tables' message, not a blank screen." },
        { id: 10, t: "Serving fails gracefully", pri: "Medium",
          s: ["Stop the backend, then press Serve on the kitchen board."],
          e: "An error message appears and the item does NOT stay wrongly struck through once the board reloads." },
      ]
    },
    {
      id: "K", title: "Android — installing the APK and connecting",
      cases: [
        { id: 1, t: "APK installs", pri: "Critical",
          s: ["Copy the latest APK to the phone and open it.", "Allow install from unknown sources when asked."],
          e: "Installs with no 'app not installed' / parse error. Record the APK file name and your Android version in Notes." },
        { id: 2, t: "Icon, name and splash", pri: "Low",
          s: ["Look at the launcher."],
          e: "The app is named InWallz Waiter with a proper icon (not the default Android robot)." },
        { id: 3, t: "First launch finds the till automatically", pri: "Critical",
          s: ["Connect the phone to the restaurant WiFi.", "Open the app for the first time."],
          e: "A 'searching' state, then the login screen — WITHOUT you typing any IP address. Record how many seconds the search took." },
        { id: 4, t: "Off the restaurant network it says so", pri: "High",
          s: ["Turn WiFi off, use mobile data only, force-stop and reopen the app."],
          e: "A clear 'not on the restaurant network' screen with a way to retry or exit — not a spinner forever and not a blank page." },
        { id: 5, t: "Reconnecting recovers by itself", pri: "High",
          s: ["From that blocked screen, go to Android WiFi settings, join the restaurant WiFi, return to the app."],
          e: "It re-checks on its own and lets you in without a force-stop." },
        { id: 6, t: "Manual IP entry (fallback)", pri: "Medium",
          s: ["If the app offers manual entry, choose it and type http://<PC-IP>:5000"],
          e: "It connects and remembers the address next launch." },
        { id: 7, t: "Address survives a router reboot", pri: "High",
          s: ["Reboot the router, reconnect both devices, reopen the app."],
          e: "The app finds the till again (this is why the PC needs a fixed IP)." },
        { id: 8, t: "Waiter login on the phone", pri: "Critical",
          s: ["Log in with the waiter credentials."],
          e: "Lands on the waiter Tables screen." },
        { id: 9, t: "A cashier account cannot use the app", pri: "High",
          s: ["Log in with the CASHIER username on the phone."],
          e: "Either it is refused, or it shows a screen the cashier is allowed to see — it must not open the waiter screen for a non-waiter or crash." },
      ]
    },
    {
      id: "L", title: "Android — waiter core flow",
      cases: [
        { id: 1, t: "Tables screen", pri: "High",
          s: ["Look at the tables grid."],
          e: "Stats at the top, tables two per row, each showing its status; occupied ones show an X/Y served chip." },
        { id: 2, t: "The logged-in waiter's real name is shown", pri: "High",
          s: ["Check the name/ID shown in the header and on the order screen."],
          e: "It is YOUR waiter account's name. If it says 'John' or 'Waiter ID: W102' on every phone, that is a defect — mark Fail." },
        { id: 3, t: "Open a table and browse the menu", pri: "Critical",
          s: ["Tap a free table."],
          e: "The menu grid opens with categories and a search box; images/labels are readable on the phone." },
        { id: 4, t: "Menu search across the whole menu", pri: "Medium",
          s: ["Type 3 letters of an item in another category."],
          e: "It is found regardless of the selected category." },
        { id: 5, t: "Quantity stepper", pri: "Critical",
          s: ["Tap + several times on a few items, then − to reduce."],
          e: "Counts are right and the grid does not shift or scroll-jump while tapping." },
        { id: 6, t: "Review & Send sheet", pri: "Critical",
          s: ["Tap the bottom bar Review & Send."],
          e: "A sheet lists everything with quantities and the total before you commit." },
        { id: 7, t: "Per-item cooking note on the phone", pri: "High",
          s: ["Add a note to one line only."],
          e: "The note attaches to that line alone and reaches the kitchen board." },
        { id: 8, t: "Send the order", pri: "Critical",
          s: ["Confirm the send."],
          e: "Success feedback, the table becomes Occupied, and the kitchen board shows it within ~5 seconds." },
        { id: 9, t: "'Already sent to kitchen' strip", pri: "High",
          s: ["Reopen the same table."],
          e: "Previously sent items are listed separately from anything new you add." },
        { id: 10, t: "Serve an item from the phone", pri: "High",
          s: ["Press Serve on a sent item."],
          e: "It marks served; the served chip on the table card and the cashier/kitchen screens all agree." },
        { id: 11, t: "🧾 Bill — edit before sending", pri: "Critical",
          s: ["Open Bill, change a quantity, cancel a line, add one item."],
          e: "The bill total recalculates correctly after each change." },
        { id: 12, t: "Confirm & Send to Cashier", pri: "Critical",
          s: ["Confirm the bill."],
          e: "The table turns Billing, shows the 🔒 lock on the tables screen, and the cashier is alerted." },
        { id: 13, t: "A billed table is locked", pri: "Critical",
          s: ["Try to open / add items to the billed table from the phone."],
          e: "It is locked until the cashier settles it." },
        { id: 14, t: "Cashier settles → table unlocks", pri: "Critical",
          s: ["Have the cashier settle it, then look at the phone."],
          e: "The table returns to Available on the phone within ~10 seconds and can take a new order." },
        { id: 15, t: "Full lifecycle end to end", pri: "Critical",
          s: ["Do the whole cycle once without stopping: waiter order → kitchen sees it → serve → waiter bills → cashier settles and prints."],
          e: "Every screen agrees at every step and the printed bill matches what the waiter entered. Record the time it took." },
      ]
    },
    {
      id: "M", title: "Resilience — the things that happen in a real restaurant",
      cases: [
        { id: 1, t: "Internet cable pulled, LAN alive", pri: "Critical",
          s: ["Disconnect the internet (keep the WiFi router on).", "Take a waiter order and settle a bill."],
          e: "Everything still works — billing must never depend on the internet." },
        { id: 2, t: "Backend restarted mid-service", pri: "High",
          s: ["With an order half-built on the phone, restart the backend service.", "Continue the order."],
          e: "The app recovers (possibly after an error message). The half-built order is not silently lost — note exactly what happens." },
        { id: 3, t: "Phone WiFi dropped mid-order", pri: "Critical",
          s: ["Build a 5-item order, turn WiFi off, press Send, turn WiFi back on, press Send again."],
          e: "Exactly one order is created. A duplicate kitchen ticket here is Critical." },
        { id: 4, t: "App backgrounded with a full cart", pri: "High",
          s: ["Build a 10-item cart, switch to another app for 2 minutes, come back."],
          e: "The cart is still there. If it is empty, that is a High defect — say so." },
        { id: 5, t: "App force-stopped with a full cart", pri: "High",
          s: ["Build a cart, force-stop the app from Android settings, reopen."],
          e: "Note whether the cart is restored. Record the actual behaviour either way." },
        { id: 6, t: "Two orders sent at the exact same second", pri: "High",
          s: ["Coordinate with Arthi: both phones press Send on different tables at once."],
          e: "Two distinct orders with two distinct order numbers. No mixed-up items, no repeated number." },
        { id: 7, t: "Long shift / session expiry", pri: "High",
          s: ["Leave the app logged in for 8+ hours (or ask Arun to shorten the token), then try to send an order."],
          e: "You are sent back to the login screen with a 'session expired' message — not stuck on 'Failed to place order' forever." },
        { id: 8, t: "Till PC switched off", pri: "Medium",
          s: ["Switch the PC off while the phone app is open, then try an action."],
          e: "A clear error/offline message. The app must not appear to succeed." },
        { id: 9, t: "Busy-service soak", pri: "High",
          s: ["Create 10 orders across tables and counter in ~15 minutes, serve, bill and settle them all."],
          e: "No slowdown, no wrong totals, no orphaned tables. Note anything that degrades." },
        { id: 10, t: "End-of-day figures match", pri: "Critical",
          s: ["After the soak, compare the cashier's Bills history total with Admin → Reports for today."],
          e: "The two totals match to the rupee. Write both numbers in Notes." },
      ]
    },
  ]
};

/* ------------------------------------------------------------------ *
 *  DOCUMENT 2 — ARTHI  (Admin + Super Admin on Windows, Android edges)
 * ------------------------------------------------------------------ */

const ARTHI = {
  file: "TEST-02-Arthi-Windows-Android.html",
  code: "AR",
  tester: "Arthi",
  devices: "Windows PC (browser) + Android phone",
  title: "InWallz POS — Test Report 2",
  scope: "Super Admin and the whole Admin panel on Windows, plus the Android waiter app's edge cases and multi-device behaviour.",
  brief: `
<p>You own <b>the back office</b> — every setting the restaurant owner touches — and
the <b>hard cases</b> on the waiter app (bad network, wrong input, two phones at once).
Abishek is testing the till and printers; you two will need each other for a few
rows, which are marked <i>with Abishek</i>.</p>
<p><b>You need:</b> a Windows PC with Chrome (plus Edge or Firefox for one section),
an Android phone on the same WiFi as the till PC, and the latest APK.</p>
<p><b>Please always try the wrong input too</b> — blank fields, negative prices,
duplicate names, very long text. Half the value of this round is finding what the
software accepts that it shouldn't.</p>`,
  sections: [
    {
      id: "A", title: "Environment & setup",
      cases: [
        { id: 1, t: "Reach the app", pri: "Critical",
          s: ["Open http://<TILL-PC-IP>:5000 (or the URL Arun gives you) in Chrome."],
          e: "The login page loads. Write the exact URL and today's build/APK name in the header box." },
        { id: 2, t: "Super admin login", pri: "Critical",
          s: ["Log in as inwallz / Admin@123."],
          e: "Lands on the Super Admin panel." },
        { id: 3, t: "Admin login", pri: "Critical",
          s: ["Log in with the admin account for the test restaurant."],
          e: "Lands on /admin/dashboard with the sidebar visible." },
        { id: 4, t: "Test data present", pri: "High",
          s: ["Check Menu, Categories, Tables, Employees have rows."],
          e: "Enough data to test with. If anything is empty, ask Arun before continuing." },
      ]
    },
    {
      id: "B", title: "Super Admin panel",
      cases: [
        { id: 1, t: "Stat cards are correct", pri: "Medium",
          s: ["Count the rows in the Registered Admins table.", "Compare with Total / Active / Inactive cards."],
          e: "Total equals the row count; active + inactive equals total." },
        { id: 2, t: "Create an admin — happy path", pri: "Critical",
          s: ["Fill Restaurant Name, Owner Name, Mobile, Username, Password and submit."],
          e: "A success message, the form clears, and the new admin appears in the table immediately." },
        { id: 3, t: "The new admin can log in", pri: "Critical",
          s: ["Log out and log in with the account you just created."],
          e: "It works and lands on that restaurant's admin dashboard, which starts empty (its own menu/tables)." },
        { id: 4, t: "Tenant isolation", pri: "Critical",
          s: ["Inside the NEW restaurant's admin, open Menu, Tables, Orders, Reports."],
          e: "You see none of the other restaurant's data. Any leakage across restaurants is Critical." },
        { id: 5, t: "Required fields", pri: "Medium",
          s: ["Submit the create form with each field left blank in turn."],
          e: "Each blank field is blocked with a visible message." },
        { id: 6, t: "Duplicate username", pri: "High",
          s: ["Create an admin using a username that already exists."],
          e: "A clear 'username already taken' message. No duplicate row, no server error." },
        { id: 7, t: "Mobile number validation", pri: "Medium",
          s: ["Enter 'abcdefg' as the mobile number, then '1', then a 25-digit number."],
          e: "Invalid mobiles are rejected. Note exactly which of these were accepted — the field is plain text today." },
        { id: 8, t: "Weak / short password", pri: "Medium",
          s: ["Create an admin with the password '1'."],
          e: "Note whether it is accepted. A minimum-length rule is expected." },
        { id: 9, t: "Password field is masked", pri: "High",
          s: ["Type the password and look at the field."],
          e: "Dots, not plain text." },
        { id: 10, t: "Special characters and long names", pri: "Low",
          s: ["Create an admin with a 200-character restaurant name and one with emoji/Tamil characters."],
          e: "Either accepted and displayed correctly, or rejected cleanly. No broken layout, no ???? characters." },
        { id: 11, t: "Delete asks for confirmation", pri: "High",
          s: ["Press Delete on a test admin and choose Cancel."],
          e: "A confirmation appears and cancelling changes nothing." },
        { id: 12, t: "Delete works", pri: "High",
          s: ["Delete the test admin and confirm."],
          e: "The row disappears and the counts update. Then try to log in as that admin — it must fail." },
        { id: 13, t: "Edit button", pri: "Medium",
          s: ["Press Edit on any admin row."],
          e: "Record what happens. If nothing happens at all, mark Fail — a dead button on screen is a defect." },
        { id: 14, t: "Super admin logout", pri: "Medium",
          s: ["Log out, then press browser Back."],
          e: "You stay logged out." },
      ]
    },
    {
      id: "C", title: "Admin — dashboard",
      cases: [
        { id: 1, t: "Dashboard cards load", pri: "High",
          s: ["Open /admin/dashboard."],
          e: "Sales/orders/other cards show numbers (or a clean zero state), not 'undefined' or NaN." },
        { id: 2, t: "Sales chart renders", pri: "Medium",
          s: ["Look at the chart."],
          e: "Axes, labels and bars/lines are drawn and readable; hovering shows values." },
        { id: 3, t: "Recent orders list", pri: "High",
          s: ["Have an order created on the till, then refresh the dashboard."],
          e: "The new order appears in Recent Orders with the right amount and table." },
        { id: 4, t: "Top selling items", pri: "Medium",
          s: ["Compare with Reports → Top Selling for the same period."],
          e: "The two lists agree." },
        { id: 5, t: "Table status widget", pri: "High",
          s: ["Occupy a table on the till and refresh."],
          e: "The dashboard shows the same status as the cashier screen." },
        { id: 6, t: "Restaurant open/closed status", pri: "Medium",
          s: ["In Settings set opening/closing times so that NOW is outside them, then reload the dashboard."],
          e: "The restaurant shows Closed; set it back and it shows Open." },
        { id: 7, t: "Connection / printer status widgets", pri: "Medium",
          s: ["Look at the connection and printer status indicators."],
          e: "They reflect reality — stop the backend briefly and confirm the connection indicator notices." },
        { id: 8, t: "Notifications panel", pri: "Low",
          s: ["Open the notifications panel."],
          e: "It opens and closes; content is relevant or an honest empty state." },
        { id: 9, t: "Quick actions", pri: "Medium",
          s: ["Click each quick-action button."],
          e: "Each one goes where its label promises." },
        { id: 10, t: "Error state has a Retry", pri: "Medium",
          s: ["Stop the backend and reload the dashboard."],
          e: "'Unable to load dashboard data' with a working Retry button — and Retry actually recovers once the backend is back." },
      ]
    },
    {
      id: "D", title: "Admin — Employees",
      cases: [
        { id: 1, t: "Employee list loads", pri: "High", s: ["Open Employees."], e: "Existing staff are listed with role and status." },
        { id: 2, t: "Add a waiter", pri: "Critical",
          s: ["Add an employee with role Waiter and fill every field."],
          e: "Saved, appears in the list, and a success modal shows the generated username/password." },
        { id: 3, t: "The new waiter can log in", pri: "Critical",
          s: ["Use those credentials on the waiter app or the web login."],
          e: "Login succeeds and lands on the waiter screen." },
        { id: 4, t: "Add a cashier and a kitchen user", pri: "High",
          s: ["Repeat for the Cashier and Kitchen roles."],
          e: "Each lands on its own screen when logging in — cashier on the POS, kitchen on the board." },
        { id: 5, t: "Username pattern", pri: "Medium",
          s: ["Look at the generated usernames."],
          e: "They follow name_role@restaurant and are unique." },
        { id: 6, t: "Duplicate employee", pri: "High",
          s: ["Add an employee with exactly the same name/role again."],
          e: "Either a clear duplicate warning or a distinct username. No crash, no two identical logins." },
        { id: 7, t: "Required fields", pri: "Medium", s: ["Submit the form empty."], e: "Blocked with per-field messages." },
        { id: 8, t: "Edit an employee", pri: "High",
          s: ["Change a name/phone and save, then reload the page."],
          e: "The change persisted." },
        { id: 9, t: "Delete an employee", pri: "High",
          s: ["Delete a test employee and confirm."],
          e: "Removed from the list; that login no longer works." },
        { id: 10, t: "Delete an employee who has orders", pri: "High",
          s: ["Delete a waiter who already placed orders today.", "Then open Reports → Staff and Orders."],
          e: "Old orders still show correctly (they must not vanish or show blank staff). Note what happens." },
        { id: 11, t: "Filters and search", pri: "Medium",
          s: ["Filter by role and by status; search a name."],
          e: "Results are correct and clearing the filter restores the full list." },
        { id: 12, t: "Card / table view", pri: "Low", s: ["Switch between the card and table views."], e: "Both show the same people with the same details." },
      ]
    },
    {
      id: "E", title: "Admin — Categories",
      cases: [
        { id: 1, t: "Add a category", pri: "High", s: ["Add 'Test Beverages' and save."], e: "It appears in the list and in the Menu page's category dropdown." },
        { id: 2, t: "Duplicate category name", pri: "Medium", s: ["Add the same name again."], e: "Rejected with a clear message." },
        { id: 3, t: "Blank name", pri: "Medium", s: ["Save with an empty name."], e: "Blocked." },
        { id: 4, t: "Edit a category", pri: "High", s: ["Rename it and save; reload."], e: "The new name shows everywhere, including on menu items already in it." },
        { id: 5, t: "Delete an empty category", pri: "Medium", s: ["Delete a category with no items."], e: "Confirmation, then removal." },
        { id: 6, t: "Delete a category that HAS items", pri: "Critical",
          s: ["Try to delete a category with menu items in it.", "Then check the Menu page and the cashier's menu grid."],
          e: "Either it is blocked with a warning, or the items are handled sensibly. Items must NOT disappear silently from the cashier's menu." },
        { id: 7, t: "Category order on the till", pri: "Low",
          s: ["Compare the category order in admin with the cashier and waiter screens."],
          e: "The same order everywhere." },
      ]
    },
    {
      id: "F", title: "Admin — Menu",
      cases: [
        { id: 1, t: "Menu list and counts", pri: "High", s: ["Open Menu."], e: "Items listed; the 'Total Items' / 'Available' / 'Unavailable' counts match the rows." },
        { id: 2, t: "Add an item — all fields", pri: "Critical",
          s: ["Add an item with name, category, price, Veg, availability, image, timing."],
          e: "Saved and immediately orderable on the cashier and waiter screens (within ~10s)." },
        { id: 3, t: "Price validation", pri: "Critical",
          s: ["Try to save an item with price 0, then -50, then 'abc', then 99999999."],
          e: "Negative and non-numeric prices are rejected. Note anything that gets through — a negative price reaches real bills." },
        { id: 4, t: "Decimal price", pri: "High",
          s: ["Save an item at 99.50 and order it on the till."],
          e: "The bill shows 99.50, not 99 or 100." },
        { id: 5, t: "Food type flags", pri: "Medium",
          s: ["Create one Veg, one Non-Veg and one Egg item."],
          e: "The correct coloured dot/label shows on admin, cashier and the waiter app." },
        { id: 6, t: "Availability toggle", pri: "High",
          s: ["Mark an item unavailable."],
          e: "It cannot be ordered on the till or the phone within ~10 seconds." },
        { id: 7, t: "Special / best seller / featured flags", pri: "Medium",
          s: ["Set each flag on different items."],
          e: "The flags persist after reload and show wherever they are meant to." },
        { id: 8, t: "Edit an item's price", pri: "Critical",
          s: ["Change a price, save, then order that item on the till."],
          e: "The bill uses the NEW price. Also check an order placed BEFORE the change still shows the old price it was charged." },
        { id: 9, t: "Delete an item", pri: "High",
          s: ["Delete a test item."],
          e: "Gone from admin and from the till menus; past orders containing it still display correctly." },
        { id: 10, t: "Filters", pri: "Medium", s: ["Filter by category, food type and status, and combine two filters."], e: "Results are correct; clearing restores everything." },
        { id: 11, t: "Search", pri: "Medium", s: ["Search a partial name, then a name that does not exist."], e: "Matches shown; a clean 'No Menu Items' state for no match." },
        { id: 12, t: "Pagination", pri: "Medium", s: ["Go to page 2, then back to page 1 (add items first if needed)."], e: "Pages hold the right rows and no row appears on two pages." },
        { id: 13, t: "Very long item name", pri: "Low",
          s: ["Add an item with a 120-character name and order it."],
          e: "The table, the cashier grid and the printed bill all cope — nothing overflows or is cut mid-layout." },
        { id: 14, t: "Image upload", pri: "Medium",
          s: ["Upload a large photo (3–5 MB) as an item image."],
          e: "It is accepted (or clearly rejected with a size limit) and the page does not become slow." },
        { id: 15, t: "Item timing", pri: "Medium",
          s: ["Set an item to a timing window that excludes right now."],
          e: "Note whether it is hidden/blocked on the till outside that window." },
      ]
    },
    {
      id: "G", title: "Admin — Tables",
      cases: [
        { id: 1, t: "Table list and stats", pri: "High", s: ["Open Tables."], e: "All tables shown with capacity and status; the stats row matches." },
        { id: 2, t: "Add a table", pri: "High", s: ["Add table 'T9' with capacity 4."], e: "Appears here and as a chip on the cashier screen and the waiter app within ~10s." },
        { id: 3, t: "Duplicate table name", pri: "Medium", s: ["Add 'T9' again."], e: "Rejected clearly." },
        { id: 4, t: "Invalid capacity", pri: "Medium", s: ["Try capacity 0, -2 and 'x'."], e: "Rejected." },
        { id: 5, t: "Edit a table", pri: "Medium", s: ["Rename it and change capacity; reload."], e: "Saved, and the new name shows on the till and phone." },
        { id: 6, t: "Table details modal", pri: "Medium", s: ["Open the details of an occupied table."], e: "Shows the current order/status truthfully." },
        { id: 7, t: "Delete a free table", pri: "Medium", s: ["Delete T9 while it is free."], e: "Removed everywhere." },
        { id: 8, t: "Delete an OCCUPIED table", pri: "Critical",
          s: ["Have an open order on a table (ask Abishek), then try to delete it."],
          e: "Blocked with a warning. If it deletes, find out what happened to the open order and report it as Critical." },
        { id: 9, t: "Status filter", pri: "Low", s: ["Filter by Available / Occupied / Billed."], e: "Correct tables in each filter." },
      ]
    },
    {
      id: "H", title: "Admin — Orders",
      cases: [
        { id: 1, t: "Orders list loads", pri: "High", s: ["Open Orders after some test orders exist."], e: "Rows with order id, table, type, status, payment, staff, amount, time." },
        { id: 2, t: "A brand-new order appears", pri: "High", s: ["Have an order placed on the till, then refresh."], e: "It is in the list with the right amount and the correct staff name." },
        { id: 3, t: "Status filter", pri: "Medium", s: ["Filter by each status in turn."], e: "Only matching orders show." },
        { id: 4, t: "Order type filter", pri: "Medium", s: ["Filter Dine-in / Takeaway / Delivery."], e: "Correct results; counter/walk-in orders are categorised sensibly." },
        { id: 5, t: "Payment filter", pri: "Medium", s: ["Filter Paid vs Pending."], e: "A settled bill shows Paid; an open table shows Pending." },
        { id: 6, t: "Combined filters + search", pri: "Medium", s: ["Combine two filters and a search term."], e: "Correct narrowing; clearing restores the list." },
        { id: 7, t: "Order details modal", pri: "High",
          s: ["Open an order's details and compare with the printed bill Abishek has."],
          e: "Items, quantities, notes and totals match the paper exactly." },
        { id: 8, t: "Cancelled order shown correctly", pri: "High",
          s: ["Have an order cancelled on the till, then look here."],
          e: "It appears as Cancelled and is EXCLUDED from revenue figures." },
        { id: 9, t: "Pagination", pri: "Medium", s: ["Page through the list."], e: "No duplicated or skipped rows between pages." },
        { id: 10, t: "Error + Retry", pri: "Medium", s: ["Stop the backend and reload."], e: "An error with a Retry that works once the backend returns." },
      ]
    },
    {
      id: "I", title: "Admin — Charges (tax & extra charges)",
      cases: [
        { id: 1, t: "Charges page loads", pri: "High", s: ["Open Charges."], e: "Existing charges (GST, service) are listed with type and value." },
        { id: 2, t: "Add a percentage charge", pri: "Critical",
          s: ["Add a 10% 'Test Packing' charge and save.", "Ask Abishek to make a ₹1000 bill."],
          e: "The bill shows exactly ₹100 for that charge and the total includes it." },
        { id: 3, t: "Add a fixed charge", pri: "Critical",
          s: ["Add a flat ₹20 charge and make another bill."],
          e: "Exactly ₹20 is added regardless of bill size." },
        { id: 4, t: "Invalid values", pri: "High", s: ["Try -5%, 0, 500% and 'abc'."], e: "Rejected. A negative charge on a real bill would be Critical." },
        { id: 5, t: "Edit a charge", pri: "High", s: ["Change 10% to 5% and make a new bill."], e: "New bills use 5%; already-settled bills keep what they were charged." },
        { id: 6, t: "Delete a charge", pri: "High", s: ["Delete the test charge and make a new bill."], e: "It is gone from new bills; old bills are unchanged." },
        { id: 7, t: "Bill preview", pri: "Medium", s: ["Use the on-page bill preview."], e: "The preview maths matches what the till actually prints." },
        { id: 8, t: "Menu pricing section", pri: "Medium", s: ["Open the menu pricing section and change a setting."], e: "It saves and behaves as labelled — describe what it does in Notes." },
        { id: 9, t: "GST split (CGST/SGST)", pri: "High",
          s: ["Make a bill and check Reports → Tax."],
          e: "CGST and SGST each equal half of the total GST and add up to the GST on the bill." },
      ]
    },
    {
      id: "J", title: "Admin — Billing format (bill print customisation)",
      note: "Each toggle here changes real printed paper. After changing a toggle, ask Abishek to print — or at least use the on-screen preview.",
      cases: [
        { id: 1, t: "Page loads with all 7 sections", pri: "High", s: ["Open Billing."], e: "Paper size, header/branding, order info, item columns, summary/taxes, payment, footer are all present." },
        { id: 2, t: "Paper size 58mm / 80mm / A4", pri: "High", s: ["Switch between all three and watch the preview."], e: "The preview re-flows for each; nothing is cut off." },
        { id: 3, t: "Restaurant header fields", pri: "Medium", s: ["Set name, tagline, address, phone, email, GSTIN, FSSAI."], e: "Each appears on the preview when its toggle is on and disappears when off." },
        { id: 4, t: "Logo on / off", pri: "Medium", s: ["Toggle the logo and pick No Logo."], e: "The preview follows." },
        { id: 5, t: "Every 'Show ...' toggle", pri: "High",
          s: ["Turn each Show toggle off one at a time (date, time, bill #, table, cashier, customer, GST, charges, grand total) and watch the preview."],
          e: "Each toggle hides exactly its own line and nothing else. List any toggle that does nothing." },
        { id: 6, t: "Item line columns", pri: "Medium", s: ["Turn item columns (qty, rate, amount) on and off."], e: "The preview columns change accordingly and stay aligned." },
        { id: 7, t: "Footer / terms text", pri: "Medium", s: ["Type a custom footer including a line break."], e: "It shows on the preview and on paper." },
        { id: 8, t: "Save and persist", pri: "Critical", s: ["Save, reload the page, then log out and back in."], e: "Every setting is retained." },
        { id: 9, t: "Settings reach the till", pri: "Critical", s: ["Ask Abishek to print a bill after your change."], e: "The paper follows your settings without him restarting anything." },
        { id: 10, t: "Print preview button", pri: "Medium", s: ["Use the page's own print preview."], e: "The browser print dialog opens with the bill laid out correctly (a preview using the dialog is expected here)." },
        { id: 11, t: "Very long footer / restaurant name", pri: "Low", s: ["Enter a 300-character footer."], e: "It wraps sensibly rather than breaking the layout or being cut off." },
      ]
    },
    {
      id: "K", title: "Admin — Kitchen template (KOT print customisation)",
      cases: [
        { id: 1, t: "Page loads with its 4 sections", pri: "High", s: ["Open Kitchen Template."], e: "Roll size, header/order info, item details, footer message all present." },
        { id: 2, t: "Roll size", pri: "Medium", s: ["Switch 58mm / 80mm / standard."], e: "The live preview updates immediately." },
        { id: 3, t: "Header and order info toggles", pri: "High", s: ["Toggle KOT number, date, time, table, waiter, order type, customer, phone, address, logo, restaurant name."], e: "Each toggle changes exactly its own line in the preview." },
        { id: 4, t: "Item detail toggles", pri: "High", s: ["Toggle item name, quantity, category."], e: "Preview follows. Prices should NOT appear on a kitchen ticket." },
        { id: 5, t: "Kitchen footer text", pri: "Medium", s: ["Add an instruction line and save."], e: "It shows on the preview and on the printed KOT." },
        { id: 6, t: "Save and persist", pri: "High", s: ["Save, reload, log out and back in."], e: "Settings retained." },
        { id: 7, t: "Reaches the real KOT", pri: "High", s: ["Ask Abishek (dual-printer mode) to send an order."], e: "The kitchen ticket matches your template." },
        { id: 8, t: "Cooking notes always print", pri: "Critical", s: ["Send an item with a note."], e: "The note is on the kitchen ticket regardless of the other toggles — the kitchen must never miss it." },
      ]
    },
    {
      id: "L", title: "Admin — Reports",
      note: "Reports is where wrong maths hurts most. Please cross-check the numbers by hand at least once.",
      cases: [
        { id: 1, t: "Reports page loads", pri: "High", s: ["Open Reports."], e: "Overview cards, charts and tables render with no NaN / undefined / blank areas." },
        { id: 2, t: "Today", pri: "Critical",
          s: ["Select Today.", "Add up today's settled bills by hand from Orders."],
          e: "Total revenue and total orders match your manual count exactly. Write both numbers in Notes." },
        { id: 3, t: "This Week / Last Week / This Month / Last Month", pri: "High",
          s: ["Select each range in turn."],
          e: "The date range shown is right and the figures only grow as the window widens." },
        { id: 4, t: "Custom date range", pri: "High", s: ["Pick a custom from/to range covering only yesterday."], e: "Only that day's data is included." },
        { id: 5, t: "End date before start date", pri: "Medium", s: ["Set the To date earlier than the From date."], e: "Blocked or corrected with a message — not an empty screen or an error." },
        { id: 6, t: "A range with no data", pri: "Medium", s: ["Pick a range from last year."], e: "A clean zero/empty state, not NaN or a crash." },
        { id: 7, t: "Average order value", pri: "High", s: ["Check Average Order = revenue ÷ paid orders with a calculator."], e: "The maths is right." },
        { id: 8, t: "Paid vs pending", pri: "Critical",
          s: ["Leave one table unsettled, then read Paid Amount and Pending Amount."],
          e: "The open bill is in Pending, not in Paid. Paid + Pending equals total order value." },
        { id: 9, t: "Cancelled orders excluded", pri: "Critical", s: ["Cancel an order, then reload Reports."], e: "Cancelled Orders count goes up and revenue does NOT include it." },
        { id: 10, t: "Payment method breakdown", pri: "High", s: ["Settle bills by cash, card and UPI, then check the Payments section."], e: "Each method's total is right and they sum to the paid total." },
        { id: 11, t: "Top selling items", pri: "Medium", s: ["Order one item many times, then reload."], e: "It rises to the top with the correct quantity." },
        { id: 12, t: "Staff report", pri: "Medium", s: ["Have two different waiters place orders."], e: "Each waiter's orders and revenue are attributed to the right person." },
        { id: 13, t: "Tax section (CGST/SGST)", pri: "High", s: ["Compare the tax totals with the GST on the bills."], e: "They agree; CGST = SGST = half the GST." },
        { id: 14, t: "Additional charges collected", pri: "Medium", s: ["After adding a test charge, check this section."], e: "It shows the charge collected across the period." },
        { id: 15, t: "Discounts section", pri: "Medium", s: ["Apply a discount on the till if possible, then check here."], e: "The discount is reported and revenue is net of it." },
        { id: 16, t: "Order types split", pri: "Medium", s: ["Compare dine-in vs counter counts with what Abishek actually created."], e: "They match." },
        { id: 17, t: "Show More / Show Less", pri: "Low", s: ["Expand and collapse the long tables."], e: "Works both ways with no layout break." },
        { id: 18, t: "Reports refresh after new activity", pri: "High", s: ["Have a new bill settled, then reload Reports for Today."], e: "The new bill is included." },
      ]
    },
    {
      id: "M", title: "Admin — Settings",
      cases: [
        { id: 1, t: "All setting blocks load", pri: "High", s: ["Open Settings."], e: "Restaurant profile, printer setup, security/password, staff & permissions and approvals all load (no block stuck on 'Loading…')." },
        { id: 2, t: "Restaurant profile saves", pri: "High", s: ["Change name, address, phone, email, GST number, currency; save; reload."], e: "All retained, and the new name shows on the printed bill." },
        { id: 3, t: "Logo upload / remove", pri: "Medium", s: ["Upload a logo, save, then remove it."], e: "Both work and are reflected on the bill preview." },
        { id: 4, t: "Opening / closing time", pri: "Medium", s: ["Set times and save."], e: "The dashboard's Open/Closed indicator follows them." },
        { id: 5, t: "Restaurant status Active / Closed", pri: "High", s: ["Set the restaurant to Closed."], e: "Note what changes on the till and the waiter app — describe the actual effect in Notes." },
        { id: 6, t: "Printer setup — Dual printer", pri: "Critical", s: ["Select Cashier printer + kitchen printer and save."], e: "Saved; Abishek's Printer page now shows TWO printer boxes." },
        { id: 7, t: "Printer setup — Cashier + Kitchen Display", pri: "Critical", s: ["Select it and save."], e: "Abishek's page shows ONE box, and no kitchen tickets print." },
        { id: 8, t: "Printer setup — Single printer", pri: "Critical", s: ["Select it and save."], e: "ONE box, and a counter order prints the customer bill then the kitchen bill on the same printer." },
        { id: 9, t: "Mode persists", pri: "High", s: ["Reload and log out/in."], e: "The chosen mode is still selected." },
        { id: 10, t: "Change admin password — wrong current password", pri: "High", s: ["Enter a wrong current password."], e: "Rejected with a clear message; the password is unchanged." },
        { id: 11, t: "Change admin password — mismatch", pri: "High", s: ["Enter new and confirm that do not match."], e: "Blocked before submitting." },
        { id: 12, t: "Change admin password — success", pri: "Critical",
          s: ["Change it properly, log out, log in with the NEW password, then try the OLD one."],
          e: "New works, old is refused. (Tell Arun the new password.)" },
        { id: 13, t: "Staff & permissions roles list", pri: "Medium", s: ["Open the roles section."], e: "Roles are listed with their permissions; changing one saves." },
        { id: 14, t: "Approval — cancel order", pri: "Critical",
          s: ["Turn ON 'require admin approval' for cancel order.", "Ask Abishek (cashier) to cancel an order."],
          e: "He is refused with 'requires admin approval'. Turn it off and he can cancel again." },
        { id: 15, t: "Approval — discount", pri: "High", s: ["Turn on discount approval and have the cashier try to apply a discount."], e: "Refused with the approval message; allowed again when off." },
        { id: 16, t: "Approval — refund", pri: "High", s: ["Same for refunds."], e: "Refused while on." },
        { id: 17, t: "Approval — menu price change", pri: "High", s: ["Same for menu price change by a non-admin."], e: "Refused while on." },
        { id: 18, t: "Admin is never blocked by approvals", pri: "High", s: ["With every approval toggle ON, do those same actions as the ADMIN."], e: "The admin can always do them." },
      ]
    },
    {
      id: "N", title: "Admin — navigation, broken links & general UI",
      note: "Two sidebar links are known to point at pages that do not exist yet. Confirm what actually happens so we can size the fix.",
      cases: [
        { id: 1, t: "Every sidebar link opens its page", pri: "High",
          s: ["Click all 13 sidebar links one by one: Dashboard, Restaurant, Employees, Menu, Categories, Tables, Customers, Orders, Charges, Billing, Kitchen Template, Reports, Settings."],
          e: "Each opens its own page. List in Notes every link that does NOT." },
        { id: 2, t: "Sidebar 'Restaurant'", pri: "High",
          s: ["Click Restaurant."],
          e: "Record exactly what happens — page, blank screen, or a bounce back to the dashboard. A dead menu item is a defect." },
        { id: 3, t: "Sidebar 'Customers'", pri: "High", s: ["Click Customers."], e: "Same — record the exact behaviour." },
        { id: 4, t: "Active link highlight", pri: "Low", s: ["Move between pages."], e: "The current page is highlighted in the sidebar." },
        { id: 5, t: "Sidebar collapse", pri: "Low", s: ["Collapse and expand the sidebar."], e: "Works and the content reflows without overlapping." },
        { id: 6, t: "Browser Back/Forward", pri: "Medium", s: ["Navigate 4 pages deep then use Back and Forward."], e: "Each step lands on the right page with its data loaded." },
        { id: 7, t: "Direct URL to a deep page", pri: "Medium", s: ["Paste http://<host>/admin/reports into a fresh tab while logged in."], e: "It opens Reports directly." },
        { id: 8, t: "Refresh on every page", pri: "High", s: ["Press F5 on each admin page."], e: "No page loses its data or throws a blank screen." },
        { id: 9, t: "Two admin tabs at once", pri: "Medium", s: ["Open Menu in two tabs, edit an item in one, reload the other."], e: "The second tab shows the change; no stale-data corruption." },
        { id: 10, t: "Slow network", pri: "Medium", s: ["Chrome DevTools → Network → Slow 3G, then load Reports."], e: "A loading state appears; the page recovers rather than showing a permanent blank." },
        { id: 11, t: "Console errors", pri: "Medium", s: ["Open DevTools Console (F12) and walk through every admin page."], e: "Note any red errors, with the page name and the message text." },
      ]
    },
    {
      id: "O", title: "Android — waiter app edge cases (your device)",
      note: "Abishek covers the happy path. You cover everything that goes wrong.",
      cases: [
        { id: 1, t: "APK installs on your phone", pri: "High", s: ["Install the latest APK; note your phone model and Android version."], e: "Installs and opens." },
        { id: 2, t: "Waiter login on your phone", pri: "Critical", s: ["Log in as a DIFFERENT waiter from Abishek's."], e: "Lands on the Tables screen." },
        { id: 3, t: "Two phones show two different names", pri: "High",
          s: ["Compare the waiter name shown on your phone with Abishek's."],
          e: "They differ. If both say the same hardcoded name, that is a defect — mark Fail." },
        { id: 4, t: "Hardware Back button", pri: "High",
          s: ["From the cart, press Back. From the menu, press Back. From the tables screen, press Back."],
          e: "Cart → menu → tables → a confirm-exit prompt. If Back quits the app straight from the cart, mark Fail and say from which screen." },
        { id: 5, t: "Rotate the phone", pri: "Medium", s: ["Rotate to landscape on the tables and menu screens."], e: "The layout still works and the cart is not lost." },
        { id: 6, t: "Small screen layout", pri: "Medium",
          s: ["Set the phone's display size/font to the largest setting, then check the stats row and bottom status bar."],
          e: "Nothing overlaps or is cut off." },
        { id: 7, t: "Buttons stay 'pressed' after a tap", pri: "Medium",
          s: ["Tap several buttons and look at them afterwards."],
          e: "No button stays highlighted as if hovered after your finger leaves." },
        { id: 8, t: "Blocking popups", pri: "Medium",
          s: ["Trigger an error (e.g. send with the WiFi off)."],
          e: "Note whether you get a native blocking dialog that freezes the screen, or a friendly toast/banner." },
        { id: 9, t: "Offline indication", pri: "High",
          s: ["Turn WiFi off while on the tables screen."],
          e: "There is a visible offline banner/state — you can tell 'no network' apart from 'server said no'." },
        { id: 10, t: "Actions while offline", pri: "Critical",
          s: ["With WiFi off, add items and press Send."],
          e: "You get a clear failure. The app must NOT claim success for an order the server never received." },
        { id: 11, t: "Battery / background traffic", pri: "Medium",
          s: ["Leave the app in the background for 15 minutes, then check Android's battery usage for it."],
          e: "It should not be polling constantly in the background. Note the battery percentage used." },
        { id: 12, t: "Serve while the server rejects it", pri: "High",
          s: ["Stop the backend, press Serve on an item, then start the backend and wait ~10s."],
          e: "The item does NOT stay showing as served when the server never accepted it." },
        { id: 13, t: "Remove several bill lines at once", pri: "High",
          s: ["On the bill screen, remove 3 lines quickly one after another."],
          e: "All 3 are removed and the total is right. A half-removed bill is a High defect." },
        { id: 14, t: "Session expiry on the phone", pri: "High",
          s: ["Ask Arun for a short-lived token, or leave it logged in overnight, then act."],
          e: "You are returned to login with a 'session expired' message rather than an endless 'failed' error." },
        { id: 15, t: "Very long item names on the phone", pri: "Low", s: ["Add the 120-character item you created in the Menu tests."], e: "The card and cart display it without breaking the grid." },
      ]
    },
    {
      id: "P", title: "Multi-device & concurrency (do these together with Abishek)",
      cases: [
        { id: 1, t: "Two waiters, two tables", pri: "Critical",
          s: ["Both phones order on different tables at the same time."],
          e: "Two separate orders, correct items on each, correct waiter attributed." },
        { id: 2, t: "Two waiters, the SAME table", pri: "Critical",
          s: ["Both phones open the same table and both send items."],
          e: "Both sets of items end up on ONE table order. Nothing is overwritten or lost." },
        { id: 3, t: "Waiter and cashier edit the same bill", pri: "Critical",
          s: ["You open the bill on the phone while Abishek edits the same bill on the till; both save."],
          e: "The final bill is coherent and the total is correct. Describe exactly what you saw." },
        { id: 4, t: "Cashier settles while the waiter is on the table", pri: "High",
          s: ["Sit on the table screen while Abishek settles it."],
          e: "Your phone updates to Available within ~10 seconds and does not let you add to a settled order." },
        { id: 5, t: "Admin edits a price mid-order", pri: "High",
          s: ["Change an item's price while that item sits in an unsent cart on the phone, then send."],
          e: "Note which price the bill uses. It must be consistent between the phone, the till and the report." },
        { id: 6, t: "Admin makes an item unavailable mid-order", pri: "High",
          s: ["Mark an item unavailable while it is in a waiter's cart, then send."],
          e: "Either a clear message, or the order goes through — but never a silent partial order." },
        { id: 7, t: "Kitchen serves while the waiter serves", pri: "Medium",
          s: ["Press Serve on the same item from the kitchen screen and the phone at the same moment."],
          e: "It ends up served once. No error, no double count." },
      ]
    },
    {
      id: "Q", title: "Security & permissions",
      cases: [
        { id: 1, t: "Admin cannot open super-admin pages", pri: "Critical", s: ["As admin, open /super_admin directly."], e: "Refused / redirected." },
        { id: 2, t: "Waiter cannot open admin pages", pri: "Critical", s: ["Log in as waiter in a browser and open /admin/reports."], e: "Refused / redirected." },
        { id: 3, t: "Kitchen cannot open the cashier screen", pri: "High", s: ["As kitchen, open /cashier."], e: "Refused / redirected." },
        { id: 4, t: "Logged-out access", pri: "Critical", s: ["Log out, then paste /admin/dashboard in a clean tab."], e: "You get the login page, never the dashboard." },
        { id: 5, t: "Tampered session", pri: "Critical",
          s: ["In DevTools → Application → Local Storage, change the stored user role from 'cashier' to 'admin', then reload."],
          e: "The server still refuses admin data. Seeing a working admin page here is Critical — screenshot it." },
        { id: 6, t: "Text that looks like code", pri: "High",
          s: ["Save a menu item named <script>alert(1)</script> and view it on admin, cashier and the phone."],
          e: "It shows as plain text everywhere. No popup, no broken page." },
        { id: 7, t: "SQL-looking input", pri: "High", s: ["Use  ' OR 1=1 --  as a username on the login page and in a search box."], e: "A normal failed login / no results. Never a database error message on screen." },
        { id: 8, t: "Password is never visible", pri: "High", s: ["Check the employee list, the API responses in DevTools → Network, and the success modal."], e: "No password hash or plain password is exposed anywhere it shouldn't be." },
        { id: 9, t: "Repeated wrong logins", pri: "Medium", s: ["Enter a wrong password 15 times quickly."], e: "Note whether there is any rate limit or lockout. Record the behaviour." },
      ]
    },
  ]
};

/* ------------------------------------------------------------------ *
 *  DOCUMENT 3 — RAHUL  (Mac + iOS, web only)
 * ------------------------------------------------------------------ */

const RAHUL = {
  file: "TEST-03-Rahul-Mac-iOS.html",
  code: "RA",
  tester: "Rahul",
  devices: "MacBook (Safari + Chrome) + iPhone/iPad (Safari)",
  title: "InWallz POS — Test Report 3",
  scope: "Super Admin, Admin and Cashier as a website on macOS and iOS. No Windows .exe and no Android app.",
  brief: `
<p>There is <b>no iOS app and no Mac build</b> of this product — the Windows installer
and the Android APK simply cannot run on your machines. So your job is the one thing
only you can do: prove the software works <b>as a website</b> on <b>Safari and WebKit</b>,
which nobody else on the team can test.</p>
<p>You cover <b>Super Admin</b>, the whole <b>Admin panel</b> and the <b>Cashier screen
in a browser</b> — every screen, every form, every calculation — plus cross-browser
layout and iOS/iPad behaviour.</p>
<p><b>You cannot test</b> (mark these Blocked if you meet them): the .exe installer,
Windows services, direct/silent printing to a thermal printer, and the waiter APK.
Printing on your side means <i>Safari's print preview</i>, which is still worth checking.</p>
<p><b>You need:</b> the URL Arun gives you (the till PC or the cloud server) reachable
from your Mac, Safari + Chrome on macOS, and an iPhone or iPad on Safari.</p>`,
  sections: [
    {
      id: "A", title: "Environment & access",
      cases: [
        { id: 1, t: "Reach the server from the Mac", pri: "Critical",
          s: ["Open the URL Arun gave you in Safari."],
          e: "The login page loads. Write the exact URL, your macOS version and Safari version in the header box." },
        { id: 2, t: "Same URL in Chrome", pri: "High", s: ["Open the same URL in Chrome on the Mac."], e: "Login page loads identically." },
        { id: 3, t: "Reach it from the iPhone/iPad", pri: "High", s: ["Open the URL in Safari on iOS."], e: "The login page loads. Note the device and iOS version." },
        { id: 4, t: "Health endpoint", pri: "Medium", s: ["Open <URL>/api/health."], e: "JSON with service: \"inwallz-billing\"." },
        { id: 5, t: "Test data present", pri: "High", s: ["Log in as admin and check Menu / Tables / Employees."], e: "There is data to test with." },
      ]
    },
    {
      id: "B", title: "Login & session (Safari and Chrome)",
      cases: [
        { id: 1, t: "Login page renders correctly in Safari", pri: "High",
          s: ["Look at the login page in Safari: fonts, icons, input alignment, button."],
          e: "Everything is aligned and legible. Icons are real icons, not empty boxes. Screenshot anything odd." },
        { id: 2, t: "Valid login — each role", pri: "Critical",
          s: ["Log in as super admin, admin and cashier in turn."],
          e: "Each lands on its own screen." },
        { id: 3, t: "Wrong password", pri: "High", s: ["Try a wrong password."], e: "A clear error; no infinite spinner." },
        { id: 4, t: "Empty submit", pri: "Medium", s: ["Press Login with empty fields."], e: "Blocked with visible validation." },
        { id: 5, t: "Show/hide password in Safari", pri: "Low", s: ["Toggle the eye icon."], e: "Works; the icon changes." },
        { id: 6, t: "Safari autofill / keychain", pri: "Medium",
          s: ["Save the password in the keychain when Safari offers, log out and log back in using autofill."],
          e: "Autofilled credentials log in successfully (autofill often breaks React inputs — this is a real Safari-only risk)." },
        { id: 7, t: "Session survives refresh", pri: "High", s: ["Press ⌘R on an inner page."], e: "Still logged in, same page." },
        { id: 8, t: "Logout then Back", pri: "High", s: ["Log out and press ⌘← / Back."], e: "You stay logged out; no cached dashboard with live data." },
        { id: 9, t: "Safari Private Browsing", pri: "Medium",
          s: ["Open a private window and log in."],
          e: "Works. Safari restricts storage in private mode — note any 'cannot save' behaviour." },
        { id: 10, t: "Two roles in two browsers", pri: "Medium",
          s: ["Admin in Safari, cashier in Chrome, at the same time."],
          e: "Both sessions work independently and neither logs the other out." },
        { id: 11, t: "Unknown URL", pri: "Low", s: ["Open <URL>/nonsense."], e: "Redirects to your home screen." },
      ]
    },
    {
      id: "C", title: "Super Admin (as a site)",
      cases: [
        { id: 1, t: "Panel renders in Safari", pri: "High", s: ["Open the super admin panel."], e: "Header, stat cards, create form and the admins table all lay out correctly." },
        { id: 2, t: "Stat cards match the table", pri: "Medium", s: ["Count the rows vs the cards."], e: "They agree." },
        { id: 3, t: "Create an admin", pri: "Critical", s: ["Create a test admin with all fields."], e: "Success message, form clears, row appears." },
        { id: 4, t: "The new admin can log in", pri: "Critical", s: ["Log in with it in Chrome."], e: "Works, lands on an empty admin dashboard for that restaurant." },
        { id: 5, t: "Tenant isolation", pri: "Critical", s: ["Inside the new restaurant check Menu, Orders and Reports."], e: "No other restaurant's data is visible." },
        { id: 6, t: "Validation", pri: "Medium", s: ["Try blank fields, a duplicate username, letters in the mobile number."], e: "Each rejected clearly; note anything accepted that should not be." },
        { id: 7, t: "Delete with confirm/cancel", pri: "High", s: ["Delete a test admin; cancel once, then confirm."], e: "Cancel changes nothing; confirm removes the row and that login stops working." },
        { id: 8, t: "Edit button", pri: "Medium", s: ["Press Edit."], e: "Record what happens. A button that does nothing is a defect." },
        { id: 9, t: "Table on a narrow window", pri: "Medium", s: ["Shrink the browser window to ~700px wide."], e: "The table scrolls or reflows; it must not spill off the page or overlap the form." },
      ]
    },
    {
      id: "D", title: "Admin — every page renders on macOS",
      note: "This section is a sweep: open each page in Safari AND Chrome and compare. You are looking for WebKit-only layout breaks.",
      cases: [
        { id: 1, t: "Dashboard", pri: "High", s: ["Open the dashboard in Safari, then Chrome."], e: "Cards, chart, recent orders, tables widget all render the same in both. Screenshot any difference." },
        { id: 2, t: "Sales chart in Safari", pri: "High", s: ["Look at the chart in Safari specifically; hover a data point."], e: "It draws correctly and tooltips work (charts are a common Safari break point)." },
        { id: 3, t: "Employees", pri: "High", s: ["Open Employees in both browsers; open the add-employee modal."], e: "Table, cards and the modal all render and the modal can be closed." },
        { id: 4, t: "Menu", pri: "High", s: ["Open Menu; use the filters, search and pagination."], e: "All controls work in Safari; dropdowns open and close properly." },
        { id: 5, t: "Categories", pri: "Medium", s: ["Open Categories and its modals."], e: "Renders and works." },
        { id: 6, t: "Tables", pri: "Medium", s: ["Open Tables; open the add/edit/details modals."], e: "Renders and works; the table illustration draws correctly." },
        { id: 7, t: "Orders", pri: "High", s: ["Open Orders; use every filter and open a details modal."], e: "Renders and works." },
        { id: 8, t: "Charges", pri: "Medium", s: ["Open Charges and its modals and preview."], e: "Renders and works." },
        { id: 9, t: "Billing format", pri: "High", s: ["Open Billing; toggle several options."], e: "The live preview updates in Safari as it does in Chrome." },
        { id: 10, t: "Kitchen Template", pri: "High", s: ["Open Kitchen Template; toggle options."], e: "Preview updates correctly." },
        { id: 11, t: "Reports", pri: "High", s: ["Open Reports; switch date ranges."], e: "All charts and tables render in Safari; date pickers open and are usable." },
        { id: 12, t: "Settings", pri: "High", s: ["Open Settings; expand every block."], e: "No block stays stuck on 'Loading…'; toggles and selects work in Safari." },
        { id: 13, t: "Sidebar links 'Restaurant' and 'Customers'", pri: "High",
          s: ["Click each of these two sidebar links."],
          e: "Record exactly what happens — these two are suspected to lead nowhere. Describe the behaviour precisely." },
        { id: 14, t: "Safari console errors", pri: "Medium",
          s: ["Enable Safari's Develop menu, open the Console, and walk through every admin page."],
          e: "List every red error with the page and message. Safari-only errors are the whole point of your round." },
      ]
    },
    {
      id: "E", title: "Admin — data entry & validation (in Safari)",
      cases: [
        { id: 1, t: "Add a category", pri: "High", s: ["Add 'Rahul Test' and save."], e: "Saved and appears in the Menu category dropdown." },
        { id: 2, t: "Add a menu item", pri: "Critical", s: ["Add an item with a price, category and food type."], e: "Saved and visible on the cashier screen." },
        { id: 3, t: "Price validation", pri: "Critical", s: ["Try 0, -50, 'abc', 12.345, 99999999."], e: "Invalid values rejected. List everything that was accepted." },
        { id: 4, t: "Decimal handling", pri: "High", s: ["Save 149.99 and order it on the cashier screen."], e: "The bill shows 149.99 exactly — no rounding surprise." },
        { id: 5, t: "Number inputs on Safari", pri: "Medium", s: ["Type into every numeric field (price, capacity, quantity, charge value)."], e: "Safari accepts the input normally; no field silently drops characters or refuses a decimal point." },
        { id: 6, t: "Date pickers on Safari", pri: "High", s: ["Use the Reports custom date range and any other date field."], e: "The picker opens and the selected date is applied (Safari handles date inputs differently from Chrome)." },
        { id: 7, t: "Dropdowns / selects", pri: "Medium", s: ["Open every select on the Menu and Settings pages."], e: "Native Safari selects open, are readable and set the value." },
        { id: 8, t: "File upload", pri: "Medium", s: ["Upload a menu item image and a restaurant logo from the Mac."], e: "Both upload and display; a HEIC photo from an iPhone either works or is rejected with a clear message." },
        { id: 9, t: "Long text", pri: "Low", s: ["Enter a 200-character item name and a 300-character invoice footer."], e: "Layout holds; text wraps or truncates cleanly." },
        { id: 10, t: "Unicode and emoji", pri: "Low", s: ["Save an item named 'சிக்கன் 🍗 65'."], e: "Displays correctly on admin and cashier — no ????, no boxes." },
        { id: 11, t: "Leading/trailing spaces", pri: "Low", s: ["Save a category named '  Test  '."], e: "It is trimmed or handled sensibly, and does not create a near-duplicate." },
        { id: 12, t: "Edit then cancel", pri: "Medium", s: ["Open an edit modal, change fields, then press Cancel/✕."], e: "Nothing is saved; reopening shows the original values." },
        { id: 13, t: "Delete confirmations", pri: "High", s: ["On each delete (menu, category, table, employee) cancel once, then confirm."], e: "Cancel never deletes; confirm always does." },
        { id: 14, t: "Double-click Save", pri: "High", s: ["Double-click the Save button on the add-item form."], e: "Only ONE item is created." },
        { id: 15, t: "Settings — change admin password", pri: "Critical",
          s: ["Wrong current password; then a mismatched confirm; then a correct change; then log in with the new one."],
          e: "First two rejected, the real change works, the old password stops working. (Tell Arun the new password.)" },
      ]
    },
    {
      id: "F", title: "Admin — Reports accuracy (calculator in hand)",
      note: "Do this after you have created a few bills on the cashier screen in section H, so the numbers are yours and you know what they should be.",
      cases: [
        { id: 1, t: "Today's revenue matches your own bills", pri: "Critical",
          s: ["Note the total of every bill you settled today.", "Open Reports → Today."],
          e: "Total revenue matches to the rupee. Write both numbers in Notes." },
        { id: 2, t: "Order count matches", pri: "High", s: ["Compare Total Orders with the Orders page row count for today."], e: "Equal." },
        { id: 3, t: "Average order value", pri: "High", s: ["Check revenue ÷ paid orders yourself."], e: "The displayed average is right." },
        { id: 4, t: "Paid vs pending", pri: "Critical", s: ["Leave one bill unsettled and reload Reports."], e: "It shows under Pending, not Paid." },
        { id: 5, t: "Cancelled excluded", pri: "Critical", s: ["Cancel an order and reload."], e: "Cancelled count rises; revenue does not include it." },
        { id: 6, t: "GST / CGST / SGST", pri: "High", s: ["Compare the tax section with the GST lines on your bills."], e: "CGST = SGST = half the GST, and the total matches." },
        { id: 7, t: "Payment method split", pri: "High", s: ["Settle bills by cash, card and UPI, then check the Payments block."], e: "Each total is right and they add up to the paid amount." },
        { id: 8, t: "Top selling", pri: "Medium", s: ["Order one item 5 times, reload Reports."], e: "It appears with quantity 5." },
        { id: 9, t: "Date ranges", pri: "High", s: ["Switch Today / This Week / Last Week / This Month / Last Month."], e: "Figures are consistent and never shrink as the window widens." },
        { id: 10, t: "Custom range and an invalid range", pri: "Medium", s: ["Use a custom range; then set To earlier than From."], e: "Custom works; the invalid range is refused or corrected with a message." },
        { id: 11, t: "Empty period", pri: "Medium", s: ["Choose a range from last year."], e: "A clean empty state — no NaN, no crash." },
        { id: 12, t: "Reports vs Dashboard", pri: "High", s: ["Compare today's figures on the dashboard cards with Reports → Today."], e: "The two pages agree." },
      ]
    },
    {
      id: "G", title: "Print previews in Safari (your version of 'printing')",
      note: "You cannot test the silent thermal printing — that needs the Windows till. You CAN test what the document looks like, which is just as easy to get wrong.",
      cases: [
        { id: 1, t: "Bill preview updates live", pri: "High", s: ["On Admin → Billing, toggle options and watch the preview."], e: "The preview follows every toggle in Safari." },
        { id: 2, t: "58mm layout", pri: "High", s: ["Select 58mm and preview a bill."], e: "Narrow layout, nothing wrapped mid-word, amounts still aligned on the right." },
        { id: 3, t: "80mm layout", pri: "High", s: ["Select 80mm."], e: "Correct wider layout." },
        { id: 4, t: "A4 / full page", pri: "Medium", s: ["Select the full-page invoice."], e: "A proper page layout with margins." },
        { id: 5, t: "Safari print dialog", pri: "High", s: ["Use the page's print/preview button in Safari."], e: "Safari's print sheet opens with the bill laid out — not a blank page, not the whole website UI." },
        { id: 6, t: "Save as PDF from Safari", pri: "Medium", s: ["From the print sheet choose Save as PDF."], e: "A readable PDF. Attach one to your report." },
        { id: 7, t: "Kitchen template preview", pri: "High", s: ["Do the same on Admin → Kitchen Template."], e: "The KOT preview renders correctly and shows no prices." },
        { id: 8, t: "Logo on the preview", pri: "Medium", s: ["Turn the logo on and off."], e: "The preview follows and the logo is not stretched or oversized." },
        { id: 9, t: "Long restaurant name / footer", pri: "Low", s: ["Set a very long name and footer and preview."], e: "They wrap inside the paper width rather than being clipped." },
      ]
    },
    {
      id: "H", title: "Cashier screen as a website (macOS)",
      note: "Everything except the physical printer. When a print happens, Safari's dialog appearing is the expected fallback for you — note it and carry on.",
      cases: [
        { id: 1, t: "Cashier screen renders in Safari", pri: "Critical",
          s: ["Log in as cashier on the Mac."],
          e: "Top bar, table chips, menu grid and the docked bill panel all lay out correctly on the Mac screen." },
        { id: 2, t: "Layout at different window sizes", pri: "High",
          s: ["Resize the window: full screen, half screen, and ~1024px wide."],
          e: "The bill panel stays usable and the menu grid reflows. Nothing overlaps or is cut off." },
        { id: 3, t: "Table chips show state", pri: "High", s: ["Look at the table bar."], e: "Free / Occupied / Billed states and served counts are correct." },
        { id: 4, t: "Menu search and categories", pri: "High", s: ["Search and filter."], e: "Correct results; the grid does not jump." },
        { id: 5, t: "Add items with the stepper", pri: "Critical", s: ["Add several items, increase and decrease."], e: "Quantities correct; layout stable." },
        { id: 6, t: "Totals maths", pri: "Critical",
          s: ["Add items with known prices and check Subtotal, GST 5%, Service 2% and Total on a calculator."],
          e: "All four are right. Write the numbers in Notes." },
        { id: 7, t: "Per-item notes", pri: "High", s: ["Put different notes on two lines of the same item."], e: "Both are kept separately." },
        { id: 8, t: "Send to kitchen", pri: "Critical", s: ["Send the order."], e: "The table turns Occupied and the order is created." },
        { id: 9, t: "Add a second round", pri: "High", s: ["Add more items to the same table and send again."], e: "The bill holds both rounds; the first round is not resent." },
        { id: 10, t: "Serve from the cashier", pri: "High", s: ["Press Serve on a line."], e: "Marks served and the counts update." },
        { id: 11, t: "Bill edit — quantity", pri: "Critical", s: ["Open the bill and change a quantity."], e: "Totals recalculate correctly and persist." },
        { id: 12, t: "Bill edit — remove a line", pri: "Critical", s: ["Remove a line."], e: "Totals drop by exactly that amount." },
        { id: 13, t: "Bill edit — add an item", pri: "High", s: ["Add an item from inside the bill."], e: "Added and totals update." },
        { id: 14, t: "Payment — cash and change", pri: "Critical", s: ["Settle a ₹237 bill with ₹500."], e: "Change shows exactly ₹263." },
        { id: 15, t: "Payment — card / UPI", pri: "High", s: ["Settle by each method."], e: "Saved and later visible in Reports." },
        { id: 16, t: "Under-payment", pri: "High", s: ["Tender less than the total."], e: "Blocked or clearly marked pending — never silently fully paid." },
        { id: 17, t: "Settle frees the table", pri: "Critical", s: ["Complete the payment."], e: "The table returns to Free and the bill is in Bills history." },
        { id: 18, t: "Settling the same bill twice", pri: "Critical", s: ["Reopen a settled bill from history and try to settle again."], e: "Refused." },
        { id: 19, t: "Counter / walk-in order", pri: "Critical", s: ["Click Counter, add items, press Send & Bill."], e: "Order created and payment opens in one step." },
        { id: 20, t: "Cancel order", pri: "High", s: ["Cancel an open order; decline the confirm once first."], e: "Cancel is confirmed first; after confirming the table frees up." },
        { id: 21, t: "Bills history", pri: "High", s: ["Open Bills and reopen one."], e: "Amounts exactly match what was charged." },
        { id: 22, t: "Menu availability from the cashier", pri: "High", s: ["Turn an item off, then on."], e: "The cashier grid follows within ~10 seconds." },
        { id: 23, t: "Printer page on a Mac backend", pri: "Medium",
          s: ["Open the cashier's 🖨 Printer page."],
          e: "Because the backend is not on your Mac, it should say printers cannot be detected and offer a text box instead of a dropdown — an honest message, not a fake 'Connected'." },
        { id: 24, t: "Printing falls back to the browser dialog", pri: "High",
          s: ["Settle a bill from the Mac."],
          e: "The sale completes and Safari's print dialog appears as the fallback. The sale must never fail because printing is unavailable." },
        { id: 25, t: "Refresh mid-order", pri: "High", s: ["Build a bill, press ⌘R, look at the screen."], e: "The sent order is still there. Note whether unsent items survive." },
      ]
    },
    {
      id: "I", title: "Kitchen display as a website (optional but useful)",
      cases: [
        { id: 1, t: "Kitchen board renders in Safari", pri: "Medium", s: ["Log in as kitchen@inwallz on the Mac."], e: "The board, table strip and cards render correctly." },
        { id: 2, t: "New order appears automatically", pri: "High", s: ["Create an order on the cashier screen in another window."], e: "It appears on the board within ~5 seconds with no refresh." },
        { id: 3, t: "Serve strikes through and sinks", pri: "Medium", s: ["Press Serve."], e: "Struck through, marked served, moved to the bottom." },
        { id: 4, t: "Notes visible", pri: "High", s: ["Send an item with a note."], e: "The note shows on the card." },
        { id: 5, t: "Billed table drops off", pri: "Medium", s: ["Bill the table."], e: "Its card disappears." },
        { id: 6, t: "Left running for 30 minutes", pri: "Medium", s: ["Leave the board open for 30 minutes in Safari."], e: "It is still updating, still responsive, and Safari has not throttled it into a frozen state." },
      ]
    },
    {
      id: "J", title: "Cross-browser & responsive (macOS)",
      cases: [
        { id: 1, t: "Safari vs Chrome — admin", pri: "High", s: ["Open the same 5 admin pages side by side in both browsers."], e: "Same layout, same numbers. Screenshot every difference." },
        { id: 2, t: "Safari vs Chrome — cashier", pri: "High", s: ["Same for the cashier screen."], e: "Identical behaviour." },
        { id: 3, t: "Very wide window", pri: "Medium", s: ["Full-screen on the largest display you have."], e: "Content uses the space sensibly; nothing is stretched into an unreadable line." },
        { id: 4, t: "Narrow window ~900px", pri: "High", s: ["Resize the admin and cashier pages to ~900px."], e: "No horizontal scrollbar on the body; tables scroll inside their own container." },
        { id: 5, t: "Narrow window ~600px", pri: "Medium", s: ["Resize further."], e: "Record what breaks — this tells us how much responsive work is left." },
        { id: 6, t: "Browser zoom 150% and 200%", pri: "Medium", s: ["Zoom in with ⌘+."], e: "Text stays readable and buttons remain clickable; nothing overlaps." },
        { id: 7, t: "macOS dark mode", pri: "Low", s: ["Switch macOS to Dark Appearance and reload."], e: "The app is still legible — no white text on white, no invisible inputs." },
        { id: 8, t: "Long session in Safari", pri: "Medium", s: ["Leave the admin dashboard open for 30+ minutes, then interact."], e: "It still responds; note any need to reload." },
        { id: 9, t: "Slow network", pri: "Medium", s: ["Use Safari's Develop → Network conditions (or Chrome's Slow 3G) and load Reports."], e: "A loading state, then the page — not a permanent blank." },
      ]
    },
    {
      id: "K", title: "iOS Safari (iPhone / iPad)",
      note: "There is no iOS app to install. This is the website on iOS — worth knowing whether an owner could check reports from an iPhone.",
      cases: [
        { id: 1, t: "Login on iPhone", pri: "High", s: ["Open the URL and log in as admin on the iPhone."], e: "Login works; the keyboard does not cover the fields." },
        { id: 2, t: "Admin dashboard on iPhone", pri: "Medium", s: ["Look at the dashboard."], e: "Record how usable it is — cards stacked, chart readable, nothing cut off." },
        { id: 3, t: "Sidebar on iPhone", pri: "Medium", s: ["Try to reach the sidebar links."], e: "You can navigate. If the sidebar is unreachable on a phone, say so." },
        { id: 4, t: "Reports on iPad", pri: "Medium", s: ["Open Reports on an iPad in both orientations."], e: "Tables and charts are usable; the date picker works with touch." },
        { id: 5, t: "Cashier screen on iPad", pri: "High",
          s: ["Open the cashier screen on an iPad and build an order."],
          e: "Record whether it is genuinely usable as a touch till — this tells us if an iPad could be a second counter." },
        { id: 6, t: "Touch targets", pri: "Medium", s: ["Try the + / − steppers and small buttons with a finger."], e: "They are big enough to hit reliably." },
        { id: 7, t: "Buttons stuck in the hover state", pri: "Medium", s: ["Tap several buttons and look at them afterwards."], e: "No button stays highlighted after the tap." },
        { id: 8, t: "iOS keyboard behaviour", pri: "Medium", s: ["Type in a search box and a note field."], e: "The page scrolls the field into view; the layout is not pushed off screen." },
        { id: 9, t: "Pinch zoom / double-tap zoom", pri: "Low", s: ["Try zooming."], e: "Either it zooms cleanly or is deliberately locked — but the page is never left half-scrolled." },
        { id: 10, t: "Rotate the device", pri: "Medium", s: ["Rotate portrait/landscape on both admin and cashier."], e: "The layout adapts and no state is lost." },
        { id: 11, t: "iOS Safari with the tab backgrounded", pri: "Medium", s: ["Switch apps for 5 minutes, come back to the cashier tab."], e: "It reconnects/refreshes rather than showing frozen stale data." },
      ]
    },
    {
      id: "L", title: "Security & role isolation (from the Mac)",
      cases: [
        { id: 1, t: "Cashier cannot open admin", pri: "Critical", s: ["Logged in as cashier, open /admin/dashboard."], e: "Refused / redirected." },
        { id: 2, t: "Admin cannot open super admin", pri: "Critical", s: ["As admin, open /super_admin."], e: "Refused / redirected." },
        { id: 3, t: "Logged out, direct URL", pri: "Critical", s: ["Log out and paste /admin/reports."], e: "Login page only." },
        { id: 4, t: "Tampered role in storage", pri: "Critical",
          s: ["Safari → Develop → Show Web Inspector → Storage → Local Storage. Change the stored user role to 'admin' and reload."],
          e: "The server still refuses admin data. If a working admin page appears, screenshot it — Critical." },
        { id: 5, t: "Script-like input", pri: "High", s: ["Save a menu item named <script>alert(1)</script> and view it on admin and cashier."], e: "Shows as plain text; no popup." },
        { id: 6, t: "SQL-like input", pri: "High", s: ["Use  ' OR 1=1 --  in login and in a search field."], e: "Normal failure / no results; no database error text on screen." },
        { id: 7, t: "Sensitive data in responses", pri: "High",
          s: ["Web Inspector → Network: look at the login and employee-list responses."],
          e: "No plain password or hash is returned to the browser." },
        { id: 8, t: "Back button after logout on iOS", pri: "High", s: ["Log out on the iPhone, press back."], e: "You stay logged out (iOS caches pages aggressively — this is a real risk)." },
      ]
    },
    {
      id: "M", title: "Wording, polish & first impressions",
      note: "You are the freshest pair of eyes on the product. Anything that reads as unprofessional to a paying restaurant owner belongs here.",
      cases: [
        { id: 1, t: "Spelling and grammar sweep", pri: "Low", s: ["Read every heading, label, button and message across the admin panel."], e: "List every typo, inconsistent capitalisation or odd phrase, with the page name." },
        { id: 2, t: "Error messages are human", pri: "Medium", s: ["Trigger several errors (bad login, blank form, server stopped)."], e: "Each message says what went wrong and what to do — no raw error codes or 'undefined'." },
        { id: 3, t: "Loading states", pri: "Medium", s: ["Watch each page while it loads."], e: "There is a spinner or skeleton, not a flash of empty page or a jump when data arrives." },
        { id: 4, t: "Empty states", pri: "Medium", s: ["Look at a brand-new restaurant with no menu, no orders, no reports."], e: "Each empty screen explains what to do next instead of showing a blank area." },
        { id: 5, t: "Currency formatting", pri: "Medium", s: ["Check amounts across dashboard, orders, reports, bills."], e: "Consistent symbol and 2 decimals everywhere. Note any place showing 1234.5 or a bare number." },
        { id: 6, t: "Date and time formatting", pri: "Medium", s: ["Compare dates across orders, reports and bills."], e: "One consistent format, correct timezone, sensible 12/24h." },
        { id: 7, t: "Keyboard navigation", pri: "Low", s: ["Tab through the login form and one modal; press Esc on a modal."], e: "Tab order is sensible; Esc closes the modal." },
        { id: 8, t: "Colour contrast", pri: "Low", s: ["Look for grey-on-grey or light text on light backgrounds."], e: "Everything is readable at arm's length. Screenshot the worst offenders." },
        { id: 9, t: "Overall verdict", pri: "Medium",
          s: ["After finishing everything, write 3–5 sentences: would you trust this to run a restaurant tomorrow, and what are the top 3 things to fix first?"],
          e: "Put your answer in the Notes box for this row — this is the row Arun will read first." },
      ]
    },
  ]
};

/* ------------------------------------------------------------------ *
 *  TEMPLATE
 * ------------------------------------------------------------------ */

const esc = (s) => String(s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function renderCase(docCode, sec, c) {
  const cid = `${docCode}-${sec.id}${String(c.id).padStart(2, "0")}`;
  const steps = c.s.map((x) => `<li>${esc(x)}</li>`).join("");
  return `
<tr class="case" data-id="${cid}" data-pri="${c.pri}">
  <td class="c-id">${cid}<span class="pri pri-${c.pri.toLowerCase()}">${c.pri}</span></td>
  <td class="c-body">
    <div class="c-title">${esc(c.t)}</div>
    <div class="c-steps"><b>Steps</b><ol>${steps}</ol></div>
    <div class="c-exp"><b>Expected</b> ${esc(c.e)}</div>
  </td>
  <td class="c-res">
    <label class="r pass"><input type="radio" name="${cid}" value="Pass"><span>Pass</span></label>
    <label class="r fail"><input type="radio" name="${cid}" value="Fail"><span>Fail</span></label>
    <label class="r blk"><input type="radio" name="${cid}" value="Blocked"><span>Blocked</span></label>
    <label class="r na"><input type="radio" name="${cid}" value="N/A"><span>N/A</span></label>
    <select class="sev" data-for="${cid}">
      <option value="">Severity…</option>
      <option>Critical</option><option>High</option><option>Medium</option><option>Low</option>
    </select>
  </td>
  <td class="c-notes">
    <textarea data-for="${cid}" rows="3" placeholder="What actually happened? Screenshot file name, error text, numbers you saw…"></textarea>
  </td>
</tr>`;
}

function renderSection(docCode, sec) {
  const n = sec.cases.length;
  const note = sec.note ? `<p class="secnote">${esc(sec.note)}</p>` : "";
  return `
<section class="sec" id="sec-${sec.id}">
  <h2><span class="secid">${sec.id}</span> ${esc(sec.title)} <span class="seccount">${n} case${n === 1 ? "" : "s"}</span>
      <span class="secstat" data-sec="${sec.id}"></span></h2>
  ${note}
  <table class="cases">
    <thead><tr><th style="width:108px">ID</th><th>Test case</th><th style="width:150px">Result</th><th style="width:280px">Notes / actual result</th></tr></thead>
    <tbody>${sec.cases.map((c) => renderCase(docCode, sec, c)).join("")}</tbody>
  </table>
</section>`;
}

function buildDoc(doc) {
  const total = doc.sections.reduce((a, s) => a + s.cases.length, 0);
  const toc = doc.sections
    .map((s) => `<a href="#sec-${s.id}"><b>${s.id}</b> ${esc(s.title)} <i>${s.cases.length}</i></a>`)
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(doc.title)} — ${esc(doc.tester)}</title>
<style>
  html{color-scheme:light}
  img{max-width:100%}
  :root{
    --bg:#f6f7f9; --panel:#fff; --ink:#16181d; --muted:#666e7a; --line:#e3e6ea;
    --brand:#7a2f2f; --brand2:#a94442;
    --pass:#1a7f4b; --fail:#c0392b; --blk:#b7791f; --na:#6b7280;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);
       font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
  .wrap{max-width:1180px;margin:0 auto;padding:0 16px 80px}
  header.top{background:linear-gradient(135deg,var(--brand),var(--brand2));color:#fff;padding:22px 0 18px;margin-bottom:18px}
  header.top .wrap{padding-bottom:0}
  header.top h1{margin:0 0 4px;font-size:22px;letter-spacing:.2px}
  header.top .sub{opacity:.92;font-size:13px}
  .who{display:inline-block;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.3);
       border-radius:999px;padding:3px 12px;font-size:12px;font-weight:600;margin-top:8px}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px 18px;margin:14px 0}
  .card h3{margin:0 0 10px;font-size:15px}
  .grid{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr))}
  .fld label{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.4px;color:var(--muted);margin-bottom:3px}
  .fld input{width:100%;padding:7px 9px;border:1px solid var(--line);border-radius:6px;font:inherit;background:#fff;color:inherit}
  table.creds{border-collapse:collapse;width:100%;font-size:13px;margin-top:6px}
  table.creds th,table.creds td{border:1px solid var(--line);padding:6px 9px;text-align:left}
  table.creds th{background:#f0f2f5;font-size:12px}
  code{background:#eef1f4;padding:1px 5px;border-radius:4px;font-size:12.5px}
  .sevhelp{margin:6px 0 0;padding-left:18px}
  .sevhelp li{margin:3px 0}
  .toc{display:grid;gap:6px;grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}
  .toc a{display:flex;gap:8px;align-items:baseline;text-decoration:none;color:var(--ink);
         border:1px solid var(--line);border-radius:7px;padding:7px 10px;background:#fbfcfd}
  .toc a:hover{border-color:var(--brand2)}
  .toc a b{color:var(--brand);min-width:16px}
  .toc a i{margin-left:auto;color:var(--muted);font-style:normal;font-size:12px}

  .bar{position:sticky;top:0;z-index:30;background:rgba(255,255,255,.97);border-bottom:1px solid var(--line);
       padding:9px 0;margin-bottom:14px;backdrop-filter:saturate(1.4) blur(6px)}
  .bar .wrap{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding-bottom:0}
  .chip{font-size:12.5px;font-weight:600;border-radius:999px;padding:4px 11px;border:1px solid var(--line);background:#fff}
  .chip.p{color:var(--pass);border-color:#bfe3cf} .chip.f{color:var(--fail);border-color:#f0c4bd}
  .chip.b{color:var(--blk);border-color:#f0dfb5} .chip.n{color:var(--na)}
  .prog{flex:1;min-width:140px;height:8px;border-radius:99px;background:#e8ebef;overflow:hidden}
  .prog i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--pass),#3fae74);transition:width .25s}
  button{font:inherit;border:1px solid var(--line);background:#fff;border-radius:7px;padding:6px 12px;cursor:pointer}
  button:hover{border-color:var(--brand2)}
  button.primary{background:var(--brand);color:#fff;border-color:var(--brand)}
  button.primary:hover{background:var(--brand2)}
  .filters button.on{background:var(--brand);color:#fff;border-color:var(--brand)}

  section.sec{background:var(--panel);border:1px solid var(--line);border-radius:10px;margin:16px 0;overflow:hidden}
  section.sec h2{margin:0;padding:13px 16px;font-size:15.5px;background:#f2f4f7;border-bottom:1px solid var(--line);
                 display:flex;align-items:center;gap:10px}
  .secid{background:var(--brand);color:#fff;border-radius:6px;padding:2px 9px;font-size:13px}
  .seccount{margin-left:auto;font-size:12px;color:var(--muted);font-weight:400}
  .secstat{font-size:12px;font-weight:600;color:var(--muted)}
  .secnote{margin:0;padding:10px 16px;background:#fff8e6;border-bottom:1px solid var(--line);font-size:13px}
  table.cases{width:100%;border-collapse:collapse}
  table.cases th{font-size:11px;text-transform:uppercase;letter-spacing:.4px;color:var(--muted);
                 text-align:left;padding:8px 12px;border-bottom:1px solid var(--line);background:#fafbfc}
  table.cases td{padding:11px 12px;border-bottom:1px solid var(--line);vertical-align:top}
  tr.case:last-child td{border-bottom:0}
  tr.case.done-pass{background:#f5fbf7} tr.case.done-fail{background:#fdf5f4}
  tr.case.done-blocked{background:#fdfaf1} tr.case.done-na{background:#fafafa;opacity:.72}
  .c-id{font:600 12px/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:var(--brand);white-space:nowrap}
  .pri{display:block;margin-top:5px;font:600 10px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
       text-transform:uppercase;letter-spacing:.4px;padding:3px 6px;border-radius:4px;text-align:center}
  .pri-critical{background:#fdecea;color:#b3261e} .pri-high{background:#fdf1e3;color:#a35b06}
  .pri-medium{background:#eef3fb;color:#2b5aa8} .pri-low{background:#eef1f4;color:#5b6472}
  .c-title{font-weight:600;margin-bottom:5px}
  .c-steps,.c-exp{font-size:13px;color:#3c424c}
  .c-steps b,.c-exp b{display:inline-block;font-size:10.5px;text-transform:uppercase;letter-spacing:.4px;color:var(--muted)}
  .c-steps ol{margin:2px 0 6px;padding-left:20px}
  .c-steps li{margin:1px 0}
  .c-exp{background:#f7f9fb;border-left:3px solid #cdd6e0;padding:6px 9px;border-radius:0 5px 5px 0;margin-top:4px}
  .c-res label.r{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;
                 border:1px solid var(--line);border-radius:6px;padding:4px 8px;margin-bottom:5px;cursor:pointer;background:#fff}
  .c-res label.pass{color:var(--pass)} .c-res label.fail{color:var(--fail)}
  .c-res label.blk{color:var(--blk)} .c-res label.na{color:var(--na)}
  .c-res label.r:has(input:checked){box-shadow:inset 0 0 0 1px currentColor}
  .sev{width:100%;padding:4px 6px;border:1px solid var(--line);border-radius:6px;font:inherit;font-size:12.5px;display:none;background:#fff;color:inherit}
  .sev.show{display:block}
  .c-notes textarea{width:100%;border:1px solid var(--line);border-radius:6px;padding:7px 8px;font:inherit;font-size:13px;resize:vertical;background:#fff;color:inherit}

  .defects textarea{width:100%;min-height:150px;border:1px solid var(--line);border-radius:8px;padding:10px;font:inherit;background:#fff;color:inherit}
  footer.end{color:var(--muted);font-size:12.5px;text-align:center;padding:26px 0}
  .hidden{display:none !important}
  .warnbox{background:#fff4f4;border:1px solid #f3c9c4;color:#8c2f26;border-radius:8px;padding:10px 12px;font-size:13px;margin:10px 0}
  @media print{
    .bar,.filters,.actions{display:none}
    body{background:#fff} section.sec{break-inside:auto}
    tr.case{break-inside:avoid}
  }
</style>
</head>
<body>

<header class="top">
  <div class="wrap">
    <h1>${esc(doc.title)}</h1>
    <div class="sub">${esc(doc.scope)}</div>
    <div class="who">Tester: ${esc(doc.tester)} &nbsp;·&nbsp; ${esc(doc.devices)} &nbsp;·&nbsp; ${total} test cases</div>
  </div>
</header>

<div class="bar">
  <div class="wrap">
    <span class="chip" id="cDone">0 / ${total} done</span>
    <div class="prog"><i id="pBar"></i></div>
    <span class="chip p" id="cPass">Pass 0</span>
    <span class="chip f" id="cFail">Fail 0</span>
    <span class="chip b" id="cBlk">Blocked 0</span>
    <span class="chip n" id="cNa">N/A 0</span>
    <span class="filters">
      <button data-f="all" class="on">All</button>
      <button data-f="todo">Not done</button>
      <button data-f="Fail">Failed</button>
      <button data-f="Blocked">Blocked</button>
    </span>
    <span class="actions">
      <button class="primary" id="bExport">⬇ Export report</button>
      <button id="bCsv">CSV</button>
      <button id="bSave">Save progress</button>
      <button id="bLoad">Load progress</button>
      <button id="bPrint">Print / PDF</button>
    </span>
  </div>
</div>

<div class="wrap">

  <div class="card">
    <h3>1 · Fill this in before you start</h3>
    <div class="grid">
      <div class="fld"><label>Tester name</label><input id="f_tester" value="${esc(doc.tester)}"></div>
      <div class="fld"><label>Date of testing</label><input id="f_date" placeholder="DD-MM-YYYY"></div>
      <div class="fld"><label>Devices used</label><input id="f_device" value="${esc(doc.devices)}"></div>
      <div class="fld"><label>OS / browser versions</label><input id="f_os" placeholder="e.g. Windows 11 · Chrome 141 · Android 14"></div>
      <div class="fld"><label>Server URL / till IP</label><input id="f_url" placeholder="http://192.168.1.7:5000"></div>
      <div class="fld"><label>Build / APK file name</label><input id="f_build" placeholder="InWallz-Waiter-20260904-1752-AUTO.apk"></div>
      <div class="fld"><label>Restaurant used for testing</label><input id="f_rest" placeholder="e.g. inwallz"></div>
      <div class="fld"><label>Time started → finished</label><input id="f_time" placeholder="10:00 → 16:30"></div>
    </div>
  </div>

  <div class="card">
    <h3>2 · How to use this document</h3>
    <ol style="margin:0;padding-left:20px">
      <li>Work top to bottom. Sections build on each other.</li>
      <li>For each row: follow the <b>Steps</b>, compare with <b>Expected</b>, then click <b>Pass</b>, <b>Fail</b>, <b>Blocked</b> (couldn't test — say why) or <b>N/A</b>.</li>
      <li>On a <b>Fail</b>, always pick a <b>Severity</b> and write in <b>Notes</b>: what actually happened, the exact error text, and the screenshot file name.</li>
      <li>Name screenshots after the test ID — e.g. <code>${doc.code}-D05.png</code> — and put them in one folder.</li>
      <li>Your answers save automatically in this browser. Use <b>Save progress</b> to also keep a backup file.</li>
      <li>When finished, click <b>⬇ Export report</b> and send Arun the exported file plus the screenshots folder.</li>
    </ol>
    <div class="warnbox" id="storeWarn" style="display:none">
      This browser is not letting the page auto-save. Please use <b>Save progress</b> regularly, or fill the document in one sitting.
    </div>
  </div>

  <div class="card">
    <h3>3 · Your brief</h3>
    ${doc.brief}
  </div>

  <div class="card">
    <h3>4 · Logins</h3>
    ${CREDS}
    <p style="margin:10px 0 0;font-size:13px;color:var(--muted)">Ask Arun for the admin/cashier/waiter passwords for the test restaurant. Never test on a live restaurant's data.</p>
  </div>

  <div class="card">
    <h3>5 · How to choose a severity</h3>
    ${SEV_HELP}
  </div>

  <div class="card">
    <h3>6 · Sections</h3>
    <div class="toc">${toc}</div>
  </div>

  ${doc.sections.map((s) => renderSection(doc.code, s)).join("")}

  <div class="card defects">
    <h3>Extra defects, ideas and anything else you noticed</h3>
    <p style="margin:0 0 8px;font-size:13px;color:var(--muted)">
      Anything that did not fit a test row: crashes, confusing wording, things a real
      restaurant would ask for, performance, or an idea to improve the flow.
      One per line, with the screen name.</p>
    <textarea id="f_extra" placeholder="e.g. Cashier screen — after settling, focus stays in the search box so the next keystroke types into it.&#10;e.g. Admin Reports — 'Show Less' scrolls to the top of the page."></textarea>
  </div>

  <div class="card defects">
    <h3>Overall summary (write this at the end)</h3>
    <textarea id="f_summary" placeholder="How did the round go overall? Biggest risks? What would you fix first? Is the software ready for a real restaurant?"></textarea>
  </div>

  <footer class="end">
    InWallz Billing Software — test document ${esc(doc.code)} · ${total} cases ·
    generated ${new Date().toISOString().slice(0, 10)} · send the exported report back to Arun
  </footer>
</div>

<script>
(function(){
  var DOC = ${JSON.stringify({ code: doc.code, tester: doc.tester, title: doc.title, total })};
  var KEY = "inwallz-test-" + DOC.code;
  var FIELDS = ["f_tester","f_date","f_device","f_os","f_url","f_build","f_rest","f_time","f_extra","f_summary"];

  function rows(){ return Array.prototype.slice.call(document.querySelectorAll("tr.case")); }
  function q(s,r){ return (r||document).querySelector(s); }

  /* ---------- state ---------- */
  function collect(){
    var st = { meta:{}, results:{} };
    FIELDS.forEach(function(f){ var el=document.getElementById(f); if(el) st.meta[f]=el.value; });
    rows().forEach(function(tr){
      var id = tr.dataset.id;
      var picked = q('input[name="'+id+'"]:checked', tr);
      var sev = q('.sev', tr), note = q('textarea', tr);
      if (picked || (note && note.value) || (sev && sev.value)) {
        st.results[id] = { result: picked?picked.value:"", severity: sev?sev.value:"", notes: note?note.value:"" };
      }
    });
    return st;
  }
  function apply(st){
    if(!st) return;
    if(st.meta) FIELDS.forEach(function(f){ var el=document.getElementById(f); if(el && st.meta[f]!=null) el.value=st.meta[f]; });
    if(st.results) Object.keys(st.results).forEach(function(id){
      var r = st.results[id];
      var tr = q('tr.case[data-id="'+id+'"]'); if(!tr) return;
      if(r.result){ var inp=q('input[value="'+r.result+'"][name="'+id+'"]', tr); if(inp) inp.checked=true; }
      var sev=q('.sev',tr); if(sev) sev.value = r.severity||"";
      var ta=q('textarea',tr); if(ta) ta.value = r.notes||"";
    });
    refresh();
  }

  var storageOk = true;
  function save(){
    try { localStorage.setItem(KEY, JSON.stringify(collect())); }
    catch(e){ if(storageOk){ storageOk=false; var w=document.getElementById("storeWarn"); if(w) w.style.display="block"; } }
  }
  function load(){
    try { var raw = localStorage.getItem(KEY); if(raw) apply(JSON.parse(raw)); }
    catch(e){ storageOk=false; var w=document.getElementById("storeWarn"); if(w) w.style.display="block"; }
  }

  /* ---------- ui ---------- */
  function refresh(){
    var n={Pass:0,Fail:0,Blocked:0,"N/A":0}, done=0;
    var perSec={};
    rows().forEach(function(tr){
      var picked = q('input[name="'+tr.dataset.id+'"]:checked', tr);
      var v = picked?picked.value:"";
      tr.className = "case" + (v ? " done-"+v.toLowerCase().replace("/","") : "");
      var sev = q('.sev', tr);
      if(sev) sev.classList.toggle("show", v==="Fail");
      if(v){ n[v]++; done++; }
      var sec = tr.dataset.id.split("-")[1].replace(/[0-9]/g,"");
      perSec[sec] = perSec[sec] || {d:0,t:0,f:0};
      perSec[sec].t++; if(v) perSec[sec].d++; if(v==="Fail") perSec[sec].f++;
    });
    document.getElementById("cDone").textContent = done + " / " + DOC.total + " done";
    document.getElementById("cPass").textContent = "Pass " + n.Pass;
    document.getElementById("cFail").textContent = "Fail " + n.Fail;
    document.getElementById("cBlk").textContent  = "Blocked " + n.Blocked;
    document.getElementById("cNa").textContent   = "N/A " + n["N/A"];
    document.getElementById("pBar").style.width = (DOC.total? (done/DOC.total*100):0) + "%";
    Object.keys(perSec).forEach(function(s){
      var el = q('.secstat[data-sec="'+s+'"]'); if(!el) return;
      var p = perSec[s];
      el.textContent = p.d + "/" + p.t + (p.f ? "  ·  " + p.f + " failed" : "");
      el.style.color = p.f ? "#c0392b" : (p.d===p.t ? "#1a7f4b" : "#666e7a");
    });
  }

  document.addEventListener("change", function(e){
    if(e.target.matches('input[type=radio], .sev')) { refresh(); save(); }
  });
  document.addEventListener("input", function(e){
    if(e.target.matches('textarea, .fld input')) save();
  });

  document.querySelectorAll(".filters button").forEach(function(b){
    b.addEventListener("click", function(){
      document.querySelectorAll(".filters button").forEach(function(x){x.classList.remove("on");});
      b.classList.add("on");
      var f = b.dataset.f;
      rows().forEach(function(tr){
        var picked = q('input[name="'+tr.dataset.id+'"]:checked', tr);
        var v = picked?picked.value:"";
        var show = f==="all" ? true : f==="todo" ? !v : v===f;
        tr.classList.toggle("hidden", !show);
      });
      document.querySelectorAll("section.sec").forEach(function(s){
        var any = Array.prototype.slice.call(s.querySelectorAll("tr.case")).some(function(t){return !t.classList.contains("hidden");});
        s.classList.toggle("hidden", !any);
      });
    });
  });

  /* ---------- export ---------- */
  function dl(name, text, type){
    var b = new Blob([text], {type:type||"text/plain;charset=utf-8"});
    var u = URL.createObjectURL(b);
    var a = document.createElement("a"); a.href=u; a.download=name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){URL.revokeObjectURL(u);}, 1500);
  }
  function stamp(){
    var t = (document.getElementById("f_tester").value||DOC.tester).replace(/[^A-Za-z0-9]+/g,"-");
    var d = (document.getElementById("f_date").value||new Date().toISOString().slice(0,10)).replace(/[^A-Za-z0-9]+/g,"-");
    return DOC.code + "-" + t + "-" + d;
  }
  function esc2(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

  document.getElementById("bSave").addEventListener("click", function(){
    dl(stamp()+"-progress.json", JSON.stringify(collect(),null,2), "application/json");
  });
  document.getElementById("bLoad").addEventListener("click", function(){
    var i = document.createElement("input"); i.type="file"; i.accept=".json,application/json";
    i.onchange = function(){
      var f = i.files[0]; if(!f) return;
      var fr = new FileReader();
      fr.onload = function(){ try{ apply(JSON.parse(fr.result)); save(); alert("Progress loaded."); }
                              catch(e){ alert("That file could not be read."); } };
      fr.readAsText(f);
    };
    i.click();
  });
  document.getElementById("bPrint").addEventListener("click", function(){ window.print(); });

  document.getElementById("bCsv").addEventListener("click", function(){
    var st = collect();
    var out = ["Test ID,Section,Test case,Priority,Result,Severity,Notes"];
    function cq(v){ return '"' + String(v==null?"":v).replace(/"/g,'""').replace(/\\r?\\n/g," | ") + '"'; }
    rows().forEach(function(tr){
      var id = tr.dataset.id;
      var r = st.results[id] || {};
      var secTitle = tr.closest("section").querySelector("h2").textContent.trim().replace(/\\s+/g," ");
      out.push([cq(id), cq(secTitle), cq(q(".c-title",tr).textContent), cq(tr.dataset.pri),
                cq(r.result||"NOT RUN"), cq(r.severity), cq(r.notes)].join(","));
    });
    dl(stamp()+"-results.csv", "\\ufeff"+out.join("\\r\\n"), "text/csv;charset=utf-8");
  });

  document.getElementById("bExport").addEventListener("click", function(){
    var st = collect();
    var n={Pass:0,Fail:0,Blocked:0,"N/A":0,NotRun:0};
    var sevN={Critical:0,High:0,Medium:0,Low:0};
    var body="", fails="";
    document.querySelectorAll("section.sec").forEach(function(sec){
      var title = sec.querySelector("h2").textContent.trim().replace(/\\s+/g," ");
      body += '<h2>'+esc2(title)+'</h2><table><tr><th>ID</th><th>Test case</th><th>Priority</th><th>Result</th><th>Severity</th><th>Notes</th></tr>';
      sec.querySelectorAll("tr.case").forEach(function(tr){
        var id=tr.dataset.id, r=st.results[id]||{}, res=r.result||"NOT RUN";
        if(res==="NOT RUN") n.NotRun++; else n[res]++;
        if(res==="Fail" && r.severity) sevN[r.severity]++;
        var cls = res.toLowerCase().replace("/","").replace(" ","");
        var row = '<tr class="'+cls+'"><td>'+esc2(id)+'</td><td>'+esc2(q(".c-title",tr).textContent)+'</td><td>'+esc2(tr.dataset.pri)+
                  '</td><td><b>'+esc2(res)+'</b></td><td>'+esc2(r.severity)+'</td><td>'+esc2(r.notes)+'</td></tr>';
        body += row;
        if(res==="Fail"||res==="Blocked") fails += row;
      });
      body += "</table>";
    });
    var meta = st.meta||{};
    var head = '<table class="meta">' +
      [["Tester",meta.f_tester],["Date",meta.f_date],["Devices",meta.f_device],["OS / browser",meta.f_os],
       ["Server URL",meta.f_url],["Build / APK",meta.f_build],["Restaurant",meta.f_rest],["Time",meta.f_time]]
      .map(function(p){return '<tr><th>'+p[0]+'</th><td>'+esc2(p[1])+'</td></tr>';}).join("") + "</table>";

    var html = '<!doctype html><html><head><meta charset="utf-8"><title>'+esc2(DOC.title)+' — '+esc2(meta.f_tester||DOC.tester)+' — results</title>' +
      '<style>body{font:13px/1.5 -apple-system,Segoe UI,Roboto,Arial,sans-serif;margin:24px;color:#16181d}' +
      'h1{font-size:20px;margin:0 0 4px}h2{font-size:15px;margin:22px 0 6px;padding-bottom:4px;border-bottom:2px solid #7a2f2f;color:#7a2f2f}' +
      'table{border-collapse:collapse;width:100%;margin-bottom:8px}th,td{border:1px solid #dde1e6;padding:5px 8px;text-align:left;vertical-align:top;font-size:12.5px}' +
      'th{background:#f1f3f6}table.meta{width:auto;margin-bottom:14px}table.meta th{width:140px}' +
      'tr.pass td{background:#f4fbf7}tr.fail td{background:#fdf3f2}tr.blocked td{background:#fdfaf0}tr.na td{background:#fafafa;color:#666}' +
      'tr.notrun td{background:#fff;color:#999}.sum span{display:inline-block;border:1px solid #dde1e6;border-radius:99px;padding:3px 11px;margin:0 6px 6px 0;font-weight:600}' +
      '.box{white-space:pre-wrap;border:1px solid #dde1e6;border-radius:6px;padding:10px;background:#fbfcfd}</style></head><body>' +
      '<h1>'+esc2(DOC.title)+' — results</h1><div>Tester: <b>'+esc2(meta.f_tester||DOC.tester)+'</b> · exported '+new Date().toLocaleString()+'</div>' +
      head +
      '<h2>Summary</h2><div class="sum">' +
        '<span>Total '+DOC.total+'</span><span style="color:#1a7f4b">Pass '+n.Pass+'</span>' +
        '<span style="color:#c0392b">Fail '+n.Fail+'</span><span style="color:#b7791f">Blocked '+n.Blocked+'</span>' +
        '<span style="color:#6b7280">N/A '+n["N/A"]+'</span><span style="color:#999">Not run '+n.NotRun+'</span></div>' +
      '<div class="sum">Failures by severity: <span style="color:#b3261e">Critical '+sevN.Critical+'</span>' +
        '<span style="color:#a35b06">High '+sevN.High+'</span><span style="color:#2b5aa8">Medium '+sevN.Medium+'</span>' +
        '<span style="color:#5b6472">Low '+sevN.Low+'</span></div>' +
      (fails ? '<h2>Failed &amp; blocked — read these first</h2><table><tr><th>ID</th><th>Test case</th><th>Priority</th><th>Result</th><th>Severity</th><th>Notes</th></tr>'+fails+'</table>' : '') +
      '<h2>Extra defects &amp; observations</h2><div class="box">'+esc2(meta.f_extra||"(none)")+'</div>' +
      '<h2>Overall summary</h2><div class="box">'+esc2(meta.f_summary||"(none)")+'</div>' +
      '<h2>Full results</h2>' + body +
      '</body></html>';
    dl(stamp()+"-REPORT.html", html, "text/html;charset=utf-8");
  });

  load();
  refresh();
  window.addEventListener("beforeunload", save);
})();
</script>
</body>
</html>`;
}

/* ------------------------------------------------------------------ *
 *  WRITE
 * ------------------------------------------------------------------ */

const outDir = __dirname;
[ABISHEK, ARTHI, RAHUL].forEach((d) => {
  const html = buildDoc(d);
  fs.writeFileSync(path.join(outDir, d.file), html, "utf8");
  const total = d.sections.reduce((a, s) => a + s.cases.length, 0);
  console.log(`${d.file.padEnd(42)} ${String(total).padStart(3)} cases in ${d.sections.length} sections`);
});
