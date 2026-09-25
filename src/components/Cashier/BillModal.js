import { useState, useEffect } from "react";
import { createPayment } from "../../services/paymentService";
import { setOrderCharges } from "../../services/orderService";
import { printBillNow } from "../../utils/printDispatch";
import { optionalChargesFor, preselectedCashierChargesFor, resolveCharges, money } from "../../utils/rates";
import useEscapeClose from "../../hooks/useEscapeClose";

// `onPrinted` (optional) fires with the order as it was printed, right after the
// customer bill goes to the printer. Option 3 of the printer setup uses it to
// send the kitchen copy out of the same printer straight after the bill.
//
// `charges` is the restaurant's charge list (Admin → Charges). Anything set to
// apply automatically — GST, service charge, a standing packing fee — is already
// inside order.total; the chips below are the opt-in ones.
//
// Salon only — `delivery` ("printer_optional" | "no_printer", Settings → Bills &
// WhatsApp) swaps the single confirm button for "Send on WhatsApp" and, unless
// there is no printer, "Print" (which sends on WhatsApp too). `onWhatsApp` gets
// the bill as paid. Without `delivery` (the restaurant counter) nothing changes.
// `ensureOrder` (optional): when the order does not exist yet, this creates it
// and returns { order_id, order_number }. It runs only when payment is confirmed,
// so the salon never leaves a draft/cancelled bill behind if the desk backs out.
// Callers that already have an order (the restaurant counter/table) don't pass it.
function BillModal({ order, restaurant, format, charges = [], onClose, onSuccess, onPrinted, delivery, onWhatsApp, defaultMethod = "Cash", ensureOrder }) {

    // Esc closes this modal (src/hooks/useEscapeClose.js).
    useEscapeClose(onClose);
    // Pre-selected method comes from Settings → Payments (e.g. UPI-first shops).
    const [paymentMethod, setPaymentMethod] = useState(defaultMethod || "Cash");
    const [splitMode, setSplitMode] = useState(false);
    const [splitAmounts, setSplitAmounts] = useState({ Cash: "", Card: "", UPI: "", Wallet: "" });
    const [loading, setLoading] = useState(false);

    const orderType = order.isCounter ? "Takeaway" : "Dine-In";
    const pickableCharges = optionalChargesFor(charges, orderType);

    // Removable autos (a parcel/packing fee marked "apply to all, but can be
    // removed") start selected — already in the total, dropped with a tap.
    const [selectedCharges, setSelectedCharges] = useState(() => preselectedCashierChargesFor(charges, orderType));

    // The charge list is fetched, so it can land after the first render; seed the
    // pre-selected removable autos once it (or the order type) changes.
    const chargeKey = (Array.isArray(charges) ? charges : []).map((c) => c.id).join(",");
    useEffect(() => {
        setSelectedCharges(preselectedCashierChargesFor(charges, orderType));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chargeKey, orderType]);

    // The tax / service lines behind order.total, named as the restaurant named
    // them. They used to be printed here as a hardcoded "GST (5%)".
    const billedLines = Array.isArray(order.taxLines) ? order.taxLines : [];
    // Standing charges already counted into order.total by the cashier screen.
    const autoChargeLines = Array.isArray(order.charges) ? order.charges : [];

    const toggleCharge = (charge) => {
        setSelectedCharges((prev) =>
            prev.find((c) => c.id === charge.id)
                ? prev.filter((c) => c.id !== charge.id)
                : [...prev, charge]
        );
    };

    // Resolved the same way as everywhere else — this rounded percentage charges
    // to whole rupees, so the charge lines printed did not add up to the charges
    // total they were part of.
    // On the goods after any discount — the same base the backend uses.
    const pickedLines = resolveCharges(selectedCharges, order.taxable ?? order.subtotal);
    const chargesTotal = money(pickedLines.reduce((s, c) => s + c.amount, 0));

    const grandTotal = money(order.total + chargesTotal);
    const PAY_METHODS = ["Cash", "Card", "UPI", "Wallet"];

    const parsedSplits = () =>
        PAY_METHODS
            .filter((m) => {
                const v = Number(splitAmounts[m]);
                return Number.isFinite(v) && v > 0;
            })
            .map((m) => ({ payment_method: m, amount: money(Number(splitAmounts[m])) }));

    const splitSum = money(parsedSplits().reduce((s, p) => s + p.amount, 0));

    // Cashiers type whole rupees (matching the bill's rounded total), but the exact
    // total can carry paise. So we validate against the rounded total, then fold any
    // paise remainder into the largest line so the payments sum exactly to the total.
    const splitValid =
        splitMode &&
        parsedSplits().length >= 2 &&
        Math.abs(money(splitSum) - money(grandTotal)) < 0.5;

    const exactSplits = (() => {
        const list = parsedSplits().map((p) => ({ ...p }));
        if (list.length === 0) return list;
        const diff = money(money(grandTotal) - list.reduce((s, p) => s + p.amount, 0));
        if (money(diff) !== 0) {
            const idx = list.reduce((bi, p, i, a) => (p.amount >= a[bi].amount ? i : bi), 0);
            list[idx] = { ...list[idx], amount: money(list[idx].amount + diff) };
        }
        return list;
    })();

    // print: false = WhatsApp only (salon). A click event counts as "print".
    const handleConfirm = async (print = true) => {
        const shouldPrint = print !== false;
        setLoading(true);
        try {
            // Create the order now, at payment, if it doesn't exist yet (salon):
            // so a bill the desk started but never paid leaves nothing behind —
            // no cancelled row, no order number burned.
            let orderId = order.order_id;
            let orderNumber = order.order_number;
            if (!orderId && typeof ensureOrder === "function") {
                const created = await ensureOrder();
                if (!created || !created.order_id) throw new Error("Could not create the bill.");
                orderId = created.order_id;
                orderNumber = created.order_number || orderNumber;
            }

            // Persist the picked charges onto the order and recompute its total
            // BEFORE taking payment, so a removable parcel fee or an opt-in charge
            // is actually stored and counted — not merely added to the amount
            // collected. Only needed when this bill has such charges to manage.
            if (pickableCharges.length > 0 && orderId) {
                await setOrderCharges(orderId, selectedCharges);
            }

            if (splitMode) {
                // Create one payment per split method; the backend reconciles to Paid
                // once the split amounts cover the grand total.
                for (const sp of exactSplits) {
                    await createPayment({
                        order_id: orderId,
                        payment_method: sp.payment_method,
                        amount: sp.amount,
                        remarks: order.tableName,
                        // Split line: individually under the total, but the lines
                        // together cover the full bill — so the backend's "no
                        // partial for restaurants" rule lets them through.
                        split: true,
                    });
                }
            } else {
                await createPayment({
                    order_id: orderId,
                    payment_method: paymentMethod,
                    amount: money(grandTotal),
                    remarks: order.tableName,
                });
            }

            // Automatically print the customized bill
            const printedOrder = {
                ...order,
                order_id: orderId,
                order_number: orderNumber,
                payment_method: splitMode ? exactSplits.map((s) => s.payment_method).join(" + ") : paymentMethod,
                // Standing charges plus the ones just picked. Overwriting with
                // the picked ones alone dropped a restaurant's automatic packing
                // fee off the printed bill while still charging for it.
                charges: [...autoChargeLines, ...pickedLines],
                grand_total: money(grandTotal)
            };

            // WhatsApp first (salon): opened straight after payment, while the
            // Confirm click still counts as the receptionist's action, so the
            // browser doesn't block the window. The bill printer is spooled by the
            // local backend and doesn't need that.
            if (onWhatsApp) onWhatsApp(printedOrder);

            if (shouldPrint) {
                // Waits for the printer to take it, so anything that follows (the
                // kitchen copy on a single-printer setup) comes out after the bill.
                const billResult = await printBillNow({
                    order: printedOrder,
                    restaurant: restaurant || {},
                    format: format || {}
                });

                if (onPrinted) onPrinted(printedOrder, billResult);
            }

            onSuccess({ printed: shouldPrint, order_id: orderId, order_number: orderNumber });
        } catch (error) {
            console.error("Payment Error:", error);
            alert(error.response?.data?.message || "Payment failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bill-overlay">
            <div className="bill-modal">
                <div className="bill-header">
                    <h2>Bill Generation</h2>
                    <button className="bill-close" onClick={onClose} disabled={loading}>✕</button>
                </div>

                <div className="bill-meta">
                    <span><strong>Bill:</strong> {order.order_number || "New"}</span>
                    {/* placeLabel lets a salon bill say "Customer:" here. */}
                    <span><strong>{order.placeLabel || "Table"}:</strong> {order.tableName}</span>
                    {order.stylist_name && <span><strong>Stylist:</strong> {order.stylist_name}</span>}
                </div>

                <div className="bill-items">
                    {order.items.length === 0 ? (
                        <div className="bill-empty">No items</div>
                    ) : (
                        order.items.map((item, idx) => (
                            <div key={idx} className="bill-line">
                                <span className="bill-item-name">{item.item_name}</span>
                                <span className="bill-item-calc">₹{item.price} × {item.quantity}</span>
                                <span className="bill-item-total">₹{(item.price * item.quantity).toFixed(2)}</span>
                            </div>
                        ))
                    )}
                </div>

                <div className="bill-totals">
                    <div className="bill-row"><span>Subtotal</span><span>₹{order.subtotal.toFixed(2)}</span></div>
                    {Number(order.discount) > 0 && (
                        <div className="bill-row"><span>{order.discount_label || "Discount"}</span><span>−₹{Number(order.discount).toFixed(2)}</span></div>
                    )}
                    {[...billedLines, ...autoChargeLines].map((c, i) => (
                        <div className="bill-row" key={`${c.charge_name}-${i}`}>
                            <span>{c.charge_name}</span><span>₹{Number(c.amount).toFixed(2)}</span>
                        </div>
                    ))}

                    {pickableCharges.length > 0 && (
                        <div className="bill-charges-section">
                            <div className="bill-charges-label">Additional Charges</div>
                            <div className="bill-charges-grid">
                                {pickableCharges.map((c) => {
                                    const isActive = selectedCharges.some((sc) => sc.id === c.id);
                                    const value = c.charge_type === "Percentage"
                                        ? `${c.amount}%`
                                        : `₹${c.amount}`;
                                    return (
                                        <button
                                            key={c.id}
                                            className={`bill-charge-chip${isActive ? " active" : ""}`}
                                            onClick={() => toggleCharge(c)}
                                            disabled={loading}
                                        >
                                            <span className="bill-charge-name">{c.charge_name}</span>
                                            <span className="bill-charge-value">{value}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {pickedLines.length > 0 && (
                        <>
                            {pickedLines.map((c, i) => (
                                <div key={`${c.charge_name}-${i}`} className="bill-row bill-charge-row">
                                    <span>{c.charge_name}</span>
                                    <span>₹{c.amount.toFixed(2)}</span>
                                </div>
                            ))}
                            <div className="bill-row bill-charges-total"><span>Total Charges</span><span>₹{chargesTotal.toFixed(2)}</span></div>
                        </>
                    )}

                    <div className="bill-total-row">
                        <span className="bill-total-label">Total Amount</span>
                        <span className="bill-total-value">₹{grandTotal.toFixed(2)}</span>
                    </div>
                </div>

                <div className="bill-payment">
                    <label className="bill-pay-label">Payment Method</label>
                    <div className="bill-pay-methods">
                        <button
                            type="button"
                            className={`bill-pay-btn bill-split-option${splitMode ? " bill-pay-active" : ""}`}
                            onClick={() => setSplitMode((s) => !s)}
                            disabled={loading}
                        >
                            {splitMode ? "Split ON" : "Split"}
                        </button>

                        {!splitMode && PAY_METHODS.map((method) => (
                            <button
                                key={method}
                                type="button"
                                className={`bill-pay-btn ${paymentMethod === method ? "bill-pay-active" : ""}`}
                                onClick={() => setPaymentMethod(method)}
                            >
                                {method}
                            </button>
                        ))}
                    </div>

                    {splitMode && (
                        <div className="tbill-split">
                            {PAY_METHODS.map((m) => (
                                <div key={m} className="tbill-split-row">
                                    <span className="tbill-split-method">{m}</span>
                                    <input
                                        type="number"
                                        min="0"
                                        className="tbill-split-input"
                                        placeholder="0"
                                        value={splitAmounts[m]}
                                        onChange={(e) => setSplitAmounts((prev) => ({ ...prev, [m]: e.target.value }))}
                                        disabled={loading}
                                    />
                                </div>
                            ))}
                            <div className={`tbill-split-total${money(splitSum) === money(grandTotal) ? " ok" : " bad"}`}>
                                Allocated {money(splitSum).toFixed(2)} / {money(grandTotal).toFixed(2)}
                            </div>
                            {!splitValid && (
                                <div className="tbill-split-error">
                                    Split amounts must add up to the total (₹{money(grandTotal).toFixed(2)}) and use at least 2 methods.
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {delivery ? (
                    <div className="bill-confirm-row">
                        <button
                            className="bill-confirm-btn bill-confirm-wa"
                            onClick={() => handleConfirm(false)}
                            disabled={loading || (splitMode && !splitValid)}
                        >
                            {loading ? "Processing..." : `Paid · Send on WhatsApp · ₹${money(grandTotal).toFixed(2)}`}
                        </button>
                        {delivery !== "no_printer" && (
                            <button
                                className="bill-confirm-btn"
                                onClick={() => handleConfirm(true)}
                                disabled={loading || (splitMode && !splitValid)}
                            >
                                {loading ? "Processing..." : `Paid · Print + WhatsApp · ₹${money(grandTotal).toFixed(2)}`}
                            </button>
                        )}
                    </div>
                ) : (
                    <button className="bill-confirm-btn" onClick={handleConfirm} disabled={loading || (splitMode && !splitValid)}>
                        {loading ? "Processing..." : `Confirm Payment & Generate Bill · ₹${money(grandTotal).toFixed(2)}`}
                    </button>
                )}
            </div>
        </div>
    );
}

export default BillModal;
