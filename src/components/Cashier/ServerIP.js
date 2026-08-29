import { useCallback, useEffect, useState } from "react";
import api from "../../services/api";
import "../../styles/Cashier/ServerIP.css";

// Where the confirmed address is kept so it survives reloads and can be
// read back / edited. Per-browser (localStorage) — this is the cashier's own
// record of "the address to type into the waiter phones".
const STORAGE_KEY = "inwallz_server_ip";

function ServerIP() {

    const [detected, setDetected] = useState(null); // { best, port, addresses[] }
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [value, setValue] = useState("");         // the editable IP field
    const [saved, setSaved] = useState("");         // last stored value
    const [flash, setFlash] = useState("");

    const port = detected?.port || 5000;

    const loadDetected = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await api.get("/system/server-ip");
            setDetected(res.data);
            // Pre-fill the field the first time: stored value wins, else best guess.
            setValue((v) => v || localStorage.getItem(STORAGE_KEY) || res.data.best || "");
        } catch (e) {
            setError("Could not reach the server to detect its address.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        setSaved(localStorage.getItem(STORAGE_KEY) || "");
        loadDetected();
    }, [loadDetected]);

    const save = () => {
        const cleaned = value.trim();
        // Accept a bare IPv4 or hostname; strip any http:// and trailing bits.
        const host = cleaned.replace(/^https?:\/\//, "").replace(/[/:].*$/, "");
        if (!host) {
            setFlash("Enter an address first.");
            return;
        }
        localStorage.setItem(STORAGE_KEY, host);
        setSaved(host);
        setValue(host);
        setFlash("Saved.");
        setTimeout(() => setFlash(""), 2500);
    };

    const useDetected = () => {
        if (detected?.best) setValue(detected.best);
    };

    const waiterUrl = saved ? `http://${saved}:${port}` : "";

    const copyUrl = async () => {
        if (!waiterUrl) return;
        try {
            await navigator.clipboard.writeText(waiterUrl);
            setFlash("URL copied.");
            setTimeout(() => setFlash(""), 2000);
        } catch {
            setFlash("Copy failed — select and copy manually.");
        }
    };

    return (
        <div className="srvip-wrap">
            <div className="srvip-card">

                <h2 className="srvip-title">📡 Server IP</h2>
                <p className="srvip-sub">
                    This is the address the waiter phones connect to. Enter it once
                    on each phone. All devices must be on the same WiFi.
                </p>

                {/* Detected */}
                <div className="srvip-section">
                    <div className="srvip-label">Detected on this PC</div>
                    {loading ? (
                        <div className="srvip-muted">Detecting…</div>
                    ) : error ? (
                        <div className="srvip-error">{error}</div>
                    ) : (
                        <>
                            <div className="srvip-detected">
                                <span className="srvip-ip">{detected?.best || "—"}</span>
                                <button className="srvip-btn ghost" onClick={loadDetected}>
                                    ↻ Re-detect
                                </button>
                            </div>
                            {detected?.addresses?.length > 1 && (
                                <div className="srvip-others">
                                    Other adapters:{" "}
                                    {detected.addresses.slice(1).map((a) => (
                                        <button
                                            key={a.address}
                                            className="srvip-chip"
                                            title={a.iface}
                                            onClick={() => setValue(a.address)}
                                        >
                                            {a.address}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Manual entry / change */}
                <div className="srvip-section">
                    <div className="srvip-label">Server address (edit if needed)</div>
                    <div className="srvip-entry">
                        <input
                            className="srvip-input"
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            placeholder="e.g. 192.168.0.50"
                            inputMode="decimal"
                        />
                        <button className="srvip-btn ghost" onClick={useDetected}>
                            Use detected
                        </button>
                        <button className="srvip-btn primary" onClick={save}>
                            Save
                        </button>
                    </div>
                    {flash && <div className="srvip-flash">{flash}</div>}
                </div>

                {/* Result to type into phones */}
                {saved && (
                    <div className="srvip-result">
                        <div className="srvip-label">Enter this on each waiter phone</div>
                        <div className="srvip-url-row">
                            <code className="srvip-url">{waiterUrl}</code>
                            <button className="srvip-btn ghost" onClick={copyUrl}>Copy</button>
                        </div>
                        <div className="srvip-hint">
                            Stored address: <b>{saved}</b> · Port <b>{port}</b>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}

export default ServerIP;
