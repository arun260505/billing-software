import { useEffect, useState, useCallback } from "react";
import "../styles/AppNotify.css";

// A single on-screen popup that replaces the browser's "localhost:5050 says …"
// alert. Fire it from anywhere with notify("message"), or let installAlertBridge()
// route every existing window.alert() call through it — so the whole app gets the
// same tidy popup with no change to the call sites.
//
// Popups queue and show one at a time (like alert did). An "error"/"warning" one
// waits for OK; a plain one also auto-dismisses after a few seconds.

let seq = 0;
const listeners = new Set();

export function notify(message, opts = {}) {
    const text = String(message ?? "").trim();
    if (!text) return;
    const item = { id: ++seq, message: text, tone: opts.tone || "info" };
    listeners.forEach((l) => l(item));
}

// Point window.alert at notify() once, so every alert() in the app becomes an
// in-app popup. Kept idempotent and guarded so a failure can never break a page.
export function installAlertBridge() {
    if (typeof window === "undefined" || window.__inwallzAlertBridged) return;
    window.__inwallzAlertBridged = true;
    try {
        const native = window.alert ? window.alert.bind(window) : null;
        window.alert = (m) => { try { notify(m); } catch (e) { if (native) native(m); } };
    } catch (e) { /* leave the native alert in place */ }
}

// A tone is inferred from wording so money/failed messages don't auto-dismiss.
function toneOf(msg) {
    return /refund|collect|could not|couldn'?t|failed|blocked|invalid|error|not match|try again/i.test(msg)
        ? "alert" : "info";
}

export default function AppNotify() {
    const [items, setItems] = useState([]);

    useEffect(() => {
        const onAdd = (item) => setItems((prev) => [...prev, item]);
        listeners.add(onAdd);
        return () => { listeners.delete(onAdd); };
    }, []);

    const dismiss = useCallback((id) => setItems((prev) => prev.filter((i) => i.id !== id)), []);

    const cur = items[0];

    // Auto-dismiss the light, informational ones; keep money/error ones until OK.
    useEffect(() => {
        if (!cur) return;
        const tone = cur.tone === "info" ? toneOf(cur.message) : cur.tone;
        if (tone === "info") {
            const t = setTimeout(() => dismiss(cur.id), 4500);
            return () => clearTimeout(t);
        }
    }, [cur, dismiss]);

    if (!cur) return null;
    const tone = cur.tone === "info" ? toneOf(cur.message) : cur.tone;

    return (
        <div className="appn-overlay" onClick={() => dismiss(cur.id)}>
            <div className={`appn-card appn-${tone}`} onClick={(e) => e.stopPropagation()} role="alertdialog" aria-live="assertive">
                <p className="appn-msg">{cur.message}</p>
                <button className="appn-ok" onClick={() => dismiss(cur.id)} autoFocus>OK</button>
            </div>
        </div>
    );
}
