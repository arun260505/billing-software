/**
 * cashierNetworkServer.js
 * ─────────────────────────────────────────────────────────────────
 * Tiny standalone Express server that runs ONLY on the Cashier's
 * computer (not the shared cloud/LAN backend).
 *
 * Purpose:
 *   1. Provides a health-check endpoint so Waiter devices can verify
 *      they are on the SAME local network as the Cashier.
 *   2. Announces itself via mDNS (Bonjour) so the Waiter dashboard
 *      discovers the Cashier AUTOMATICALLY — no IP entry needed.
 *
 * Usage (run this in a terminal on the Cashier computer):
 *   node backend/local/cashierNetworkServer.js
 *
 * The endpoint:
 *   GET http://<CASHIER-LOCAL-IP>:5001/connection-check
 *   → { "status": "online", "device": "cashier" }
 *
 * mDNS service name: _inwallz-cashier._tcp.local
 * ─────────────────────────────────────────────────────────────────
 */

const express       = require("express");
const os            = require("os");
const { Bonjour }   = require("bonjour-service");

const app    = express();
const PORT   = 5001;
const bonjour = new Bonjour();

// ── CORS: allow any LAN browser origin ──────────────────────────
app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin",  "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
});

// ── Health-check route ───────────────────────────────────────────
// Only reports "online" when this machine has a real (non-loopback)
// network address e.g. wifi/LAN. When disconnected there is only
// 127.0.0.1, which waiters can never reach, so it reports "offline".
app.get("/connection-check", (req, res) => {
    const lanIP = getLocalIP();
    const online = lanIP !== "127.0.0.1";
    res.json({ status: online ? "online" : "offline", device: "cashier", ip: online ? lanIP : null });
});

// ── Catch-all (invalid paths) ────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({ error: "Not found" });
});

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Returns the first non-loopback IPv4 address found on this machine.
 * Falls back to "127.0.0.1" if none can be determined.
 */
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === "IPv4" && !iface.internal) {
                return iface.address;
            }
        }
    }
    return "127.0.0.1";
}

// ── Start ────────────────────────────────────────────────────────
app.listen(PORT, "0.0.0.0", () => {
    const localIP = getLocalIP();

    // ── Announce via mDNS so Waiter devices auto-discover ──
    bonjour.publish({
        name: "InWallz Cashier",
        type: "inwallz-cashier",
        port: PORT,
        txt: { version: "1" }
    });

    console.log("\n╔═══════════════════════════════════════════════════════╗");
    console.log("║      Cashier Local Network Service — Running          ║");
    console.log("╠═══════════════════════════════════════════════════════╣");
    console.log(`║  Port    : ${PORT}                                       ║`);
    console.log(`║  Local IP: ${localIP.padEnd(44)}║`);
    console.log(`║  mDNS    : InWallz Cashier._inwallz-cashier._tcp       ║`);
    console.log("╠═══════════════════════════════════════════════════════╣");
    console.log("║  Waiter devices on the same Wi-Fi will auto-discover  ║");
    console.log("║  this server. No IP entry needed on the Waiter.       ║");
    console.log("╚═══════════════════════════════════════════════════════╝\n");

    // Graceful shutdown: un-publish the mDNS service
    process.on("SIGINT",  () => { bonjour.unpublishAll(() => process.exit(0)); });
    process.on("SIGTERM", () => { bonjour.unpublishAll(() => process.exit(0)); });
});
