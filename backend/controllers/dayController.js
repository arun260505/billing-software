const dayModel = require("../models/dayModel");
const { success, error } = require("../utils/response");

// A YYYY-MM-DD date the client sent, else the server's today. Only the date
// shape is trusted; anything else falls back to today.
function pickDate(v) {
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// GET /api/day/state?date=YYYY-MM-DD — is today open/closed, and is there a
// past day still to close? Drives the POS open prompt and the pending pop-up.
exports.getState = async (req, res) => {
    try {
        const rid = req.user.restaurant_id;
        const today = pickDate(req.query.date);
        const state = await dayModel.getState(rid, today);
        let pending_summary = null;
        if (state.pending_date) {
            pending_summary = await dayModel.getDaySummary(rid, state.pending_date);
        }
        return success(res, "Day state.", { ...state, pending_summary });
    } catch (e) {
        return error(res, e.message, 500);
    }
};

// POST /api/day/open { date? } — open the day for business.
exports.open = async (req, res) => {
    try {
        const rid = req.user.restaurant_id;
        const date = pickDate(req.body.date);
        const row = await dayModel.openDay(rid, date, req.user.id);
        return success(res, "Day opened.", row);
    } catch (e) {
        return error(res, e.message, 500);
    }
};

// GET /api/day/summary?date=YYYY-MM-DD — the day's sales + tender breakdown,
// plus its closure if it has already been closed.
exports.getSummary = async (req, res) => {
    try {
        const rid = req.user.restaurant_id;
        const date = pickDate(req.query.date);
        const summary = await dayModel.getDaySummary(rid, date);
        const closure = await dayModel.getRow(rid, date);
        return success(res, "Day summary.", { summary, closure });
    } catch (e) {
        return error(res, e.message, 500);
    }
};

// GET /api/day/pending — the earliest past day with sales that was never closed,
// with its summary, so the app can pop it up. { date: null } when all caught up.
exports.getPending = async (req, res) => {
    try {
        const rid = req.user.restaurant_id;
        const date = await dayModel.getPendingUnclosed(rid);
        if (!date) return success(res, "Nothing pending.", { date: null });
        const summary = await dayModel.getDaySummary(rid, date);
        return success(res, "Pending day close.", { date, summary });
    } catch (e) {
        return error(res, e.message, 500);
    }
};

// POST /api/day/close  { date?, counted_cash?, notes? }
exports.close = async (req, res) => {
    try {
        const rid = req.user.restaurant_id;
        const date = pickDate(req.body.date);
        const result = await dayModel.closeDay(rid, date, req.user.id, {
            counted_cash: req.body.counted_cash,
            notes: req.body.notes
        });
        const msg = result.alreadyClosed
            ? "This day was already closed."
            : "Day closed.";
        return success(res, msg, result);
    } catch (e) {
        return error(res, e.message, 500);
    }
};

// GET /api/day/closures?from=YYYY-MM-DD&to=YYYY-MM-DD — history for reports.
exports.getClosures = async (req, res) => {
    try {
        const rid = req.user.restaurant_id;
        const to = pickDate(req.query.to);
        const from = /^\d{4}-\d{2}-\d{2}$/.test(req.query.from || "") ? req.query.from : to;
        const rows = await dayModel.getClosures(rid, from, to);
        return success(res, "Closures.", rows);
    } catch (e) {
        return error(res, e.message, 500);
    }
};
