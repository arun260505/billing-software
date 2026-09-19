/*
 * Pure helpers for the Order Number Format (Admin → Settings). No database
 * here, so unit tests can run them without a live MySQL — the generator in
 * utils/orderNumber.js is the only place that advances the stored sequence.
 */

const RESET_MODES = ["never", "daily", "monthly"];

// The bucket key the sequence restarts on: the calendar day for "daily", the
// year-month for "monthly", and an empty string for "never" (no restarting).
// Same UTC calendar day the old generator keyed on, so a daily reset rolls over
// exactly as the previous order_sequences logic did.
const resetKeyFor = (mode) => {
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    if (mode === "daily") return today;
    if (mode === "monthly") return today.slice(0, 7);
    return "";
};

const normalizeDigits = (digits) => {
    const n = Number(digits);
    if (!Number.isFinite(n)) return 4;
    return Math.max(1, Math.min(10, Math.round(n)));
};

const sanitizePrefix = (prefix) => String(prefix || "ORD").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 20) || "ORD";

// One formatted number for a position, e.g. { prefix: "ORD", sequence: 1, digits: 4 } → "ORD-0001".
const formatOrderNumber = ({ prefix, sequence, digits }) =>
    `${sanitizePrefix(prefix)}-${String(sequence).padStart(normalizeDigits(digits), "0")}`;

// The next number to issue, given stored state. Pure so it can be unit tested
// and reused by the settings screen's own preview.
//
// `bucketKey` overrides which bucket "daily"/"monthly" compare against. The
// generator passes the OPEN BUSINESS DAY's date here so numbering restarts when
// the counter opens a new day — not at calendar midnight — which is what keeps a
// shop that bills past midnight on one continuous sequence until it closes. When
// omitted (the settings-screen preview), it falls back to the calendar bucket.
const nextSequence = (state, mode, startOverride, bucketKey) => {
    const start = startOverride == null ? Math.max(1, Number(state.starting_number) || 1) : startOverride;
    const current = Number(state.current_sequence) || 0;
    const key = state.sequence_reset_key == null ? null : String(state.sequence_reset_key);

    if (mode === "never") {
        // Carry on incrementing forever; a freshly saved format (NULL key,
        // sequence reset) starts over from the starting number.
        return key === null ? start : current + 1;
    }

    // daily / monthly: continue while still in the same bucket, otherwise
    // (new day, new month, or a freshly saved format) restart.
    const target = bucketKey == null ? resetKeyFor(mode) : String(bucketKey);
    return key === target ? current + 1 : start;
};

// What a stored (or just-saved) config will hand the NEXT order — for the
// Settings screen's "Next Order Number" preview. Purely informative; the real
// number is always issued by the generator at order creation.
const previewNextOrderNumber = (row = {}) => {
    const mode = RESET_MODES.includes(row.reset_mode) ? row.reset_mode : "never";
    const start = Math.max(1, Number(row.starting_number) || 1);
    const sequence = nextSequence(row, mode, start);
    return formatOrderNumber({ prefix: row.prefix, sequence, digits: row.digits });
};

module.exports = {
    RESET_MODES,
    resetKeyFor,
    sanitizePrefix,
    normalizeDigits,
    formatOrderNumber,
    nextSequence,
    previewNextOrderNumber
};