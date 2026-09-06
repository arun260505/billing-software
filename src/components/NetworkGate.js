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

    // While blocked (offline / stuck searching), keep probing the till on a timer
    // and RELOAD the moment it answers again. This is what auto-recovers the app:
    //  - when only the till's internet is toggled, the PHONE's network never
    //    changes, so the browser 'online' event never fires — a poll is the only
    //    signal the till is back;
    //  - after a WiFi drop+return the Android WebView's networking stays wedged,
    //    so an in-place re-probe hangs forever (why clearing from recents was the
    //    only fix). A reload resets the WebView's network stack, and the
    //    persistent cart is restored afterwards, so nothing is lost.
    useEffect(() => {

        if (status === "online") {
            return undefined;
        }

        let cancelled = false;
        const reloadNow = () => { if (!cancelled) window.location.reload(); };

        const id = setInterval(async () => {
            if (await isServerReachable() && !cancelled) reloadNow();
        }, 5000);

        // When the waiter returns to the app, probe once right away (background
        // timers are throttled, so the poll may have been asleep) and reload if
        // the till is back. The phone's own 'online' event is a clean restart cue.
        const onVisible = async () => {
            if (document.visibilityState === "visible" && await isServerReachable() && !cancelled) reloadNow();
        };
        document.addEventListener("visibilitychange", onVisible);
        window.addEventListener("online", reloadNow);

        return () => {
            cancelled = true;
            clearInterval(id);
            document.removeEventListener("visibilitychange", onVisible);
            window.removeEventListener("online", reloadNow);
        };

    }, [status]);

    // Heartbeat while online: if the till stops answering, re-block. Two
    // consecutive misses (a ~20s grace) before walling, so a momentary WiFi
    // hiccup doesn't kick a waiter out of an open cart. AND react at once when a
    // real request (e.g. sending an order) just failed to reach the till — that
    // is a concrete signal the till is gone, so confirm and block immediately
    // rather than making the waiter wait for the next heartbeat.
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
        }, 5000);

        const onUnreachable = async () => {
            // Confirm with one probe so a single odd request doesn't wall the
            // app; if the till really isn't answering, block now.
            const ok = await isServerReachable();
            if (!cancelled && !ok) setStatus("offline");
        };
        window.addEventListener("inwallz:server-unreachable", onUnreachable);

        return () => {
            cancelled = true;
            clearInterval(id);
            window.removeEventListener("inwallz:server-unreachable", onUnreachable);
        };
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
                        onClick={() => window.location.reload()}
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
