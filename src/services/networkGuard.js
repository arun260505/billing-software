import axios from "axios";
import {
    resolveApiBaseUrl,
    resolveHealthUrl,
    isNativeApp
} from "./serverConfig";

// Long enough for a slow WiFi handshake, short enough that a waiter standing
// at a table is not staring at a blank screen.
const PROBE_TIMEOUT_MS = 4000;

// Not the shared `api` instance — the probe must stay a dumb "can I reach this
// box at all" question with no auth and no redirects.
const probe = axios.create({
    timeout: PROBE_TIMEOUT_MS,
    validateStatus: () => true
});

/**
 * True when the backend answered, false when it could not be reached.
 * Any HTTP status counts as reachable — the question is "am I on the right
 * network", not "is this route healthy".
 */
export async function isServerReachable() {
    const url = resolveHealthUrl();
    if (!url) return false;
    try {
        await probe.get(url);
        return true;
    } catch {
        return false;
    }
}

export { isNativeApp };

/**
 * Closes the Android app. Reads the plugin off the Capacitor global rather than
 * importing @capacitor/app so the web build still compiles without it.
 */
export function exitApp() {
    try {
        const appPlugin = window.Capacitor?.Plugins?.App;
        if (appPlugin?.exitApp) {
            appPlugin.exitApp();
            return;
        }
    } catch {
        /* fall through */
    }
    window.close();
}

// Shown on the gate so a manager can tell "wrong WiFi" from "wrong address".
export function currentApiBase() {
    return resolveApiBaseUrl();
}
