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

// "192.168.0.50" -> "http://192.168.0.50:5000/api"
// "192.168.0.50:8080" -> "http://192.168.0.50:8080/api"
function authorityToBase(host) {
    const authority = host.includes(":") ? host : `${host}:5000`;
    return `http://${authority}/api`;
}

export function resolveApiBaseUrl() {
    if (isNativeApp()) {
        const host = getStoredServer();
        // Not configured yet — ServerConfig gates before any API call is made.
        return host ? authorityToBase(host) : "";
    }
    return process.env.REACT_APP_API_URL || "http://localhost:5000/api";
}

export function resolveHealthUrl() {
    const base = resolveApiBaseUrl();
    return base ? `${base.replace(/\/$/, "")}/health` : "";
}
