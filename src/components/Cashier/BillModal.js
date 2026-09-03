import { useState, useEffect } from "react";
import { createPayment } from "../../services/paymentService";
import chargeService from "../../services/chargeService";
import { printBill } from "../../utils/billPrinter";
import { isValidCharge } from "../../utils/charges";

function BillModal({ order, restaurant, format, onClose, onSuccess }) {
    const [paymentMethod, setPaymentMethod] = useState("Cash");
    const [splitMode, setSplitMode] = useState(false);
    const [splitAmounts, setSplitAmounts] = useState({ Cash: "", Card: "", UPI: "", Wallet: "" });
    const [loading, setLoading] = useState(false);
    const [charges, setCharges] = useState([]);
    const [selectedCharges, setSelectedCharges] = useState([]);

    useEffect(() => {
        chargeService.getCharges().then((res) => {
            setCharges((res.data.data || []).filter((c) => c.status === "Active" && isValidCharge(c)));
        }).catch(() => {});
    }, []);

    const toggleCharge = (charge) => {
        setSelectedCharges((prev) =>
            prev.find((c) => c.id === charge.id)
                ? prev.filter((c) => c.id !== charge.id)
                : [...prev, charge]
        );
    };

    const chargesTotal = selectedCharges.reduce((sum, c) => {
        if (c.charge_type === "Percentage") return sum + Math.round(order.subtotal * c.amount / 100);
        return sum + Number(c.amount);
    }, 0);

    const grandTotal = order.total + chargesTotal;

    const money = (n) => Math.round((Number(n) || 0) * 100) / 100;
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
            printBill({
                order: {
                    ...order,
                    payment_method: splitMode ? exactSplits.map((s) => s.payment_method).join(" + ") : paymentMethod,
                    charges: selectedCharges,
                    grand_total: money(grandTotal)
                },
                restaurant: restaurant || {},
                format: format || {}
            });

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
                    <div className="bill-row"><span>GST (5%)</span><span>₹{order.gst.toFixed(2)}</span></div>
                    <div className="bill-row"><span>Service Charge (2%)</span><span>₹{order.serviceCharge.toFixed(2)}</span></div>

                    {charges.length > 0 && (
                        <div className="bill-charges-section">
                            <div className="bill-charges-label">Additional Charges</div>
                            <div className="bill-charges-grid">
                                {charges.map((c) => {
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

                    {selectedCharges.length > 0 && (
                        <>
                            {selectedCharges.map((c) => {
                                const val = c.charge_type === "Percentage"
                                    ? Math.round(order.subtotal * c.amount / 100)
                                    : Number(c.amount);
                                return (
                                    <div key={c.id} className="bill-row bill-charge-row">
                                        <span>{c.charge_name}</span>
                                        <span>₹{val.toFixed(2)}</span>
                                    </div>
                                );
                            })}
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
                                Allocated {money(splitSum).toFixed(0)} / {money(grandTotal).toFixed(0)}
                            </div>
                            {!splitValid && (
                                <div className="tbill-split-error">
                                    Split amounts must add up to the total (₹{money(grandTotal).toFixed(0)}) and use at least 2 methods.
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
