// Resolves which backend the app talks to.
//
// - In the native waiter APK: the address the user typed on first launch,
//   stored per-device. One universal APK works on any restaurant network.
// - In a browser (cashier / cloud / dev): the build-time REACT_APP_API_URL
//   (e.g. "/api" behind nginx), never the stored value. So the cashier's
//   Server IP page never accidentally repoints the cashier's own app.

const HOST_KEY = "inwallz_server_host";

export function isNativeApp() {
    return Boolean(window.Capacitor?.isNativePlatform?.());
}

export function getStoredServer() {
    try {
        return localStorage.getItem(HOST_KEY) || null;
    } catch {
        return null;
    }
}

export function setStoredServer(host) {
    const cleaned = String(host || "")
        .trim()
        .replace(/^https?:\/\//, "")
        .replace(/\/+$/, "");
    try {
        localStorage.setItem(HOST_KEY, cleaned);
    } catch {
        /* private mode — nothing we can do */
    }
    return cleaned;
}

export function clearStoredServer() {
    try {
        localStorage.removeItem(HOST_KEY);
    } catch {
        /* ignore */
    }
}

// Manual-entry escape hatch. By default the waiter app auto-discovers the till
// on the WiFi (no IP typing); this flag is set only when the user taps
// "Enter server manually" on the offline screen, to force the ServerConfig
// screen for an unusual network the scan could not cover.
const MANUAL_KEY = "inwallz_manual_server";

export function isManualMode() {
    try {
        return localStorage.getItem(MANUAL_KEY) === "1";
    } catch {
        return false;
    }
}

export function setManualMode(on) {
    try {
        if (on) localStorage.setItem(MANUAL_KEY, "1");
        else localStorage.removeItem(MANUAL_KEY);
    } catch {
        /* ignore */
    }
}

// "192.168.0.50" -> "http://192.168.0.50:5000/api"
// "192.168.0.50:8080" -> "http://192.168.0.50:8080/api"
function authorityToBase(host) {
    const authority = host.includes(":") ? host : `${host}:5000`;
    return `http://${authority}/api`;
}

export function resolveApiBaseUrl() {
    // A build-time URL always wins — this is how the CLOUD APK is baked to talk
    // to https://billing.inwallz.in/api, and how the cloud/cashier browser uses
    // "/api" behind nginx.
    if (process.env.REACT_APP_API_URL) {
        return process.env.REACT_APP_API_URL;
    }
    // No baked URL: the native LAN APK uses the per-device address entered on
    // first launch; a browser dev build falls back to localhost.
    if (isNativeApp()) {
        const host = getStoredServer();
        return host ? authorityToBase(host) : "";
    }
    return "http://localhost:5000/api";
}

// True when the build has a fixed backend URL baked in (cloud APK / nginx),
// so the app should NOT show the "enter server address" setup screen.
export function hasBakedApiUrl() {
    return Boolean(process.env.REACT_APP_API_URL);
}

export function resolveHealthUrl() {
    const base = resolveApiBaseUrl();
    return base ? `${base.replace(/\/$/, "")}/health` : "";
}
