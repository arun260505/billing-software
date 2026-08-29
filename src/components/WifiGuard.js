import { useCallback, useEffect, useState } from "react";
import { Network } from "@capacitor/network";
import { getNetworkStatus } from "../services/systemService";
import { exitApp } from "../services/networkGuard";
import "../styles/NetworkGate.css";

// Reads the phone's connection type via @capacitor/network:
// "wifi" | "cellular" | "none" | "unknown". Importing the plugin (not reading it
// off the global) is what registers the native bridge — without the import it
// returns "unknown" and mobile data is not detected.
async function getConnectionType() {
    try {
        const s = await Network.getStatus();
        return s.connectionType || "unknown";
    } catch {
        if (navigator.onLine === false) return "none";
        return "unknown";
    }
}

/**
 * Cloud-model gate for the waiter APK: the app talks to the cloud, but must
 * only work on the SAME network as the cashier.
 *
 *  - On mobile data / no connection  -> blocked immediately (even before login).
 *  - On WiFi + logged in              -> verified against the cashier's WAN IP;
 *                                        a different WiFi is blocked too.
 *  - Re-checks when the connection changes, so switching to mobile data mid-use
 *    drops straight to the block screen.
 */
function WifiGuard({ children }) {

    const [status, setStatus] = useState("checking"); // checking | ok | blocked
    const [reason, setReason] = useState("");

    const check = useCallback(async () => {
        setStatus("checking");

        const conn = await getConnectionType();
        if (conn === "cellular" || conn === "none") {
            setReason("You are on mobile data. Connect to the restaurant WiFi to use the app.");
            setStatus("blocked");
            return;
        }

        // On WiFi (or unknown): if logged in, confirm it is the cashier's WiFi.
        const token = localStorage.getItem("token");
        if (token) {
            try {
                const { data } = await getNetworkStatus();
                if (data.match === false) {
                    setReason("This WiFi is not the restaurant's network. Connect to the same WiFi as the cashier.");
                    setStatus("blocked");
                    return;
                }
            } catch {
                // Transient error (server unreachable) — don't hard-block on it,
                // the API calls themselves will surface real failures.
            }
        }

        setStatus("ok");
    }, []);

    useEffect(() => { check(); }, [check]);

    // Re-check on connection change and when the app returns to foreground.
    useEffect(() => {
        let handle;
        // addListener returns a Promise<PluginListenerHandle> in Capacitor.
        Network.addListener("networkStatusChange", () => check())
            .then((h) => { handle = h; })
            .catch(() => { /* ignore */ });

        const onVis = () => { if (document.visibilityState === "visible") check(); };
        document.addEventListener("visibilitychange", onVis);
        window.addEventListener("online", check);
        window.addEventListener("offline", check);
        return () => {
            try { handle?.remove?.(); } catch { /* ignore */ }
            document.removeEventListener("visibilitychange", onVis);
            window.removeEventListener("online", check);
            window.removeEventListener("offline", check);
        };
    }, [check]);

    if (status === "ok") return children;

    if (status === "checking") {
        return (
            <div className="netgate-page">
                <div className="netgate-card">
                    <div className="netgate-spinner" />
                    <p className="netgate-checking">Checking network…</p>
                </div>
            </div>
        );
    }

    return (
        <div className="netgate-page">
            <div className="netgate-card">

                <div className="netgate-icon">📶</div>
                <h1>Network changed</h1>
                <p className="netgate-body">{reason}</p>

                <div className="netgate-actions">
                    <button
                        type="button"
                        className="netgate-btn netgate-btn-primary"
                        onClick={check}
                    >
                        Try Again
                    </button>
                    <button
                        type="button"
                        className="netgate-btn netgate-btn-secondary"
                        onClick={exitApp}
                    >
                        Close App
                    </button>
                </div>

            </div>
        </div>
    );
}

export default WifiGuard;
