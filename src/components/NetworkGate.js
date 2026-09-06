import { useCallback, useEffect, useState } from "react";

import {
    isServerReachable,
    isNativeApp,
    exitApp,
    currentApiBase
} from "../services/networkGuard";
import { clearStoredServer, setManualMode } from "../services/serverConfig";
import { discoverAndStoreTill } from "../services/discovery";

import "../styles/NetworkGate.css";

/**
 * Blocks the whole app until the restaurant till answers.
 *
 * It checks once at launch, and then keeps a light heartbeat while online: if
 * the till goes away (stopped, unplugged, off the network) it re-blocks after a
 * short grace period, so the waiter can't keep taking orders against a till that
 * isn't there. One missed beat is tolerated (a brief WiFi blip must not wall a
 * waiter mid-order); it re-blocks only after two consecutive misses.
 */
function NetworkGate({ children }) {

    // "checking" | "searching" | "online" | "offline"
    const [status, setStatus] = useState("checking");

    const runCheck = useCallback(async () => {

        setStatus("checking");

        // 1) Do we already know the till (remembered from a prior launch)?
        if (await isServerReachable()) {
            setStatus("online");
            return;
        }

        // 2) Not known / moved (DHCP) / different network: auto-scan this WiFi.
        //    Finds the till by itself — the waiter never types an IP. On a
        //    different network nothing answers and we fall through to offline.
        setStatus("searching");
        const found = await discoverAndStoreTill();
        setStatus(found ? "online" : "offline");

    }, []);

    useEffect(() => {
        runCheck();
    }, [runCheck]);

    // While blocked, re-check when the waiter comes back from the WiFi settings
    // screen so connecting to the right network recovers on its own. Bound only
    // in the blocked state, so a live session is never re-probed.
    useEffect(() => {

        if (status !== "offline") {
            return undefined;
        }

        const recheck = () => {
            if (document.visibilityState === "visible") {
                runCheck();
            }
        };

        document.addEventListener("visibilitychange", recheck);
        window.addEventListener("online", runCheck);

        return () => {
            document.removeEventListener("visibilitychange", recheck);
            window.removeEventListener("online", runCheck);
        };

    }, [status, runCheck]);

    // Heartbeat while online: if the till stops answering, re-block. Two
    // consecutive misses (a ~20s grace) before walling, so a momentary WiFi
    // hiccup doesn't kick a waiter out of an open cart.
    useEffect(() => {
        if (status !== "online") {
            return undefined;
        }
        let misses = 0;
        let cancelled = false;
        const id = setInterval(async () => {
            const ok = await isServerReachable();
            if (cancelled) return;
            if (ok) { misses = 0; return; }
            misses += 1;
            if (misses >= 2) setStatus("offline");
        }, 10000);
        return () => { cancelled = true; clearInterval(id); };
    }, [status]);

    if (status === "online") {
        return children;
    }

    if (status === "checking" || status === "searching") {

        const message = status === "searching"
            ? "Searching for the restaurant server on this WiFi…"
            : "Connecting to restaurant server…";

        return (
            <div className="netgate-page">
                <div className="netgate-card">
                    <div className="netgate-spinner" />
                    <p className="netgate-checking">{message}</p>
                </div>
            </div>
        );

    }

    return (
        <div className="netgate-page">

            <div className="netgate-card">

                <div className="netgate-icon">📶</div>

                <h1>Can&apos;t reach the restaurant till</h1>

                <p className="netgate-body">
                    This app needs the restaurant till to be switched on and on the
                    same WiFi. Make sure the till (billing PC) is running, then try
                    again.
                </p>

                <div className="netgate-actions">

                    <button
                        type="button"
                        className="netgate-btn netgate-btn-primary"
                        onClick={runCheck}
                    >
                        Try Again
                    </button>

                    {isNativeApp() && (
                        <button
                            type="button"
                            className="netgate-btn netgate-btn-secondary"
                            onClick={exitApp}
                        >
                            Close App
                        </button>
                    )}

                </div>

                {/* Escape hatch for an unusual network the scan can't cover:
                    let a manager type the address instead of reinstalling. */}
                {isNativeApp() && (
                    <button
                        type="button"
                        className="netgate-link"
                        onClick={() => {
                            setManualMode(true);
                            clearStoredServer();
                            window.location.reload();
                        }}
                    >
                        Enter server manually
                    </button>
                )}

                {/* Shown so a manager can tell "wrong WiFi" from "wrong address"
                    without needing a developer on the phone. */}
                <p className="netgate-server">Server: {currentApiBase() || "(not set)"}</p>

            </div>

        </div>
    );

}

export default NetworkGate;
