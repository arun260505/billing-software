import api from "./api";

// Cashier browser records the restaurant's current public/WAN IP.
export const registerNetwork = () => api.post("/system/register-network");

// Waiter app checks it is on the same network as the cashier.
export const getNetworkStatus = () => api.get("/system/network-status");

// Server LAN IP detection (used by the cashier Server IP page).
export const getServerIp = () => api.get("/system/server-ip");

// Printers installed on the server PC — the till itself in exe mode.
// Used by the cashier Printer page to offer the real printer names.
export const getPrinters = () => api.get("/system/printers");

// When this restaurant's local node last synced to the cloud (admin badge).
export const getSyncStatus = () => api.get("/sync/status");
