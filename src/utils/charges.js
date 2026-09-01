// Guards against malformed charge rows (a blank/missing name, or a non-numeric
// amount) ever reaching a bill. Without this, a stray charge in the DB shows up
// on the bill as a blank / "unknown" line. Used everywhere charges are listed,
// selected, or printed so the bad row is simply skipped.

export function isValidCharge(c) {
    if (!c) return false;
    const name = typeof c.charge_name === "string" ? c.charge_name.trim() : "";
    if (!name) return false;
    return Number.isFinite(Number(c.amount));
}

export function sanitizeCharges(list) {
    return (Array.isArray(list) ? list : []).filter(isValidCharge);
}
