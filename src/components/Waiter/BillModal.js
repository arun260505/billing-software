import { useState } from "react";
import { billTotals, ratesFrom } from "../../utils/rates";
import useEscapeClose from "../../hooks/useEscapeClose";

// Bill preview the waiter reviews BEFORE sending to the cashier. Identical items
// are merged into one line with a  −  qty  +  stepper, and can be adjusted or
// removed here. The waiter can also ADD an item that was served but not recorded.
// None of this touches the kitchen. Only "Confirm & Send" actually sends the bill.
function BillModal({ tableLabel, items, menuItems, busy, settings, onSetQty, onRemoveGroup, onAddItem, onConfirm, onClose }) {

    // Esc closes the modal (see hooks/useEscapeClose).
    useEscapeClose(onClose);

    const [adding, setAdding] = useState(false);
    const [search, setSearch] = useState("");

    const pick = (mi) => {
        onAddItem(mi);
        setSearch("");
        setAdding(false);
    };

    const addable = (menuItems || []).filter(
        (mi) => Number(mi.available_quantity) !== 0 &&
                mi.item_name.toLowerCase().includes(search.trim().toLowerCase())
    );

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

    // Was Math.round(subtotal * 0.05) with no service charge — tax rounded to
    // whole rupees and 2% missing, so this preview quoted a different total
    // from the cashier screen for the same table. Now the shared calculation.
    const subtotal = groups.reduce((s, g) => s + g.price * g.qty, 0);
    const { gstPercent, servicePercent } = ratesFrom(settings);
    const { tax: gst, service_charge: service, grand_total: total } =
        billTotals(subtotal, settings);

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
                                    <span className="bill-unit">₹{g.price.toFixed(2)} each</span>
                                </div>
                                <div className="bill-row-right">
                                    <div className="bill-stepper">
                                        <button className="bill-step" disabled={busy} onClick={() => dec(g)}>−</button>
                                        <span className="bill-qty">{g.qty}</span>
                                        <button className="bill-step bill-step-add" disabled={busy} onClick={() => inc(g)}>+</button>
                                    </div>
                                    <span className="bill-amt">₹{(g.price * g.qty).toFixed(2)}</span>
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

                    {/* Add an item that was served but not on the bill */}
                    {adding ? (
                        <div className="bill-add">
                            <input
                                className="bill-add-search"
                                placeholder="Search item to add…"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onFocus={(e) => {
                                    const el = e.target;
                                    // let the on-screen keyboard start opening, then bring
                                    // the search box + list into view above it
                                    setTimeout(() => el.scrollIntoView({ block: "center", behavior: "smooth" }), 250);
                                }}
                                autoFocus
                            />
                            <div className="bill-add-list">
                                {addable.length === 0 ? (
                                    <p className="bill-empty">
                                        {(menuItems || []).length === 0 ? "Loading menu…" : "No matching items."}
                                    </p>
                                ) : (
                                    addable.slice(0, 30).map((mi) => (
                                        <button key={mi.id} className="bill-add-row" disabled={busy} onClick={() => pick(mi)}>
                                            <span className="bill-add-name">{mi.item_name}</span>
                                            <span className="bill-add-price">₹{Number(mi.price).toFixed(2)}</span>
                                            <span className="bill-add-plus">＋</span>
                                        </button>
                                    ))
                                )}
                            </div>
                            <button className="bill-add-cancel" onClick={() => { setAdding(false); setSearch(""); }}>Done</button>
                        </div>
                    ) : (
                        <button className="bill-add-toggle" disabled={busy} onClick={() => setAdding(true)}>
                            ＋ Add an item
                        </button>
                    )}
                </div>

                <div className="bill-totals">
                    <div className="bill-line"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
                    <div className="bill-line"><span>GST {gstPercent}%</span><span>₹{gst.toFixed(2)}</span></div>
                    <div className="bill-line"><span>Service {servicePercent}%</span><span>₹{service.toFixed(2)}</span></div>
                    <div className="bill-line bill-grand"><span>Total</span><span>₹{total.toFixed(2)}</span></div>
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
