# InWallz POS — Test round 1

Three tester documents, split by what each person's devices can actually run.

| File | Tester | Devices | Cases | Covers |
|---|---|---|---|---|
| `TEST-01-Abishek-Windows-Android.html` | Abishek | Windows + Android | 134 | `.exe` installer, cashier till, kitchen display, **printers & print-mode matrix**, waiter APK core flow, resilience |
| `TEST-02-Arthi-Windows-Android.html` | Arthi | Windows + Android | 187 | Super Admin, **the whole Admin panel** (13 pages), settings & approvals, waiter APK edge cases, concurrency, security |
| `TEST-03-Rahul-Mac-iOS.html` | Rahul | Mac + iOS | 143 | Super Admin / Admin / Cashier **as a website** on Safari + Chrome, reports accuracy, print previews, iOS Safari, validation, polish |

**464 test cases total, no overlap except where two testers are deliberately paired.**

## Why the split is this way

- The Windows `.exe` and the Android `.apk` **cannot run on a Mac or an iPhone** — there is no iOS build and none is planned (see `WAITER_MOBILE_TASKS.md`). So Rahul gets everything that is reachable in a browser, which is Super Admin, Admin and the Cashier screen — plus the Safari/WebKit coverage nobody else can give.
- Abishek and Arthi both have Windows + Android, so the till/printer half went to one and the back-office half to the other. Rows that need two people at once are marked *with Abishek* / *with Arthi* — mostly concurrency and the printer-mode matrix (Arthi flips the mode in Admin → Settings, Abishek checks what comes out of the printer).

## How the team uses the document

1. Double-click the HTML file — it opens in any browser. **No internet, no install, no server needed.**
2. Fill the header box (name, date, device, build/APK name, server URL).
3. Work top to bottom. Each row: follow **Steps**, compare with **Expected**, click **Pass / Fail / Blocked / N/A**.
   - **Fail** → pick a severity and describe what actually happened in Notes.
   - **Blocked** → couldn't test it; say why. (Rahul will legitimately have Blocked rows for printers.)
4. Screenshots named after the test ID (`AB-D05.png`) in one folder.
5. Answers save automatically in the browser. **Save progress** writes a `.json` backup they can reload later.
6. When done: **⬇ Export report** → sends back a single self-contained `*-REPORT.html` with a summary, a "failed & blocked first" section and the full results. **CSV** exports the same for a spreadsheet.

## Regenerating

Content lives in one file. Edit and re-run:

```
node testing/generate-test-docs.js
```

Testers' saved answers are keyed per document and survive a regeneration as long as
test IDs don't change — so add new cases at the **end** of a section rather than
renumbering.

## Things the documents deliberately probe

These are known-or-suspected weak spots that were turned into explicit test rows,
so you get a written verdict on each instead of a guess:

- `installer.iss` / `install-services.ps1` have never run on a clean machine (`PACKAGING.md`) — Abishek section B.
- Sidebar links **Restaurant** and **Customers** have empty page files and no route — Arthi N02/N03, Rahul D13.
- Super Admin's **Edit** button — Arthi B13, Rahul C08.
- Waiter name/ID hardcoded (`Dashboard.js` "John" / "W102") — Abishek L02, Arthi O03.
- No order idempotency key + send button not disabled while in flight → duplicate kitchen tickets — Abishek D13 / M03, Arthi O10.
- No 401 response interceptor → stuck session at token expiry — Abishek M07, Arthi O14.
- Cart held only in `useState` → lost when Android kills the WebView — Abishek M04/M05.
- Android hardware back button, stuck `:hover` states, 360px layout — Arthi O04/O06/O07.
- Bill-line removal loops one request per row with no rollback — Arthi O13.
- Optimistic serve vs the 4s poller — Arthi O12.
- The printer-mode × order-type matrix (`printerMode.js`) — Abishek section I, all six combinations.
- Print failure must never break the sale — Abishek H07, Rahul H24.
