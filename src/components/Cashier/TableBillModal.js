import { useState } from "react";

// The cashier's bill screen for a table the waiter sent to billing. The cashier
// can review/edit the items (adjust qty, remove, add), pick a payment method,
// then Generate Bill (prints the receipt + settles the table).
function TableBillModal({ table, items, menuItems, busy, onSetQty, onRemoveGroup, onAddItem, onGenerate, onClose }) {

    const [method, setMethod] = useState("Cash");
    const [adding, setAdding] = useState(false);
    const [search, setSearch] = useState("");

    // Merge per-order-item rows into display lines by item.
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
    const service = Math.round(subtotal * 0.02);
    const total = subtotal + gst + service;

    const inc = (g) => onSetQty(g.rows[0].id, Number(g.rows[0].quantity) + 1);
    const dec = (g) => {
        const row = g.rows[g.rows.length - 1];
        onSetQty(row.id, Number(row.quantity) - 1);
    };

    const addable = (menuItems || []).filter(
        (mi) => Number(mi.available_quantity) !== 0 &&
                mi.item_name.toLowerCase().includes(search.trim().toLowerCase())
    );
    const pick = (mi) => { onAddItem(mi); setSearch(""); setAdding(false); };

    return (
        <div className="tbill-overlay" onClick={onClose}>
            <div className="tbill-modal" onClick={(e) => e.stopPropagation()}>

                <div className="tbill-head">
                    <div>
                        <h2>Bill · Table {table.table_number}</h2>
                        <span className="tbill-sub">Review &amp; edit, then take payment</span>
                    </div>
                    <button className="tbill-close" onClick={onClose} disabled={busy}>✕</button>
                </div>

                <div className="tbill-body">
                    {groups.length === 0 ? (
                        <p className="tbill-empty">No items on this bill.</p>
                    ) : (
                        groups.map((g) => (
                            <div key={g.key} className="tbill-row">
                                <div className="tbill-row-info">
                                    <span className="tbill-name">{g.item_name}</span>
                                    <span className="tbill-unit">₹{g.price.toFixed(0)} each</span>
                                </div>
                                <div className="tbill-row-right">
                                    <div className="tbill-stepper">
                                        <button disabled={busy} onClick={() => dec(g)}>−</button>
                                        <span className="tbill-qty">{g.qty}</span>
                                        <button className="add" disabled={busy} onClick={() => inc(g)}>+</button>
                                    </div>
                                    <span className="tbill-amt">₹{(g.price * g.qty).toFixed(0)}</span>
                                    <button className="tbill-del" disabled={busy} onClick={() => onRemoveGroup(g.rows)}>✕</button>
                                </div>
                            </div>
                        ))
                    )}

                    {adding ? (
                        <div className="tbill-add">
                            <input
                                className="tbill-add-search"
                                placeholder="Search item to add…"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                autoFocus
                            />
                            <div className="tbill-add-list">
                                {addable.length === 0 ? (
                                    <p className="tbill-empty">{(menuItems || []).length === 0 ? "Loading menu…" : "No matching items."}</p>
                                ) : (
                                    addable.slice(0, 30).map((mi) => (
                                        <button key={mi.id} className="tbill-add-row" disabled={busy} onClick={() => pick(mi)}>
                                            <span>{mi.item_name}</span>
                                            <span className="tbill-add-price">₹{Number(mi.price).toFixed(0)}</span>
                                            <span className="tbill-add-plus">＋</span>
                                        </button>
                                    ))
                                )}
                            </div>
                            <button className="tbill-add-done" onClick={() => { setAdding(false); setSearch(""); }}>Done</button>
                        </div>
                    ) : (
                        <button className="tbill-add-toggle" disabled={busy} onClick={() => setAdding(true)}>＋ Add an item</button>
                    )}
                </div>

                <div className="tbill-foot">
                    <div className="tbill-tot"><span>Subtotal</span><span>₹{subtotal.toFixed(0)}</span></div>
                    <div className="tbill-tot"><span>GST (5%)</span><span>₹{gst.toFixed(0)}</span></div>
                    <div className="tbill-tot"><span>Service (2%)</span><span>₹{service.toFixed(0)}</span></div>
                    <div className="tbill-tot grand"><span>Total</span><span>₹{total.toFixed(0)}</span></div>

                    <div className="tbill-pay">
                        <span className="tbill-pay-label">Payment</span>
                        <div className="tbill-pay-methods">
                            {["Cash", "Card", "UPI"].map((m) => (
                                <button key={m} className={`tbill-pay-btn${method === m ? " active" : ""}`} onClick={() => setMethod(m)}>{m}</button>
                            ))}
                        </div>
                    </div>

                    <button className="tbill-generate" disabled={busy || groups.length === 0} onClick={() => onGenerate(method, total)}>
                        {busy ? "Working…" : `🖨 Generate Bill · ₹${total.toFixed(0)}`}
                    </button>
                </div>

            </div>
        </div>
    );
}

export default TableBillModal;
