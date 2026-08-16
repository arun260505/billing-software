// Bill preview the waiter reviews BEFORE sending to the cashier. Identical items
// are merged into one line with a  −  qty  +  stepper, and can be adjusted or
// removed here. Adjusting quantity only edits the existing order (it never
// creates a new kitchen ticket). Only "Confirm & Send" actually sends the bill.
function BillModal({ tableLabel, items, busy, onSetQty, onRemoveGroup, onConfirm, onClose }) {

    // Merge the raw per-order-item rows into display groups by item.
    const groups = [];
    const byKey = {};
    items.forEach((it) => {
        const key = `${it.item_name}|${it.price}`;
        if (!byKey[key]) {
            byKey[key] = { key, item_name: it.item_name, price: Number(it.price), qty: 0, rows: [] };
            groups.push(byKey[key]);
        }
        byKey[key].qty += Number(it.quantity);
        byKey[key].rows.push(it);
    });

    const subtotal = groups.reduce((s, g) => s + g.price * g.qty, 0);
    const gst = Math.round(subtotal * 0.05);
    const total = subtotal + gst;

    const inc = (g) => onSetQty(g.rows[0].id, Number(g.rows[0].quantity) + 1);
    const dec = (g) => {
        // reduce the last underlying row by one (backend removes it if it hits 0)
        const row = g.rows[g.rows.length - 1];
        onSetQty(row.id, Number(row.quantity) - 1);
    };

    return (
        <div className="bill-overlay" onClick={onClose}>
            <div className="bill-sheet" onClick={(e) => e.stopPropagation()}>

                <div className="bill-head">
                    <div>
                        <h3>Bill · {tableLabel}</h3>
                        <span className="bill-sub">Review &amp; edit before sending</span>
                    </div>
                    <button className="bill-close" onClick={onClose} aria-label="Close">✕</button>
                </div>

                <div className="bill-body">
                    {groups.length === 0 ? (
                        <p className="bill-empty">No items on this bill.</p>
                    ) : (
                        groups.map((g) => (
                            <div key={g.key} className="bill-row">
                                <div className="bill-row-info">
                                    <span className="bill-name">{g.item_name}</span>
                                    <span className="bill-unit">₹{g.price.toFixed(0)} each</span>
                                </div>
                                <div className="bill-row-right">
                                    <div className="bill-stepper">
                                        <button className="bill-step" disabled={busy} onClick={() => dec(g)}>−</button>
                                        <span className="bill-qty">{g.qty}</span>
                                        <button className="bill-step bill-step-add" disabled={busy} onClick={() => inc(g)}>+</button>
                                    </div>
                                    <span className="bill-amt">₹{(g.price * g.qty).toFixed(0)}</span>
                                    <button
                                        className="bill-cancel-item"
                                        disabled={busy}
                                        onClick={() => onRemoveGroup(g.rows)}
                                        title="Remove this item"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="bill-totals">
                    <div className="bill-line"><span>Subtotal</span><span>₹{subtotal.toFixed(0)}</span></div>
                    <div className="bill-line"><span>GST 5%</span><span>₹{gst.toFixed(0)}</span></div>
                    <div className="bill-line bill-grand"><span>Total</span><span>₹{total.toFixed(0)}</span></div>
                </div>

                <div className="bill-actions">
                    <button className="bill-back" onClick={onClose} disabled={busy}>Keep Editing</button>
                    <button
                        className="bill-confirm"
                        onClick={onConfirm}
                        disabled={busy || groups.length === 0}
                    >
                        {busy ? "Working…" : "✓ Confirm & Send to Cashier"}
                    </button>
                </div>

            </div>
        </div>
    );
}

export default BillModal;
