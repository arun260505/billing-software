import { useState } from "react";
import { autoChargesFor, optionalChargesFor, billTotals, money } from "../../utils/rates";
import useEscapeClose from "../../hooks/useEscapeClose";

// `charges` is the restaurant's charge list (Admin → Charges). The ones flagged
// to apply automatically — GST, service charge, a standing fee — are on the bill
// already; the rest are the chips the cashier can add. A restaurant with none
// configured bills the goods and nothing else.
function TableBillModal({ table, items, menuItems, busy, charges = [], onSetQty, onRemoveGroup, onAddItem, onServe, onGenerate, onClose }) {

    // Esc closes this modal (src/hooks/useEscapeClose.js).
    useEscapeClose(onClose);

    const [method, setMethod] = useState("Cash");
    // Split payment: when on, the cashier allocates the total across several
    // methods (e.g. Cash + UPI). When off, one method covers the whole total.
    const [splitMode, setSplitMode] = useState(false);
    const [splitAmounts, setSplitAmounts] = useState({ Cash: "", Card: "", UPI: "", Wallet: "" });
    const [adding, setAdding] = useState(false);
    const [search, setSearch] = useState("");
    const [selectedCharges, setSelectedCharges] = useState([]);

    // A table bill is always dine-in, so a charge marked takeaway-only stays off it.
    const autoCharges = autoChargesFor(charges, "Dine-In");
    const pickableCharges = optionalChargesFor(charges, "Dine-In");

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

    const toggleCharge = (charge) => {
        setSelectedCharges((prev) =>
            prev.find((c) => c.id === charge.id)
                ? prev.filter((c) => c.id !== charge.id)
                : [...prev, charge]
        );
    };

    // utils/rates mirrors backend/utils/billing.js — same filtering, same paise
    // rounding, same order — so the total shown here is the total printed and
    // the total the backend stores.
    const subtotal = money(groups.reduce((s, g) => s + g.price * g.qty, 0));
    const {
        charges_total: chargesTotal,
        grand_total: total,
        tax_lines: taxLines,
        service_lines: serviceLines,
        charge_lines: chargeLines
    } = billTotals(subtotal, [...autoCharges, ...selectedCharges]);

    // Every item must be marked served before the cashier can generate the bill.
    const unservedCount = items.filter((it) => Number(it.served) !== 1).length;
    const canGenerate = !busy && groups.length > 0 && unservedCount === 0;

    const PAY_METHODS = ["Cash", "Card", "UPI", "Wallet"];

    // When split mode is off, the whole total is paid with the single selected method.
    // When on, we collect the split {method, amount} lines that have a value > 0.
    const parsedSplits = () =>
        PAY_METHODS
            .filter((m) => {
                const v = Number(splitAmounts[m]);
                return Number.isFinite(v) && v > 0;
            })
            .map((m) => ({ method: m, amount: money(Number(splitAmounts[m])) }));

    const splitSum = money(parsedSplits().reduce((s, p) => s + p.amount, 0));

    // The cashier enters whole rupees (the same rounded value shown on the bill),
    // but the exact total can carry paise. So we confirm the split against the
    // rounded total, and then nudge the largest line to absorb any paise gap so
    // the payments always sum to the exact total sent to the backend/printer.
    const splitValid =
        splitMode &&
        parsedSplits().length >= 2 &&
        Math.abs(money(splitSum) - money(total)) < 0.5;

    // Final splits: exact to the paise, with any remainder folded into the
    // method that was given the largest amount.
    const exactSplits = (() => {
        const list = parsedSplits().map((p) => ({ ...p }));
        if (list.length === 0) return list;
        const diff = money(total - list.reduce((s, p) => s + p.amount, 0));
        if (money(diff) !== 0) {
            const idx = list.reduce((bi, p, i, a) => (p.amount >= a[bi].amount ? i : bi), 0);
            list[idx] = { ...list[idx], amount: money(list[idx].amount + diff) };
        }
        return list;
    })();

    // The payments reported to the parent: either one full payment, or the splits.
    const payments = splitMode
        ? exactSplits
        : [{ method, amount: total }];

    const setSplitAmount = (m, v) => {
        setSplitAmounts((prev) => ({ ...prev, [m]: v }));
    };

    const canGeneratePayments = splitMode ? splitValid : true;

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

                {/* The bill can't be generated until every line is served, so on a
                    full table that meant tapping Serve on each row in turn. One
                    button does the lot; the per-row Serve stays for the normal
                    case where food goes out a dish at a time. */}
                {onServe && unservedCount > 0 && (
                    <div className="tbill-serveall-bar">
                        <span>{unservedCount} item{unservedCount === 1 ? "" : "s"} not served yet</span>
                        <button
                            className="tbill-serveall"
                            disabled={busy}
                            onClick={() => onServe(items.filter((it) => Number(it.served) !== 1))}
                        >
                            ✓ Serve all
                        </button>
                    </div>
                )}

                <div className="tbill-body">
                    {groups.length === 0 ? (
                        <p className="tbill-empty">No items on this bill.</p>
                    ) : (
                        groups.map((g) => (
                            <div key={g.key} className="tbill-row">
                                <div className="tbill-row-info">
                                    <span className="tbill-name">{g.item_name}</span>
                                    <span className="tbill-unit">₹{g.price.toFixed(2)} each</span>
                                </div>
                                <div className="tbill-row-right">
                                    <div className="tbill-stepper">
                                        <button disabled={busy} onClick={() => dec(g)}>−</button>
                                        <span className="tbill-qty">{g.qty}</span>
                                        <button className="add" disabled={busy} onClick={() => inc(g)}>+</button>
                                    </div>
                                    <span className="tbill-amt">₹{(g.price * g.qty).toFixed(2)}</span>
                                    {g.rows.every((r) => Number(r.served) === 1) ? (
                                        <span className="tbill-served-tag" title="All units of this item are served">✓ Served</span>
                                    ) : onServe ? (
                                        <button
                                            className="tbill-serve"
                                            disabled={busy}
                                            onClick={() => onServe(g.rows)}
                                            title="Mark this item as served"
                                        >
                                            {g.rows.every((r) => Number(r.served) === 1) ? "✓ Served" : "Serve"}
                                        </button>
                                    ) : null}
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
                                            <span className="tbill-add-price">₹{Number(mi.price).toFixed(2)}</span>
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
                    <div className="tbill-tot"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>

                    {/* The charges this restaurant applies to every bill, named
                        as they are in Admin → Charges. None configured, none
                        shown — no phantom GST line on a bill that has no GST. */}
                    {[...taxLines, ...serviceLines].map((c, i) => (
                        <div className="tbill-tot" key={`${c.charge_name}-${i}`}>
                            <span>{c.charge_name}</span><span>₹{c.amount.toFixed(2)}</span>
                        </div>
                    ))}

                    {pickableCharges.length > 0 && (
                        <div className="tbill-charges-section">
                            <div className="tbill-charges-label">Additional Charges</div>
                            <div className="tbill-charges-grid">
                                {pickableCharges.map((c) => {
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

                    {chargeLines.length > 0 && (
                        <>
                            {/* Already resolved to rupees by billTotals, so these
                                lines cannot disagree with the total they are
                                part of. */}
                            {chargeLines.map((c, i) => (
                                <div key={`${c.charge_name}-${i}`} className="tbill-tot tbill-charge-row">
                                    <span>{c.charge_name}</span>
                                    <span>₹{c.amount.toFixed(2)}</span>
                                </div>
                            ))}
                            <div className="tbill-tot tbill-charges-total"><span>Total Charges</span><span>₹{chargesTotal.toFixed(2)}</span></div>
                        </>
                    )}

                    <div className="tbill-tot grand"><span>Total</span><span>₹{total.toFixed(2)}</span></div>

                    <div className="tbill-pay">
                        <div className="tbill-pay-head">
                            <span className="tbill-pay-label">Payment</span>
                            <button
                                className={`tbill-split-toggle${splitMode ? " active" : ""}`}
                                onClick={() => setSplitMode((s) => !s)}
                                disabled={busy}
                            >
                                {splitMode ? "Split ON" : "Split"}
                            </button>
                        </div>

                        {!splitMode && (
                            <div className="tbill-pay-methods">
                                {PAY_METHODS.map((m) => (
                                    <button key={m} className={`tbill-pay-btn${method === m ? " active" : ""}`} onClick={() => setMethod(m)}>{m}</button>
                                ))}
                            </div>
                        )}
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
                                        onChange={(e) => setSplitAmount(m, e.target.value)}
                                        disabled={busy}
                                    />
                                </div>
                            ))}
                            <div className={`tbill-split-total${money(splitSum) === money(total) ? " ok" : " bad"}`}>
                                Allocated {money(splitSum).toFixed(2)} / {total.toFixed(2)}
                            </div>
                        </div>
                    )}

                    {unservedCount > 0 && (
                        <div className="tbill-unserved-warning">
                            ⚠ {unservedCount} item{unservedCount > 1 ? "s" : ""} not yet served — mark all items as served before generating the bill.
                        </div>
                    )}

                    {splitMode && !splitValid && money(splitSum) !== money(total) && (
                        <div className="tbill-split-error">
                            Split amounts must add up to the total (₹{total.toFixed(2)}) and use at least 2 methods.
                        </div>
                    )}

                    <button
                        className="tbill-generate"
                        disabled={!canGenerate || !canGeneratePayments}
                        onClick={() => onGenerate(payments, total, selectedCharges)}
                    >
                        {busy ? "Working…" : unservedCount > 0 ? `Served ${groups.length - unservedCount}/${groups.length} — Generate Locked` : `🖨 Generate Bill · ₹${total.toFixed(2)}`}
                    </button>
                </div>

            </div>
        </div>
    );
}

export default TableBillModal;
