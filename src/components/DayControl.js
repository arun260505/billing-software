import { useState, useEffect, useCallback } from "react";
import { getDayState, openDay, closeDay } from "../services/dayService";
import "../styles/DayControl.css";

// Open/close the business day. Drop <DayControl /> into a POS screen:
//  - a past day with sales but no close  -> blocking pop-up to close it first
//  - today not opened                     -> blocking "Open day" prompt
//  - today closed                         -> blocking "Day closed" (with Reopen)
//  - open                                 -> a "Close Day" button + cash-up modal
// Everything is a real in-app modal, never a browser alert. If the API can't be
// reached it renders nothing, so a network blip never blocks billing.

const rupee = (n) => `₹${(Number(n) || 0).toFixed(2)}`;

function fmtDate(d) {
    if (!d) return "";
    const dt = new Date(d + "T00:00:00");
    if (isNaN(dt)) return d;
    return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function SummaryRows({ s }) {
    if (!s) return null;
    return (
        <div className="dayctl-summary">
            <div className="dayctl-row"><span>Bills</span><b>{s.bill_count}</b></div>
            <div className="dayctl-row"><span>Gross sales</span><b>{rupee(s.gross_sales)}</b></div>
            {Number(s.discount_total) > 0 && <div className="dayctl-row"><span>Discount</span><b>-{rupee(s.discount_total)}</b></div>}
            <div className="dayctl-row"><span>Tax / charges</span><b>{rupee(s.tax_total)}</b></div>
            <div className="dayctl-row dayctl-row-strong"><span>Net sales</span><b>{rupee(s.net_sales)}</b></div>
            <div className="dayctl-split">
                <div className="dayctl-tender"><span>Cash</span><b>{rupee(s.cash_total)}</b></div>
                <div className="dayctl-tender"><span>Card</span><b>{rupee(s.card_total)}</b></div>
                <div className="dayctl-tender"><span>UPI</span><b>{rupee(s.upi_total)}</b></div>
                {Number(s.other_total) > 0 && <div className="dayctl-tender"><span>Other</span><b>{rupee(s.other_total)}</b></div>}
            </div>
            <div className="dayctl-row dayctl-row-total"><span>Collected</span><b>{rupee(s.collected_total)}</b></div>
        </div>
    );
}

// gate=true (a POS): block billing until the day is opened, and while it's
// closed. gate=false (the owner's admin panel): no blocking prompts, just the
// Close Day button and the forgot-to-close pop-up.
export default function DayControl({ gate = true }) {
    const [state, setState] = useState(null);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");
    const [showClose, setShowClose] = useState(false);   // today's cash-up modal open
    const [confirming, setConfirming] = useState(false); // second-step confirm
    const [counted, setCounted] = useState("");
    const [notes, setNotes] = useState("");

    const refresh = useCallback(async () => {
        try {
            const res = await getDayState();
            setState(res.data?.data || null);
        } catch (e) {
            setState({ error: true });   // never block the POS on a failed check
        }
    }, []);

    useEffect(() => { refresh(); }, [refresh]);

    const doOpen = async () => {
        setBusy(true); setErr("");
        try { await openDay(); await refresh(); }
        catch (e) { setErr(e.response?.data?.message || "Could not open the day."); }
        finally { setBusy(false); }
    };

    const doClose = async (date) => {
        setBusy(true); setErr("");
        try {
            await closeDay({ date, counted_cash: counted === "" ? null : Number(counted), notes });
            setShowClose(false); setConfirming(false); setCounted(""); setNotes("");
            await refresh();
        } catch (e) {
            setErr(e.response?.data?.message || "Could not close the day.");
        } finally { setBusy(false); }
    };

    if (!state || state.error) return null;

    // 1) A past day with sales was never closed — must be cleared first.
    if (state.pending_date) {
        const s = state.pending_summary;
        return (
            <div className="dayctl-overlay">
                <div className="dayctl-modal">
                    <h3>Close {fmtDate(state.pending_date)} sales</h3>
                    <p className="dayctl-sub">This day wasn't closed. Review the totals and close it to continue.</p>
                    <SummaryRows s={s} />
                    {err && <div className="dayctl-err">{err}</div>}
                    <button className="dayctl-primary" disabled={busy} onClick={() => doClose(state.pending_date)}>
                        {busy ? "Closing…" : `Close ${fmtDate(state.pending_date)}`}
                    </button>
                </div>
            </div>
        );
    }

    // In the owner's panel (no gating): once handled the pending day above, only
    // offer the Close button, and show nothing once today is already closed.
    if (!gate && state.is_closed) return null;

    // 2) Today closed — billing is done for the day (with a Reopen escape hatch).
    if (gate && state.is_closed) {
        return (
            <div className="dayctl-overlay">
                <div className="dayctl-modal">
                    <h3>Day closed</h3>
                    <p className="dayctl-sub">Today's sales are closed. Open the day again only if you need to keep billing.</p>
                    {err && <div className="dayctl-err">{err}</div>}
                    <button className="dayctl-primary" disabled={busy} onClick={doOpen}>
                        {busy ? "Opening…" : "Open the day again"}
                    </button>
                </div>
            </div>
        );
    }

    // 3) Today not opened yet — must open before billing (POS only).
    if (gate && state.status === "none") {
        return (
            <div className="dayctl-overlay">
                <div className="dayctl-modal">
                    <h3>Open the day</h3>
                    <p className="dayctl-sub">Open {fmtDate(state.date)} to start billing.</p>
                    {err && <div className="dayctl-err">{err}</div>}
                    <button className="dayctl-primary" disabled={busy} onClick={doOpen}>
                        {busy ? "Opening…" : "Open day"}
                    </button>
                </div>
            </div>
        );
    }

    // 4) Open — a Close Day button, and the cash-up modal when it's tapped.
    return (
        <>
            <button className="dayctl-close-btn" onClick={() => { setShowClose(true); setConfirming(false); setErr(""); }}>
                Close Day
            </button>

            {showClose && (
                <div className="dayctl-overlay" onClick={() => !busy && setShowClose(false)}>
                    <div className="dayctl-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>Close {fmtDate(state.date)}</h3>
                        <p className="dayctl-sub">Check the collection before closing.</p>
                        <SummaryFetcher date={state.date} render={(s) => <SummaryRows s={s} />} />

                        <label className="dayctl-field">
                            <span>Cash counted (optional)</span>
                            <input type="number" min="0" inputMode="decimal" placeholder="Count the drawer"
                                value={counted} onChange={(e) => setCounted(e.target.value)} disabled={busy} />
                        </label>
                        <label className="dayctl-field">
                            <span>Note (optional)</span>
                            <input type="text" placeholder="Anything to record" maxLength={200}
                                value={notes} onChange={(e) => setNotes(e.target.value)} disabled={busy} />
                        </label>

                        {err && <div className="dayctl-err">{err}</div>}

                        {!confirming ? (
                            <div className="dayctl-actions">
                                <button className="dayctl-ghost" disabled={busy} onClick={() => setShowClose(false)}>Cancel</button>
                                <button className="dayctl-primary" disabled={busy} onClick={() => setConfirming(true)}>Close Day</button>
                            </div>
                        ) : (
                            <div className="dayctl-confirm">
                                <p>Close the day now? You'll need to <b>open the day again tomorrow</b> before billing.</p>
                                <div className="dayctl-actions">
                                    <button className="dayctl-ghost" disabled={busy} onClick={() => setConfirming(false)}>Back</button>
                                    <button className="dayctl-primary" disabled={busy} onClick={() => doClose(state.date)}>
                                        {busy ? "Closing…" : "Yes, close the day"}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}

// Fetches today's live summary for the close modal (kept out of the blocking
// state so opening the modal always shows the latest figures).
function SummaryFetcher({ date, render }) {
    const [s, setS] = useState(null);
    useEffect(() => {
        let live = true;
        import("../services/dayService").then(({ getDaySummary }) =>
            getDaySummary(date).then((r) => { if (live) setS(r.data?.data?.summary || null); }).catch(() => {})
        );
        return () => { live = false; };
    }, [date]);
    return render(s);
}
