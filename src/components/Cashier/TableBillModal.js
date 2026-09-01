import { useState, useEffect } from "react";
import chargeService from "../../services/chargeService";
import { isValidCharge } from "../../utils/charges";

function TableBillModal({ table, items, menuItems, busy, onSetQty, onRemoveGroup, onAddItem, onGenerate, onClose }) {

    const [method, setMethod] = useState("Cash");
    const [adding, setAdding] = useState(false);
    const [search, setSearch] = useState("");
    const [charges, setCharges] = useState([]);
    const [selectedCharges, setSelectedCharges] = useState([]);

    useEffect(() => {
        chargeService.getCharges().then((res) => {
            setCharges((res.data.data || []).filter((c) => c.status === "Active" && isValidCharge(c)));
        }).catch(() => {});
    }, []);

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

    // Same paise rounding as backend/utils/billing.js and the receipt printer,
    // so the total shown here is the total printed and the total stored.
    const money = (n) => Math.round((Number(n) || 0) * 100) / 100;

    const subtotal = money(groups.reduce((s, g) => s + g.price * g.qty, 0));
    const gst = money(subtotal * 0.05);
    const service = money(subtotal * 0.02);

    const toggleCharge = (charge) => {
        setSelectedCharges((prev) =>
            prev.find((c) => c.id === charge.id)
                ? prev.filter((c) => c.id !== charge.id)
                : [...prev, charge]
        );
    };

    const chargesTotal = money(selectedCharges.reduce((sum, c) => {
        if (c.charge_type === "Percentage") return sum + money(subtotal * c.amount / 100);
        return sum + money(c.amount);
    }, 0));

    const total = money(subtotal + gst + service + chargesTotal);

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

                    {charges.length > 0 && (
                        <div className="tbill-charges-section">
                            <div className="tbill-charges-label">Additional Charges</div>
                            <div className="tbill-charges-grid">
                                {charges.map((c) => {
                                    const isActive = selectedCharges.some((sc) => sc.id === c.id);
                                    const value = c.charge_type === "Percentage"
                                        ? `${c.amount}%`
                                        : `₹${c.amount}`;
                                    return (
                                        <button
                                            key={c.id}
                                            className={`tbill-charge-chip${isActive ? " active" : ""}`}
                                            onClick={() => toggleCharge(c)}
                                            disabled={busy}
                                        >
                                            <span className="tbill-charge-name">{c.charge_name}</span>
                                            <span className="tbill-charge-value">{value}</span>
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
                                    ? Math.round(subtotal * c.amount / 100)
                                    : Number(c.amount);
                                return (
                                    <div key={c.id} className="tbill-tot tbill-charge-row">
                                        <span>{c.charge_name}</span>
                                        <span>₹{val.toFixed(0)}</span>
                                    </div>
                                );
                            })}
                            <div className="tbill-tot tbill-charges-total"><span>Total Charges</span><span>₹{chargesTotal.toFixed(0)}</span></div>
                        </>
                    )}

                    <div className="tbill-tot grand"><span>Total</span><span>₹{total.toFixed(0)}</span></div>

                    <div className="tbill-pay">
                        <span className="tbill-pay-label">Payment</span>
                        <div className="tbill-pay-methods">
                            {["Cash", "Card", "UPI"].map((m) => (
                                <button key={m} className={`tbill-pay-btn${method === m ? " active" : ""}`} onClick={() => setMethod(m)}>{m}</button>
                            ))}
                        </div>
                    </div>

                    <button className="tbill-generate" disabled={busy || groups.length === 0} onClick={() => onGenerate(method, total, selectedCharges)}>
                        {busy ? "Working…" : `🖨 Generate Bill · ₹${total.toFixed(0)}`}
                    </button>
                </div>

            </div>
        </div>
    );
}

export default TableBillModal;
