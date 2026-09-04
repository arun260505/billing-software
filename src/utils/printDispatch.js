import api from "../services/api";
import { buildBillText, buildKotText, buildTestText } from "./receiptText";
import { printBill } from "./billPrinter";
import { printKitchenTicket } from "./kitchenPrinter";
import { printTestSlip } from "./testPrint";

/**
 * One place that decides HOW a receipt reaches paper.
 *
 * Preferred: hand the text to the local backend, which spools it straight to the
 * configured printer — no dialog, and bills and kitchen tickets land on the right
 * device. If that is unavailable (cloud node, printer not chosen yet, printer
 * off), fall back to the old browser print dialog so a bill can still be produced
 * by hand rather than being lost.
 *
 * Every function here resolves to { direct, reason } and never rejects — a
 * printing problem must not take down the sale that produced it.
 */

async function sendDirect(text, target) {
    const res = await api.post("/print", { text, target });
    if (!res.data?.success) {
        throw new Error(res.data?.message || "Print failed.");
    }
    return res.data;
}

function reasonFrom(err) {
    return (
        err?.response?.data?.message ||
        err?.message ||
        "Could not reach the printer."
    );
}

/**
 * @param {object}   args.payload  what to print, per kind
 * @param {string}   args.target   "cashier" | "kitchen"
 * @param {function} args.buildText  payload -> text for the printer
 * @param {function} args.fallback   opens the browser print dialog
 */
async function dispatch({ payload, target, buildText, fallback }) {
    let text;
    try {
        text = buildText(payload);
    } catch (e) {
        // A formatting bug must not swallow the receipt — show the dialog.
        console.error("Receipt formatting failed, falling back to the dialog:", e);
        fallback();
        return { direct: false, reason: "Could not format the receipt." };
    }

    try {
        const data = await sendDirect(text, target);
        return { direct: true, printer: data?.data?.printer };
    } catch (err) {
        const reason = reasonFrom(err);
        console.warn(`Direct print unavailable (${reason}) — using the print dialog.`);
        fallback();
        return { direct: false, reason };
    }
}

/** The customer bill. Always the cashier printer. */
export function printBillNow({ order = {}, restaurant = {}, format = {} }) {
    return dispatch({
        payload: { order, restaurant, format },
        target: "cashier",
        buildText: buildBillText,
        fallback: () => printBill({ order, restaurant, format })
    });
}

/** The kitchen ticket. Routes to the kitchen printer only on a two-printer setup. */
export function printKotNow({ order = {}, restaurant = {}, format = {} }) {
    return dispatch({
        payload: { order, restaurant, format },
        target: "kitchen",
        buildText: buildKotText,
        fallback: () => printKitchenTicket({ order, restaurant, format })
    });
}

/** The Test print button on the cashier's Printer page. */
export function printTestNow({ printerName = "", role = "", restaurantName = "", target = "cashier" }) {
    return dispatch({
        payload: { printerName, role, restaurantName },
        target,
        buildText: buildTestText,
        fallback: () => printTestSlip({ printerName, role, restaurantName })
    });
}

const printDispatch = { printBillNow, printKotNow, printTestNow };

export default printDispatch;
