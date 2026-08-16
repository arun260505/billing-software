// Bill preview the waiter reviews BEFORE sending to the cashier. Items can be
// cancelled here (customer changed their mind); the total updates live. Only on
// "Confirm & Send to Cashier" is the bill actually sent.
function BillModal({ tableLabel, items, busy, onCancelItem, onConfirm, onClose }) {

    const subtotal = items.reduce((s, i) => s + Number(i.price) * Number(i.quantity), 0);
    const gst = Math.round(subtotal * 0.05);
    const total = subtotal + gst;

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
                    {items.length === 0 ? (
                        <p className="bill-empty">No items on this bill.</p>
                    ) : (
                        items.map((it) => (
                            <div key={it.id} className="bill-row">
                                <div className="bill-row-info">
                                    <span className="bill-qty">{it.quantity}×</span>
                                    <span className="bill-name">{it.item_name}</span>
                                </div>
                                <div className="bill-row-right">
                                    <span className="bill-amt">₹{(Number(it.price) * Number(it.quantity)).toFixed(0)}</span>
                                    <button
                                        className="bill-cancel-item"
                                        disabled={busy}
                                        onClick={() => onCancelItem(it)}
                                        title="Cancel this item"
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
                        disabled={busy || items.length === 0}
                    >
                        {busy ? "Sending…" : "✓ Confirm & Send to Cashier"}
                    </button>
                </div>

            </div>
        </div>
    );
}

export default BillModal;
