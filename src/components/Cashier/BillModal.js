import { useState, useEffect } from "react";
import { createPayment } from "../../services/paymentService";
import chargeService from "../../services/chargeService";

function BillModal({ order, onClose, onSuccess }) {
    const [paymentMethod, setPaymentMethod] = useState("Cash");
    const [loading, setLoading] = useState(false);
    const [charges, setCharges] = useState([]);
    const [selectedCharges, setSelectedCharges] = useState([]);

    useEffect(() => {
        chargeService.getCharges().then((res) => {
            setCharges((res.data.data || []).filter((c) => c.status === "Active"));
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

    const handleConfirm = async () => {
        setLoading(true);
        try {
            await createPayment({
                order_id: order.order_id,
                payment_method: paymentMethod,
                amount: grandTotal,
                remarks: order.tableName,
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
                        {["Cash", "Card", "UPI"].map((method) => (
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
                </div>

                <button className="bill-confirm-btn" onClick={handleConfirm} disabled={loading}>
                    {loading ? "Processing..." : `Confirm Payment & Generate Bill · ₹${grandTotal.toFixed(2)}`}
                </button>
            </div>
        </div>
    );
}

export default BillModal;
