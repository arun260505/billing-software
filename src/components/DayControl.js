import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getDayState, openDay, closeDay, getDaySummary } from "../services/dayService";
import authService from "../services/authService";
import {
    openWhatsApp, getWhatsAppOverride, effectiveVia
} from "../utils/whatsappBill";
import "../styles/DayControl.css";

// Open / close the BUSINESS day (cash-up). A day runs from Open until Close, so
// after-midnight sales stay on the still-open day and reopening continues it.
//   <DayProvider gate>            a POS: blocks billing until a day is open, shows
//                                 the open prompt + the forgot-to-close notice.
//   <DayButton />                 a button inside a DayProvider (POS header).
//   <HeaderDayButton />           self-contained Open/Close for the owner top bar,
//                                 with its own notice + cash-up (no provider).

const DayCtx = createContext(null);

const rupee = (n) => `₹${(Number(n) || 0).toFixed(2)}`;

function fmtDate(d) {
    if (!d) return "";
    const dt = new Date(d + "T00:00:00");
    return isNaN(dt) ? d : dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// The Z-report as a WhatsApp message.
function buildDayReport(s, shopName, dateStr) {
    if (!s) return "";
    const L = [];
    L.push(`*${(shopName || "InWallz").trim()} — Day Sales Report*`);
    if (dateStr) L.push(fmtDate(dateStr));
    L.push("");
    L.push(`Bills: ${s.bill_count}`);
    L.push(`Gross sales: ${rupee(s.gross_sales)}`);
    if (Number(s.discount_total) > 0) L.push(`Discount: -${rupee(s.discount_total)}`);
    if (Number(s.tax_total) > 0) L.push(`Tax / charges: ${rupee(s.tax_total)}`);
    L.push(`*Net sales: ${rupee(s.net_sales)}*`);
    L.push("");
    L.push(`Cash: ${rupee(s.cash_total)}`);
    L.push(`Card: ${rupee(s.card_total)}`);
    L.push(`UPI: ${rupee(s.upi_total)}`);
    if (Number(s.other_total) > 0) L.push(`Other: ${rupee(s.other_total)}`);
    L.push(`*Collected: ${rupee(s.collected_total)}*`);
    return L.join("\n");
}

function SummaryRows({ s }) {
    if (!s) return <p className="dayctl-loading">Loading totals…</p>;
    return (
        <div className="dayctl-summary">
            <div className="dayctl-row"><span>Bills</span><b>{s.bill_count}</b></div>
            <div className="dayctl-row"><span>Gross sales</span><b>{rupee(s.gross_sales)}</b></div>
            {Number(s.discount_total) > 0 && <div className="dayctl-row"><span>Discount</span><b>-{rupee(s.discount_total)}</b></div>}
            {Number(s.tax_total) > 0 && <div className="dayctl-row"><span>Tax / charges</span><b>{rupee(s.tax_total)}</b></div>}
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

function useDay() {
    const [state, setState] = useState(null);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");
    const [showClose, setShowClose] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [counted, setCounted] = useState("");
    const [notes, setNotes] = useState("");
    const [modalSummary, setModalSummary] = useState(null);
    const [staleDismissed, setStaleDismissed] = useState(false);

    const refresh = useCallback(async () => {
        try { const res = await getDayState(); setState(res.data?.data || null); }
        catch (e) { setState({ error: true }); }
    }, []);

    // Re-check on mount, when the window regains focus (e.g. after the PC wakes /
    // the app is reopened), and once a minute — so the "close or keep billing"
    // notice appears after midnight or after a restart, not only on a manual reload.
    useEffect(() => {
        refresh();
        const t = setInterval(refresh, 60000);
        const onFocus = () => refresh();
        window.addEventListener("focus", onFocus);
        return () => { clearInterval(t); window.removeEventListener("focus", onFocus); };
    }, [refresh]);

    const openCloseModal = useCallback(async () => {
        setShowClose(true); setConfirming(false); setErr(""); setModalSummary(null); setCounted(""); setNotes("");
        try { const r = await getDaySummary(); setModalSummary(r.data?.data?.summary || null); }
        catch (e) { /* leave loading */ }
    }, []);

    const doOpen = useCallback(async () => {
        setBusy(true); setErr("");
        try { await openDay(); setStaleDismissed(false); await refresh(); }
        catch (e) { setErr(e.response?.data?.message || "Could not open the day."); }
        finally { setBusy(false); }
    }, [refresh]);

    const doClose = useCallback(async () => {
        setBusy(true); setErr("");
        try {
            await closeDay({ counted_cash: counted === "" ? null : Number(counted), notes });
            setShowClose(false); setConfirming(false); setCounted(""); setNotes(""); setStaleDismissed(false);
            await refresh();
        } catch (e) {
            setErr(e.response?.data?.message || "Could not close the day.");
        } finally { setBusy(false); }
    }, [counted, notes, refresh]);

    const shareReport = useCallback((summary, dateStr) => {
        const shop = authService.getUser?.()?.restaurant_name;
        const text = buildDayReport(summary, shop, dateStr);
        if (!text) return;
        // Open WhatsApp with the report typed in and let them pick who to send it
        // to (the "share / forward" flow) — no number to enter. The desktop app
        // opens via its whatsapp:// handler; otherwise wa.me shows the chat picker.
        const via = effectiveVia(getWhatsAppOverride(), "web");
        const url = via === "app"
            ? "whatsapp://send?text=" + encodeURIComponent(text)
            : "https://wa.me/?text=" + encodeURIComponent(text);
        if (!openWhatsApp(url, via)) {
            window.alert("WhatsApp didn't open — allow pop-ups for this page, then try again.");
        }
    }, []);

    return {
        state, busy, err, showClose, setShowClose, confirming, setConfirming,
        counted, setCounted, notes, setNotes, modalSummary,
        staleDismissed, setStaleDismissed, refresh, openCloseModal, doOpen, doClose, shareReport
    };
}

// The cash-up + Z-report modal. Two-step confirm; WhatsApp share of the report.
function CashUpModal({ day }) {
    const { state, busy, err, showClose, setShowClose, confirming, setConfirming,
        counted, setCounted, notes, setNotes, modalSummary, doClose, shareReport } = day;
    if (!showClose || !state || state.error) return null;
    const dateStr = state.active_date || state.today;
    return (
        <div className="dayctl-overlay" onClick={() => !busy && setShowClose(false)}>
            <div className="dayctl-modal" onClick={(e) => e.stopPropagation()}>
                <h3>Close {fmtDate(dateStr)}</h3>
                <p className="dayctl-sub">Check the collection, share the report, then close.</p>
                <SummaryRows s={modalSummary} />
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

                <button className="dayctl-share" disabled={busy || !modalSummary}
                    onClick={() => shareReport(modalSummary, dateStr)}>
                    💬 Send report on WhatsApp
                </button>

                {!confirming ? (
                    <div className="dayctl-actions">
                        <button className="dayctl-ghost" disabled={busy} onClick={() => setShowClose(false)}>Cancel</button>
                        <button className="dayctl-primary" disabled={busy} onClick={() => setConfirming(true)}>Close Day</button>
                    </div>
                ) : (
                    <div className="dayctl-confirm">
                        <p>Close {fmtDate(dateStr)} now? You'll need to <b>open the day again</b> before billing next.</p>
                        <div className="dayctl-actions">
                            <button className="dayctl-ghost" disabled={busy} onClick={() => setConfirming(false)}>Back</button>
                            <button className="dayctl-primary" disabled={busy} onClick={doClose}>
                                {busy ? "Closing…" : "Yes, close the day"}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// The forgot-to-close notice: the day was opened on an earlier date and never
// closed. Not a hard block — they can close it or keep billing (which keeps
// adding to that earlier day, never colliding with a new one).
function StaleNotice({ day }) {
    const { state, busy, err, openCloseModal, staleDismissed, setStaleDismissed } = day;
    if (!state || state.error || !state.is_open || !state.stale || staleDismissed) return null;
    return (
        <div className="dayctl-overlay">
            <div className="dayctl-modal">
                <h3>Close {fmtDate(state.active_date)}?</h3>
                <p className="dayctl-sub">
                    This day was opened on {fmtDate(state.active_date)} and hasn't been closed. Its sales are still
                    running. Close it to finish that day, or keep billing — new sales stay on {fmtDate(state.active_date)} until you close it.
                </p>
                <SummaryRows s={state.summary} />
                {err && <div className="dayctl-err">{err}</div>}
                <div className="dayctl-actions">
                    <button className="dayctl-ghost" disabled={busy} onClick={() => setStaleDismissed(true)}>Keep billing</button>
                    <button className="dayctl-primary" disabled={busy} onClick={openCloseModal}>Close {fmtDate(state.active_date)}</button>
                </div>
            </div>
        </div>
    );
}

export function DayProvider({ gate = true, children }) {
    const day = useDay();
    const { state, busy, err, doOpen, openCloseModal } = day;
    const ready = state && !state.error;

    return (
        <DayCtx.Provider value={{ state: ready ? state : null, openCloseModal }}>
            {children}

            {/* Forgot-to-close notice (POS + owner). */}
            {ready && <StaleNotice day={day} />}

            {/* POS only: no day open → must open before billing. */}
            {ready && gate && !state.is_open && !state.stale && (
                <div className="dayctl-overlay">
                    <div className="dayctl-modal">
                        <h3>{state.started_today ? "Day closed" : "Open the day"}</h3>
                        <p className="dayctl-sub">
                            {state.started_today
                                ? "Today's sales are closed. Open the day again to keep billing."
                                : "Open the day to start billing."}
                        </p>
                        {err && <div className="dayctl-err">{err}</div>}
                        <button className="dayctl-primary" disabled={busy} onClick={doOpen}>
                            {busy ? "Opening…" : state.started_today ? "Open the day again" : "Open day"}
                        </button>
                    </div>
                </div>
            )}

            <CashUpModal day={day} />
        </DayCtx.Provider>
    );
}

// A button inside a DayProvider (POS header): "Close Day" while a day is open.
export function DayButton({ className = "pos-dayclose" }) {
    const ctx = useContext(DayCtx);
    if (!ctx || !ctx.state || !ctx.state.is_open) return null;
    return (
        <button type="button" className={className} onClick={ctx.openCloseModal}>Close Day</button>
    );
}

// Self-contained Open/Close for the owner top bar (next to Logout): "Close Day"
// while open, "Open Day" once closed — plus its own forgot-to-close notice and
// cash-up modal. Renders nothing until the state is known.
export function HeaderDayButton({ className = "header-dayclose" }) {
    const day = useDay();
    const { state, busy, openCloseModal, doOpen } = day;
    if (!state || state.error) return null;
    return (
        <>
            <button
                type="button"
                className={`${className}${state.is_open ? "" : " is-open-action"}`}
                disabled={busy}
                onClick={state.is_open ? openCloseModal : doOpen}
            >
                {state.is_open ? "Close Day" : (busy ? "Opening…" : "Open Day")}
            </button>
            <StaleNotice day={day} />
            <CashUpModal day={day} />
        </>
    );
}

export default DayProvider;
