import { useState } from "react";
import { setStoredServer } from "../services/serverConfig";
import "../styles/NetworkGate.css";

/**
 * First-launch setup for the native waiter app: enter the restaurant server
 * address (read off the cashier's "Server IP" page). Stored per-device, so it
 * is asked once and remembered until the app is reinstalled.
 */
function ServerConfig({ onSaved }) {

    const [value, setValue] = useState("");
    const [error, setError] = useState("");

    const save = () => {
        const host = value.trim().replace(/^https?:\/\//, "").replace(/[/].*$/, "");
        // Accept "192.168.0.50" or "192.168.0.50:5000".
        if (!/^[0-9A-Za-z.-]+(:\d{2,5})?$/.test(host)) {
            setError("Enter a valid address, e.g. 192.168.0.50");
            return;
        }
        setStoredServer(host);
        // Reload so api.js picks up the new baseURL, then the network gate runs.
        if (onSaved) onSaved();
        else window.location.reload();
    };

    return (
        <div className="netgate-page">
            <div className="netgate-card">

                <div className="netgate-icon">🔌</div>
                <h1>Connect to restaurant server</h1>
                <p className="netgate-body">
                    Ask the cashier to open <b>Server IP</b> and read the address.
                    Type it here. You only do this once.
                </p>

                <input
                    className="srvcfg-input"
                    value={value}
                    onChange={(e) => { setValue(e.target.value); setError(""); }}
                    placeholder="192.168.0.50"
                    inputMode="decimal"
                    autoFocus
                />

                {error && <p className="srvcfg-error">{error}</p>}

                <div className="netgate-actions">
                    <button
                        type="button"
                        className="netgate-btn netgate-btn-primary"
                        onClick={save}
                    >
                        Connect
                    </button>
                </div>

                <p className="netgate-server">Port 5000 is used unless you add one (e.g. :8080)</p>

            </div>
        </div>
    );
}

export default ServerConfig;
