// The till's default counter mode — what a fresh counter sale starts as.
//
//   counter    the walk-in order IS sent to the kitchen (the usual behaviour)
//   bill_only  the walk-in is billed but NOT sent to the kitchen (a ready item)
//
// This is a property of THIS till (how the front desk here works), so — like the
// WhatsApp override — it lives in this browser, not the synced settings. The POS
// opens in this mode and returns to it after every bill; the cashier can still
// switch to the other mode for a single bill from the Counter / Bill Only chips.

const KEY = "inwallz_counter_default";

export const COUNTER_MODES = { COUNTER: "counter", BILL_ONLY: "bill_only" };

/** The till's default: "counter" (default) or "bill_only". */
export function getCounterDefault() {
    try {
        const v = window.localStorage.getItem(KEY);
        return v === COUNTER_MODES.BILL_ONLY ? COUNTER_MODES.BILL_ONLY : COUNTER_MODES.COUNTER;
    } catch (e) {
        return COUNTER_MODES.COUNTER;
    }
}

/** Save the till's default. Anything but "bill_only" is stored as "counter". */
export function setCounterDefault(mode) {
    try {
        window.localStorage.setItem(
            KEY,
            mode === COUNTER_MODES.BILL_ONLY ? COUNTER_MODES.BILL_ONLY : COUNTER_MODES.COUNTER
        );
    } catch (e) { /* private window / storage blocked — keep for this session only */ }
}

/** True when a fresh counter sale should start in "Bill Only" mode. */
export const isBillOnlyDefault = () => getCounterDefault() === COUNTER_MODES.BILL_ONLY;
