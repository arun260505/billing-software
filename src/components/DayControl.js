import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getDayState, openDay, closeDay, getDaySummary } from "../services/dayService";
import "../styles/DayControl.css";

// Open/close the business day (cash-up). Three ways in:
//   <DayProvider gate>   wrap a POS: blocks billing until the day is open, shows
//                        the open/pending/closed prompts + the cash-up modal.
//   <DayProvider gate={false}>  owner panel: only the forgot-to-close pop-up.
//   <DayButton />        a button inside a DayProvider (reads its context).
//   <HeaderDayButton />  a SELF-CONTAINED Open/Close button for the admin top
//                        bar (next to Logout) — fetches its own state, no
//                        provider needed. Owner/admin only (that's who sees the
//                        header). Never a browser alert.

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

// All the day state + actions, so a POS provider and a standalone header button
// can share one implementation.
function useDay() {
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
        setCounted(""); setNotes("");
        // Pull the day's live totals so the cashier can check the collection.
        try {
            const r = await getDaySummary();
            setTodaySummary(r.data?.data?.summary || null);
        } catch (e) { /* leave loading — never blocks the close */ }
    }, []);

    const doOpen = useCallback(async () => {
        setBusy(true); setErr("");
        try { await openDay(); await refresh(); }
        catch (e) { setErr(e.response?.data?.message || "Could not open the day."); }
        finally { setBusy(false); }
    }, [refresh]);

    const doClose = useCallback(async (date) => {
        setBusy(true); setErr("");
        try {
            await closeDay({ date, counted_cash: counted === "" ? null : Number(counted), notes });
            setShowClose(false); setConfirming(false); setCounted(""); setNotes("");
            await refresh();
        } catch (e) {
            setErr(e.response?.data?.message || "Could not close the day.");
        } finally { setBusy(false); }
    }, [counted, notes, refresh]);

    return {
        state, busy, err, showClose, setShowClose, confirming, setConfirming,
        counted, setCounted, notes, setNotes, todaySummary,
        refresh, openCloseModal, doOpen, doClose
    };
}

// The cash-up modal (opened from a Close Day button). Two-step confirm.
function CashUpModal({ day }) {
    const { state, busy, err, showClose, setShowClose, confirming, setConfirming,
        counted, setCounted, notes, setNotes, todaySummary, doClose } = day;
    if (!showClose || !state || state.error) return null;
    return (
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
    );
}

export function DayProvider({ gate = true, children }) {
    const day = useDay();
    const { state, busy, err, doClose, doOpen, openCloseModal } = day;
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

            {/* 4) Cash-up modal, opened from a Close Day button. */}
            <CashUpModal day={day} />
        </DayCtx.Provider>
    );
}

// A button inside a DayProvider (reads its context). Shows "Close Day" while the
// day is open; hidden once today is closed (the provider's prompt handles that).
export function DayButton({ className = "pos-dayclose" }) {
    const ctx = useContext(DayCtx);
    if (!ctx || !ctx.state) return null;
    if (ctx.state.is_closed) return null;
    return (
        <button type="button" className={className} onClick={ctx.openCloseModal}>
            Close Day
        </button>
    );
}

// A self-contained Open/Close Day control for the admin top bar (next to
// Logout). Needs no DayProvider — it fetches its own state and carries its own
// cash-up modal. "Close Day" while open; "Open Day" once closed, so the owner
// can do both from the header. Renders nothing until the state is known, so a
// blip never leaves a dead button in the bar.
export function HeaderDayButton({ className = "header-dayclose" }) {
    const day = useDay();
    const { state, busy, openCloseModal, doOpen } = day;
    if (!state || state.error) return null;

    const closed = state.is_closed;
    return (
        <>
            <button
                type="button"
                className={`${className}${closed ? " is-open-action" : ""}`}
                disabled={busy}
                onClick={closed ? doOpen : openCloseModal}
            >
                {closed ? (busy ? "Opening…" : "Open Day") : "Close Day"}
            </button>
            <CashUpModal day={day} />
        </>
    );
}

export default DayProvider;
