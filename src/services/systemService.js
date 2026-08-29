import api from "./api";

// Cashier browser records the restaurant's current public/WAN IP.
export const registerNetwork = () => api.post("/system/register-network");

// Waiter app checks it is on the same network as the cashier.
export const getNetworkStatus = () => api.get("/system/network-status");

// Server LAN IP detection (used by the cashier Server IP page).
export const getServerIp = () => api.get("/system/server-ip");
