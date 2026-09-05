import { useState } from "react";
import { createPayment } from "../../services/paymentService";
import { printBillNow } from "../../utils/printDispatch";
import { optionalChargesFor, resolveCharges, money } from "../../utils/rates";
import useEscapeClose from "../../hooks/useEscapeClose";

// `onPrinted` (optional) fires with the order as it was printed, right after the
// customer bill goes to the printer. Option 3 of the printer setup uses it to
// send the kitchen copy out of the same printer straight after the bill.
//
// `charges` is the restaurant's charge list (Admin → Charges). Anything set to
// apply automatically — GST, service charge, a standing packing fee — is already
// inside order.total; the chips below are the opt-in ones.
function BillModal({ order, restaurant, format, charges = [], onClose, onSuccess, onPrinted }) {

    // Esc closes this modal (src/hooks/useEscapeClose.js).
    useEscapeClose(onClose);
    const [paymentMethod, setPaymentMethod] = useState("Cash");
    const [splitMode, setSplitMode] = useState(false);
    const [splitAmounts, setSplitAmounts] = useState({ Cash: "", Card: "", UPI: "", Wallet: "" });
    const [loading, setLoading] = useState(false);
    const [selectedCharges, setSelectedCharges] = useState([]);

    const orderType = order.isCounter ? "Takeaway" : "Dine-In";
    const pickableCharges = optionalChargesFor(charges, orderType);

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
    const pickedLines = resolveCharges(selectedCharges, order.subtotal);
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

    const handleConfirm = async () => {
        setLoading(true);
        try {
            if (splitMode) {
                // Create one payment per split method; the backend reconciles to Paid
                // once the split amounts cover the grand total.
                for (const sp of exactSplits) {
                    await createPayment({
                        order_id: order.order_id,
                        payment_method: sp.payment_method,
                        amount: sp.amount,
                        remarks: order.tableName,
                    });
                }
            } else {
                await createPayment({
                    order_id: order.order_id,
                    payment_method: paymentMethod,
                    amount: money(grandTotal),
                    remarks: order.tableName,
                });
            }

            // Automatically print the customized bill
            const printedOrder = {
                ...order,
                payment_method: splitMode ? exactSplits.map((s) => s.payment_method).join(" + ") : paymentMethod,
                // Standing charges plus the ones just picked. Overwriting with
                // the picked ones alone dropped a restaurant's automatic packing
                // fee off the printed bill while still charging for it.
                charges: [...autoChargeLines, ...pickedLines],
                grand_total: money(grandTotal)
            };

            // Waits for the printer to take it, so anything that follows (the
            // kitchen copy on a single-printer setup) comes out after the bill.
            const billResult = await printBillNow({
                order: printedOrder,
                restaurant: restaurant || {},
                format: format || {}
            });

            if (onPrinted) onPrinted(printedOrder, billResult);

            onSuccess();
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
                    <span><strong>Bill:</strong> {order.order_number}</span>
                    <span><strong>Table:</strong> {order.tableName}</span>
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

                <button className="bill-confirm-btn" onClick={handleConfirm} disabled={loading || (splitMode && !splitValid)}>
                    {loading ? "Processing..." : `Confirm Payment & Generate Bill · ₹${money(grandTotal).toFixed(2)}`}
                </button>
            </div>
        </div>
    );
}

export default BillModal;
