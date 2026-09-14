const dayModel = require("../models/dayModel");
const { success, error } = require("../utils/response");

// A YYYY-MM-DD date the client sent, else the server's today. Only the date
// shape is trusted; anything else falls back to today.
function pickDate(v) {
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// GET /api/day/state?date=YYYY-MM-DD — is a day open, is it stale (opened on an
// earlier date, never closed), and its running totals. Drives the POS open
// prompt, the Close Day button, and the forgot-to-close notice.
exports.getState = async (req, res) => {
    try {
        const rid = req.user.restaurant_id;
        const today = pickDate(req.query.date);
        const state = await dayModel.getState(rid, today);
        return success(res, "Day state.", state);
    } catch (e) {
        return error(res, e.message, 500);
    }
};

// POST /api/day/open — open (or continue) the day for business.
exports.open = async (req, res) => {
    try {
        const rid = req.user.restaurant_id;
        const today = pickDate(req.body.date);
        const row = await dayModel.openDay(rid, req.user.id, today);
        return success(res, "Day opened.", row);
    } catch (e) {
        return error(res, e.message, 500);
    }
};

// GET /api/day/summary — the running totals of the open day (or the last closed
// day's snapshot if none is open), for the cash-up screen and the Z-report.
exports.getSummary = async (req, res) => {
    try {
        const rid = req.user.restaurant_id;
        const open = await dayModel.getOpenDay(rid);
        if (open) {
            const summary = await dayModel.summaryOf(rid, open);
            return success(res, "Day summary.", { summary, closure: null, is_open: true });
        }
        const latest = await dayModel.getLatest(rid);
        const summary = latest ? await dayModel.summaryOf(rid, latest) : null;
        return success(res, "Day summary.", { summary, closure: latest, is_open: false });
    } catch (e) {
        return error(res, e.message, 500);
    }
};

// GET /api/day/pending — the open day if it is stale (opened on an earlier date,
// never closed), with its running totals, so the app can pop it up. Else null.
exports.getPending = async (req, res) => {
    try {
        const rid = req.user.restaurant_id;
        const today = pickDate(req.query.date);
        const state = await dayModel.getState(rid, today);
        if (state.is_open && state.stale) {
            return success(res, "Previous day still open.", { date: state.active_date, summary: state.summary });
        }
        return success(res, "Nothing pending.", { date: null });
    } catch (e) {
        return error(res, e.message, 500);
    }
};

// POST /api/day/close { counted_cash?, notes? } — close the active open day.
// Returns the closure + its snapshot summary (used to build the WhatsApp report).
exports.close = async (req, res) => {
    try {
        const rid = req.user.restaurant_id;
        const result = await dayModel.closeDay(rid, req.user.id, {
            counted_cash: req.body.counted_cash,
            notes: req.body.notes
        });
        const msg = result.alreadyClosed ? "No day was open to close." : "Day closed.";
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
