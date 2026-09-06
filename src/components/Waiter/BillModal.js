import { useState, useEffect } from "react";
import { autoChargesFor, optionalChargesFor, preselectedWaiterChargesFor, billTotals } from "../../utils/rates";
import useEscapeClose from "../../hooks/useEscapeClose";

// Bill preview the waiter reviews BEFORE sending to the cashier. Identical items
// are merged into one line with a  −  qty  +  stepper, and can be adjusted or
// removed here. The waiter can also ADD an item that was served but not recorded.
// None of this touches the kitchen. Only "Confirm & Send" actually sends the bill.
//
// `charges` is the restaurant's charge list (Admin → Charges); the ones set to
// apply automatically are what the GST / service lines below come from.
// When `canSettle` is true (Admin enabled "waiter can print bill"), the waiter
// picks a payment method and the button becomes "Print & Settle" (onSettle).
// Otherwise the bill is sent to the cashier to print/settle (onConfirm).
function BillModal({ tableLabel, items, menuItems, busy, charges = [], canSettle = false, onSetQty, onRemoveGroup, onAddItem, onServeAll, onConfirm, onSettle, onClose }) {

    // Esc closes the modal (see hooks/useEscapeClose).
    useEscapeClose(onClose);

    const [adding, setAdding] = useState(false);
    const [search, setSearch] = useState("");
    const [method, setMethod] = useState("Cash");
    // Extra charges (parcel, packing …). By default they start UNticked on the
    // waiter app — the waiter bills what the table ate and ticks an extra only
    // when the customer also parcels — but Admin can mark a charge to start
    // ticked on the waiter too (preselect_waiter). GST/service stay locked below.
    const [selectedCharges, setSelectedCharges] = useState(() => preselectedWaiterChargesFor(charges, "Dine-In"));

    // Charges are fetched, so the list can arrive after first render; reseed the
    // waiter-preselected extras when it (or its contents) changes.
    const chargeKey = (Array.isArray(charges) ? charges : []).map((c) => c.id).join(",");
    useEffect(() => {
        setSelectedCharges(preselectedWaiterChargesFor(charges, "Dine-In"));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chargeKey]);

    // Only when the waiter settles the bill directly do the extras matter here;
    // when the bill goes to the cashier, the cashier picks them on their screen.
    const pickableCharges = canSettle ? optionalChargesFor(charges, "Dine-In") : [];

    const toggleCharge = (charge) => {
        setSelectedCharges((prev) =>
            prev.find((c) => c.id === charge.id)
                ? prev.filter((c) => c.id !== charge.id)
                : [...prev, charge]
        );
    };

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
    // Locked autos (GST/service) are always on; the extras the waiter ticked
    // (selectedCharges) are added on top.
    const totals = billTotals(subtotal, [...autoChargesFor(charges, "Dine-In"), ...selectedCharges]);
    const total = totals.grand_total;
    const billedLines = [...totals.tax_lines, ...totals.service_lines, ...totals.charge_lines];

    // A bill can only be settled once every item is served. Count what's left so
    // we can offer a one-tap "Serve all" and block Print & Settle until it's done.
    const unservedCount = items.filter((it) => Number(it.served) !== 1).length;

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

                    {/* Extra charges the waiter can add (parcel, packing …). They
                        start OFF — tapped on only when the customer also parcels. */}
                    {pickableCharges.length > 0 && (
                        <div className="wbill-charges">
                            <div className="wbill-charges-label">Additional Charges</div>
                            <div className="wbill-chip-grid">
                                {pickableCharges.map((c) => {
                                    const active = selectedCharges.some((sc) => sc.id === c.id);
                                    const value = c.charge_type === "Percentage" ? `${c.amount}%` : `₹${c.amount}`;
                                    return (
                                        <button
                                            key={c.id}
                                            type="button"
                                            className={`wbill-chip${active ? " active" : ""}`}
                                            disabled={busy}
                                            onClick={() => toggleCharge(c)}
                                        >
                                            <span className="wbill-chip-name">{c.charge_name}</span>
                                            <span className="wbill-chip-val">{value}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {billedLines.map((c, i) => (
                        <div className="bill-line" key={`${c.charge_name}-${i}`}>
                            <span>{c.charge_name}</span><span>₹{c.amount.toFixed(2)}</span>
                        </div>
                    ))}
                    <div className="bill-line bill-grand"><span>Total</span><span>₹{total.toFixed(2)}</span></div>
                </div>

                {canSettle && unservedCount > 0 && (
                    <div className="bill-serveall">
                        <span>{unservedCount} item{unservedCount === 1 ? "" : "s"} not served yet</span>
                        <button type="button" className="bill-serveall-btn" disabled={busy} onClick={onServeAll}>
                            ✓ Serve all
                        </button>
                    </div>
                )}

                {canSettle && (
                    <div className="bill-pay">
                        <span className="bill-pay-label">Payment</span>
                        <div className="bill-pay-methods">
                            {["Cash", "Card", "UPI"].map((m) => (
                                <button
                                    key={m}
                                    type="button"
                                    className={`bill-pay-btn${method === m ? " active" : ""}`}
                                    disabled={busy}
                                    onClick={() => setMethod(m)}
                                >
                                    {m}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="bill-actions">
                    <button className="bill-back" onClick={onClose} disabled={busy}>Keep Editing</button>
                    {canSettle ? (
                        <button
                            className="bill-confirm"
                            onClick={() => onSettle && onSettle(method, selectedCharges)}
                            disabled={busy || groups.length === 0 || unservedCount > 0}
                        >
                            {busy ? "Working…"
                                : unservedCount > 0 ? "Serve all items first"
                                : `🧾 Print & Settle · ₹${total.toFixed(2)}`}
                        </button>
                    ) : (
                        <button
                            className="bill-confirm"
                            onClick={onConfirm}
                            disabled={busy || groups.length === 0}
                        >
                            {busy ? "Working…" : "✓ Confirm & Send to Cashier"}
                        </button>
                    )}
                </div>

            </div>
        </div>
    );
}

export default BillModal;
