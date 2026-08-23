import React, { useEffect, useState } from "react";

import { getOrderDetails, cancelOrder } from "../../services/orderService";
import { updateTicketStatus } from "../../services/kitchenService";

import "../../styles/pages/Admin/Orders.css";

// Canonical flow used for the progress strip. Derived ONLY from the order's
// current status — the database stores no status history, so no timestamps
// are invented here.
const STATUS_FLOW = ["Pending", "Confirmed", "Preparing", "Ready", "Served", "Completed"];

const STATUS_OPTIONS = ["Pending", "Preparing", "Ready", "Served", "Completed", "Cancelled"];

const TYPE_LABELS = {
    "Dine-In": "Dine-in",
    "Takeaway": "Takeaway",
    "Delivery": "Delivery"
};

const money = (v) =>
    `₹${Number(v || 0).toLocaleString("en-IN")}`;

function OrderDetailsModal({ order, payments = [], editable = false, onClose, onUpdated }) {

    const [items, setItems] = useState([]);
    const [loadingItems, setLoadingItems] = useState(true);
    const [saving, setSaving] = useState(false);
    const [statusDraft, setStatusDraft] = useState(order.order_status);
    const [currentStatus, setCurrentStatus] = useState(order.order_status);

    useEffect(() => {
        let alive = true;
        setLoadingItems(true);
        getOrderDetails(order.id)
            .then((res) => {
                if (alive && res.data.success) {
                    setItems(res.data.data || []);
                }
            })
            .catch((err) => {
                console.error("Order items error:", err);
                if (alive) setItems([]);
            })
            .finally(() => {
                if (alive) setLoadingItems(false);
            });
        return () => {
            alive = false;
        };
    }, [order.id]);

    const orderPayments = payments.filter((p) => String(p.order_id) === String(order.id));

    const reachedIndex = STATUS_FLOW.indexOf(currentStatus);

    const handleSaveStatus = async () => {
        if (!statusDraft || statusDraft === currentStatus) return;
        setSaving(true);
        try {
            await updateTicketStatus(order.id, statusDraft);
            setCurrentStatus(statusDraft);
            alert("Order status updated.");
            if (onUpdated) onUpdated();
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.message || "Could not update the order status.");
        } finally {
            setSaving(false);
        }
    };

    const handleCancelOrder = async () => {
        if (!window.confirm(`Cancel order #${order.id}? This cannot be undone.`)) return;
        setSaving(true);
        try {
            await cancelOrder(order.id);
            setCurrentStatus("Cancelled");
            alert("Order cancelled successfully.");
            if (onUpdated) onUpdated();
            onClose();
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.message || "Could not cancel the order.");
        } finally {
            setSaving(false);
        }
    };

    const cancelled = currentStatus === "Cancelled";

    return (
        <div className="orders-modal-overlay" onClick={onClose}>

            <div className="orders-modal" onClick={(e) => e.stopPropagation()}>

                <div className="orders-modal-head">
                    <div>
                        <h2>Order #{order.id}</h2>
                        <span className="orders-modal-sub">{order.order_number}</span>
                    </div>
                    <div className="orders-modal-head-right">
                        <span className={`order-badge badge-${(currentStatus || "").toLowerCase()}`}>
                            {currentStatus === "Pending" ? "New" : currentStatus}
                        </span>
                        <button className="orders-modal-close" onClick={onClose}>✕</button>
                    </div>
                </div>

                {/* Meta */}
                <div className="orders-meta-grid">
                    <div className="orders-meta-item">
                        <label>Date &amp; Time</label>
                        <span>
                            {new Date(order.created_at).toLocaleString([], {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit"
                            })}
                        </span>
                    </div>
                    <div className="orders-meta-item">
                        <label>Order Type</label>
                        <span>{TYPE_LABELS[order.order_type] || order.order_type}</span>
                    </div>
                    <div className="orders-meta-item">
                        <label>Table</label>
                        <span>{order.table_name ? order.table_name : "—"}</span>
                    </div>
                    <div className="orders-meta-item">
                        <label>Staff</label>
                        <span>{order.employee_name || "—"}</span>
                    </div>
                    <div className="orders-meta-item">
                        <label>Payment Status</label>
                        <span>
                            <span className={`pay-chip pay-${(order.payment_status || "").toLowerCase()}`}>
                                {order.payment_status}
                            </span>
                        </span>
                    </div>
                </div>

                {/* Progress (current status position only — no fabricated history) */}
                {!cancelled ? (
                    <div className="orders-progress">
                        {STATUS_FLOW.map((step, i) => (
                            <React.Fragment key={step}>
                                {i > 0 && (
                                    <span className={`orders-progress-bar${reachedIndex >= i ? " done" : ""}`} />
                                )}
                                <span className={`orders-progress-step${reachedIndex >= i ? " done" : ""}`}>
                                    <span className="orders-progress-dot">
                                        {reachedIndex >= i ? "✓" : ""}
                                    </span>
                                    {step === "Pending" ? "Created" : step}
                                </span>
                            </React.Fragment>
                        ))}
                    </div>
                ) : (
                    <div className="orders-cancelled-banner">This order was cancelled.</div>
                )}

                {/* Items */}
                <div className="orders-items-box">
                    <h3>Items</h3>
                    {loadingItems ? (
                        <p className="orders-muted">Loading items…</p>
                    ) : items.length === 0 ? (
                        <p className="orders-muted">No items found for this order.</p>
                    ) : (
                        <table className="orders-items-table">
                            <thead>
                                <tr>
                                    <th>Item</th>
                                    <th>Qty</th>
                                    <th>Price</th>
                                    <th>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item) => (
                                    <tr key={item.id}>
                                        <td>
                                            <span className="orders-item-name">{item.item_name}</span>
                                            {item.notes && (
                                                <span className="orders-item-note">+ {item.notes}</span>
                                            )}
                                        </td>
                                        <td>{Number(item.quantity)}</td>
                                        <td>{money(item.price)}</td>
                                        <td>{money(item.total)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Totals */}
                <div className="orders-totals">
                    <div className="orders-total-row">
                        <span>Subtotal</span>
                        <span>{money(order.subtotal)}</span>
                    </div>
                    {Number(order.discount) > 0 && (
                        <div className="orders-total-row">
                            <span>Discount</span>
                            <span>- {money(order.discount)}</span>
                        </div>
                    )}
                    <div className="orders-total-row">
                        <span>Tax</span>
                        <span>{money(order.tax)}</span>
                    </div>
                    <div className="orders-total-row grand">
                        <span>Grand Total</span>
                        <span>{money(order.grand_total)}</span>
                    </div>
                </div>

                {order.notes && (
                    <div className="orders-notes-box">
                        <label>Order Notes</label>
                        <p>{order.notes}</p>
                    </div>
                )}

                {/* Payment records (method / transaction info when already available) */}
                <div className="orders-payment-box">
                    <h3>Payment</h3>
                    <div className="orders-payment-status">
                        <span className={`pay-chip pay-${(order.payment_status || "").toLowerCase()}`}>
                            {order.payment_status}
                        </span>
                        <span className="orders-payment-amount">{money(order.grand_total)}</span>
                    </div>
                    {orderPayments.length > 0 ? (
                        <table className="orders-payments-table">
                            <thead>
                                <tr>
                                    <th>Payment #</th>
                                    <th>Method</th>
                                    <th>Reference</th>
                                    <th>Amount</th>
                                    <th>Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orderPayments.map((p) => (
                                    <tr key={p.id}>
                                        <td>{p.payment_number}</td>
                                        <td>{p.payment_method}</td>
                                        <td>{p.reference_number || "—"}</td>
                                        <td>{money(p.amount)}</td>
                                        <td>
                                            {new Date(p.payment_date).toLocaleString([], {
                                                day: "2-digit",
                                                month: "short",
                                                hour: "2-digit",
                                                minute: "2-digit"
                                            })}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <p className="orders-muted">No payment recorded yet.</p>
                    )}
                </div>

                {/* Edit controls */}
                {editable && !cancelled && (
                    <div className="orders-edit-bar">
                        <div className="orders-edit-field">
                            <label>Update Status</label>
                            <select
                                value={statusDraft}
                                onChange={(e) => setStatusDraft(e.target.value)}
                                disabled={saving}
                            >
                                {STATUS_OPTIONS.map((s) => (
                                    <option key={s} value={s}>
                                        {s === "Pending" ? "New" : s}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <button
                            className="orders-save-status"
                            onClick={handleSaveStatus}
                            disabled={saving || statusDraft === currentStatus}
                        >
                            {saving ? "Saving…" : "Save"}
                        </button>
                        <button
                            className="orders-cancel-order"
                            onClick={handleCancelOrder}
                            disabled={saving}
                        >
                            Cancel Order
                        </button>
                    </div>
                )}

            </div>

        </div>
    );

}

export default OrderDetailsModal;
