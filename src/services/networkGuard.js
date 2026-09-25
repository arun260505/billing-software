import axios from "axios";
import { App } from "@capacitor/app";
import {
    resolveApiBaseUrl,
    resolveHealthUrl,
    isNativeApp
} from "./serverConfig";

// Long enough for a slow/busy restaurant WiFi handshake, short enough that a
// waiter standing at a table is not staring at a blank screen. Raised over time
// because a congested / WEAK WiFi was timing out healthy probes and flapping the
// app into the "searching" screen — the till was fine, the signal was just weak.
const PROBE_TIMEOUT_MS = 9000;

// Between internal retries of a single "is it reachable?" question, on weak WiFi.
const RETRY_GAP_MS = 700;

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
 *
 * `retries` extra attempts (with a short gap) absorb the odd dropped packet on a
 * weak signal, so one lost probe doesn't get read as "the till is gone" and wall
 * the waiter into the searching screen. Callers on the fast path pass 0 (default);
 * the heartbeat/reconnect pass 1–2 so a real disconnect is still caught quickly
 * but a weak-signal blip is ridden out.
 */
export async function isServerReachable(retries = 0) {
    const url = resolveHealthUrl();
    if (!url) return false;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
            await probe.get(url);
            return true;
        } catch {
            if (attempt < retries) await new Promise((r) => setTimeout(r, RETRY_GAP_MS));
        }
    }
    return false;
}

export { isNativeApp };

/**
 * Closes the Android app. Reads the plugin off the Capacitor global rather than
 * importing @capacitor/app so the web build still compiles without it.
 */
export function exitApp() {
    try {
        App.exitApp();
        return;
    } catch {
        /* web: not implemented — fall through */
    }
    window.close();
}

// Shown on the gate so a manager can tell "wrong WiFi" from "wrong address".
export function currentApiBase() {
    return resolveApiBaseUrl();
}
