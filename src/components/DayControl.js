import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getDayState, openDay, closeDay, getDaySummary } from "../services/dayService";
import "../styles/DayControl.css";

// Open/close the business day (cash-up). Usage:
//   <DayProvider gate>            wrap the screen; renders the blocking prompts
//                                 (open/pending/closed) and the cash-up modal
//   <DayButton />                 a header button (next to Logout) to close the
//                                 day while it's open
// gate=true (a POS) blocks billing until the day is open and while it's closed.
// gate=false (owner's panel) shows no blocking prompts — only the pending
// forgot-to-close pop-up and the Close button. Never a browser alert; if the
// state can't be loaded nothing renders, so a blip never blocks billing.

const DayCtx = createContext(null);

const rupee = (n) => `₹${(Number(n) || 0).toFixed(2)}`;

function fmtDate(d) {
    if (!d) return "";
    const dt = new Date(d + "T00:00:00");
    return isNaN(dt) ? d : dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function SummaryRows({ s }) {
    if (!s) return <p className="dayctl-loading">Loading totals…</p>;
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

export function DayProvider({ gate = true, children }) {
    const [state, setState] = useState(null);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");
    const [showClose, setShowClose] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [counted, setCounted] = useState("");
    const [notes, setNotes] = useState("");
    const [todaySummary, setTodaySummary] = useState(null);

    const refresh = useCallback(async () => {
        try { const res = await getDayState(); setState(res.data?.data || null); }
        catch (e) { setState({ error: true }); }
    }, []);

    useEffect(() => { refresh(); }, [refresh]);

    const openCloseModal = useCallback(async () => {
        setShowClose(true); setConfirming(false); setErr(""); setTodaySummary(null);
        if (state && state.date) {
            try { const r = await getDaySummary(state.date); setTodaySummary(r.data?.data?.summary || null); }
            catch (e) { /* leave loading */ }
        }
    }, [state]);

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

    const ready = state && !state.error;

    return (
        <DayCtx.Provider value={{ state: ready ? state : null, openCloseModal }}>
            {children}

            {/* 1) A past day with sales was never closed — clear it first. */}
            {ready && state.pending_date && (
                <div className="dayctl-overlay">
                    <div className="dayctl-modal">
                        <h3>Close {fmtDate(state.pending_date)} sales</h3>
                        <p className="dayctl-sub">This day wasn't closed. Review the totals and close it to continue.</p>
                        <SummaryRows s={state.pending_summary} />
                        {err && <div className="dayctl-err">{err}</div>}
                        <button className="dayctl-primary" disabled={busy} onClick={() => doClose(state.pending_date)}>
                            {busy ? "Closing…" : `Close ${fmtDate(state.pending_date)}`}
                        </button>
                    </div>
                </div>
            )}

            {/* 2) Today closed (POS only) — done for the day, with a Reopen. */}
            {ready && gate && !state.pending_date && state.is_closed && (
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
            )}

            {/* 3) Today not opened (POS only) — open before billing. */}
            {ready && gate && !state.pending_date && state.status === "none" && (
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
            )}

            {/* 4) Cash-up modal, opened from the header button. */}
            {ready && showClose && (
                <div className="dayctl-overlay" onClick={() => !busy && setShowClose(false)}>
                    <div className="dayctl-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>Close {fmtDate(state.date)}</h3>
                        <p className="dayctl-sub">Check the collection before closing.</p>
                        <SummaryRows s={todaySummary} />
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
        </DayCtx.Provider>
    );
}

// A header button (place next to Logout). Shows "Close Day" while the day is
// open; hidden otherwise (the blocking prompts handle open/closed).
export function DayButton({ className = "pos-dayclose" }) {
    const ctx = useContext(DayCtx);
    if (!ctx || !ctx.state) return null;
    // Show while there is a day to close (open, or not yet formally opened);
    // hide once today is already closed.
    if (ctx.state.is_closed) return null;
    return (
        <button type="button" className={className} onClick={ctx.openCloseModal}>
            Close Day
        </button>
    );
}

export default DayProvider;
