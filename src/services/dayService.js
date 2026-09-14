import api from "./api";

// End-of-day open / close (cash-up). The till opens the day before billing and
// closes it at night; a forgotten close is surfaced by getState().pending_date.

// Today in the till's own local date (YYYY-MM-DD), so the day matches the wall
// clock in front of the cashier, not the server's timezone.
export function todayLocal() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const getDayState = (date = todayLocal()) =>
    api.get("/day/state", { params: { date } });

export const getDaySummary = (date = todayLocal()) =>
    api.get("/day/summary", { params: { date } });

export const openDay = (date = todayLocal()) =>
    api.post("/day/open", { date });

export const closeDay = ({ date = todayLocal(), counted_cash = null, notes = "" } = {}) =>
    api.post("/day/close", { date, counted_cash, notes });

export const getDayClosures = (from, to = todayLocal()) =>
    api.get("/day/closures", { params: { from, to } });

const dayService = { todayLocal, getDayState, getDaySummary, openDay, closeDay, getDayClosures };
export default dayService;
