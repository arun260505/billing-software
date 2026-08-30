/*
| Sync role, chosen by environment so one codebase serves both nodes:
|   SYNC_ROLE=cloud (default) — exposes /api/sync endpoints, runs no worker.
|   SYNC_ROLE=local           — runs the background worker against CLOUD_SYNC_URL.
*/
const ROLE = (process.env.SYNC_ROLE || "cloud").toLowerCase();

module.exports = {
    ROLE,
    isLocal: ROLE === "local",
    isCloud: ROLE === "cloud",
    cloudUrl: (process.env.CLOUD_SYNC_URL || "").replace(/\/+$/, ""),
    syncKey: process.env.SYNC_KEY || "",
    intervalMs: Number(process.env.SYNC_INTERVAL_MS || 15000)
};
