import { useCallback, useEffect, useState } from "react";

import {
    isServerReachable,
    isNativeApp,
    exitApp,
    currentApiBase
} from "../services/networkGuard";
import { clearStoredServer } from "../services/serverConfig";

import "../styles/NetworkGate.css";

/**
 * Blocks the whole app at launch until the restaurant server answers.
 *
 * IMPORTANT — this gate runs ONCE, at startup. After it passes it never
 * re-blocks, because a WiFi dead spot mid-service must not throw a full-screen
 * wall over a waiter with an open cart. Dropouts during a session are the job
 * of the offline banner / retry handling, not of this gate.
 */
function NetworkGate({ children }) {

    // "checking" | "online" | "offline"
    const [status, setStatus] = useState("checking");

    const runCheck = useCallback(async () => {

        setStatus("checking");

        const reachable = await isServerReachable();

        setStatus(reachable ? "online" : "offline");

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

    if (status === "online") {
        return children;
    }

    if (status === "checking") {

        return (
            <div className="netgate-page">
                <div className="netgate-card">
                    <div className="netgate-spinner" />
                    <p className="netgate-checking">Connecting to restaurant server…</p>
                </div>
            </div>
        );

    }

    return (
        <div className="netgate-page">

            <div className="netgate-card">

                <div className="netgate-icon">📶</div>

                <h1>You are not on the restaurant network</h1>

                <p className="netgate-body">
                    This app only works on the restaurant&apos;s WiFi. Connect to it
                    and try again.
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

                {/* Escape hatch: if the server IP is simply wrong, let them
                    re-enter it instead of reinstalling the app. */}
                {isNativeApp() && (
                    <button
                        type="button"
                        className="netgate-link"
                        onClick={() => { clearStoredServer(); window.location.reload(); }}
                    >
                        Change server address
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
