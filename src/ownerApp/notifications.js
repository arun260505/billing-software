// Local-notification + polling service for the salon-owner alerts app.
//
// The plugin is reached through window.Capacitor.Plugins.LocalNotifications
// rather than a static `import` on purpose: the same React bundle is built for
// the cloud/cashier web app, and a static import would force every one of those
// builds to carry the plugin. At runtime the native owner APK has the plugin
// registered on window.Capacitor.Plugins; the web app simply has no-op here.
//
// Delivery model (owner chose "polling + local alerts"): while the app is open
// or resumed it polls the cloud feed and raises a phone notification for each
// NEW alert. A cursor (highest id seen) is kept in localStorage, so nothing is
// ever shown twice and no alert is missed across restarts — no cache to clear.

import api from "../services/api";

const CURSOR_KEY = "owner_last_notif_id";
const CHANNEL_ID = "owner-alerts";

const plugin = () => window.Capacitor?.Plugins?.LocalNotifications || null;

function getCursor() {
    const v = localStorage.getItem(CURSOR_KEY);
    return v == null ? null : Number(v) || 0;
}
function setCursor(id) {
    try { localStorage.setItem(CURSOR_KEY, String(id)); } catch { /* ignore */ }
}

// Ask for the OS notification permission (Android 13+ needs it) and set up the
// alerts channel. Safe to call repeatedly.
export async function initNotifications() {
    const ln = plugin();
    if (!ln) return false;
    try {
        let perm = await ln.checkPermissions();
        if (perm.display !== "granted") {
            perm = await ln.requestPermissions();
        }
        if (ln.createChannel) {
            try {
                await ln.createChannel({
                    id: CHANNEL_ID,
                    name: "Shop alerts",
                    description: "Day open/close, sales summary and low stock",
                    importance: 4, // HIGH — heads-up notification
                    visibility: 1,
                });
            } catch { /* channels unsupported on old Android — ignore */ }
        }
        return perm.display === "granted";
    } catch {
        return false;
    }
}

// Raise one phone notification.
async function raise(id, title, body) {
    const ln = plugin();
    if (!ln) return;
    try {
        await ln.schedule({
            notifications: [{
                // Android needs a 32-bit int id; the row id fits and de-dupes.
                id: Number(id) % 2000000000,
                title: title || "InWallz Billing",
                body: body || "",
                channelId: CHANNEL_ID,
                // No smallIcon set on purpose: the plugin falls back to the app
                // launcher icon, which always exists, so alerts never silently
                // fail to show over a missing drawable.
            }],
        });
    } catch { /* a single failed alert must not stop the loop */ }
}

// Fetch the recent feed. Raises a phone notification for every alert newer than
// the cursor. On the very first run it only sets a baseline (so opening the app
// doesn't dump the whole backlog as notifications). Returns the feed rows
// (newest first) for the on-screen list, or null when offline.
export async function pollOnce() {
    let rows;
    try {
        const res = await api.get("/notifications?since_id=0&limit=50");
        rows = res.data?.data || [];
    } catch {
        return null; // offline — try again next tick
    }

    const maxId = rows.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0);
    const cursor = getCursor();

    if (cursor == null) {
        // First launch: baseline to the newest, don't replay history.
        setCursor(maxId);
        return rows;
    }

    // Raise oldest-first so the newest ends up on top of the shade.
    const fresh = rows.filter((r) => Number(r.id) > cursor).sort((a, b) => a.id - b.id);
    for (const r of fresh) {
        await raise(r.id, r.title, r.body);
    }
    if (maxId > cursor) setCursor(maxId);
    return rows;
}
