import { useState } from "react";
import { allAutoChargesFor, billTotals, resolveDiscount } from "../../utils/rates";
import useEscapeClose from "../../hooks/useEscapeClose";
import { isSalon } from "../../utils/businessType";

// A settled bill, opened for correction: adjust a quantity that was rung up
// twice, drop an item that was never served, add one that was missed — then
// reprint. Totals shown here are the ones that will be saved and charged.
//
// The tax and service lines used to be a hardcoded 5% and 2% here, so correcting
// a bill at a restaurant on any other rate — or on none at all — quoted a total
// the backend then refused to agree with. They now come from the restaurant's
// own charge rows (Admin → Charges), like everywhere else.
function BillEditModal({ bill, items, menuItems, busy, chargedTotal, charges = [],
                         onSetQty, onRemoveGroup, onAddItem, onReprint, onWhatsApp, onClose }) {

    // Esc closes this modal (src/hooks/useEscapeClose.js).
    useEscapeClose(onClose);

    const [method, setMethod] = useState(bill.payment_method || "Cash");
    const [adding, setAdding] = useState(false);
    const [search, setSearch] = useState("");

    // Merge the order_item rows into one display line per item + price.
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

    // Same arithmetic as backend/utils/billing.js, so the figure on screen is
    // the figure that gets saved.
    const money = (n) => Math.round((Number(n) || 0) * 100) / 100;

    const subtotal = money(groups.reduce((s, g) => s + g.price * g.qty, 0));

    // The bill's discount carries through a correction exactly as the backend
    // recomputes it: a percentage is re-taken off the new subtotal, a flat amount
    // stays (capped at the subtotal).
    const hasPercent = bill.discount_percent !== null && bill.discount_percent !== undefined;
    const discount = resolveDiscount(subtotal, {
        percent: hasPercent ? bill.discount_percent : null,
        amount: bill.discount
    });
    const discountLabel = hasPercent ? `Discount (${Number(bill.discount_percent)}%)` : "Discount";

    const {
        tax: gst,
        service_charge: service,
        grand_total: total,
        tax_lines: taxLines,
        service_lines: serviceLines,
        charge_lines: chargeLines
    } = billTotals(subtotal, allAutoChargesFor(charges, bill.order_type || (bill.table_name ? "Dine-In" : "Takeaway")), discount);

    // What the customer was actually charged when this bill was settled.
    const charged = Number(chargedTotal || 0);
    const difference = Math.round((total - charged) * 100) / 100;
    const changed = Math.abs(difference) >= 0.01;

    const inc = (g) => onSetQty(g.rows[0].id, Number(g.rows[0].quantity) + 1);
    const dec = (g) => {
        const row = g.rows[g.rows.length - 1];
        onSetQty(row.id, Number(row.quantity) - 1);
    };

    const addable = (menuItems || []).filter((mi) =>
        mi.item_name.toLowerCase().includes(search.trim().toLowerCase())
    );
    const pick = (mi) => { onAddItem(mi); setSearch(""); setAdding(false); };

    // A salon bill is identified by its customer and stylist, and holds services.
    const salon = isSalon();
    const noun = salon ? "service" : "item";
    const where = salon
        ? [bill.customer_name || "Walk-in", bill.stylist_name && `Stylist: ${bill.stylist_name}`].filter(Boolean).join(" · ")
        : bill.table_name ? `Table ${bill.table_name}` : "Counter";

    return (
        <div className="tbill-overlay" onClick={onClose}>
            <div className="tbill-modal" onClick={(e) => e.stopPropagation()}>

                <div className="tbill-head">
                    <div>
                        <h2>Bill {bill.order_number}</h2>
                        <span className="tbill-sub">{where} · settled · correct &amp; reprint</span>
                    </div>
                    <button className="tbill-close" onClick={onClose} disabled={busy}>✕</button>
                </div>

                <div className="tbill-body">
                    {groups.length === 0 ? (
                        <p className="tbill-empty">No {noun}s on this bill.</p>
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
                                    <button
                                        className="tbill-del"
                                        disabled={busy || groups.length === 1}
                                        title={groups.length === 1
                                            ? `A bill must keep at least one ${noun}`
                                            : `Remove this ${noun}`}
                                        onClick={() => onRemoveGroup(g.rows)}
                                    >✕</button>
                                </div>
                            </div>
                        ))
                    )}

                    {adding ? (
                        <div className="tbill-add">
                            <input
                                className="tbill-add-search"
                                placeholder={`Search ${noun} to add…`}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                autoFocus
                            />
                            <div className="tbill-add-list">
                                {addable.length === 0 ? (
                                    <p className="tbill-empty">
                                        {(menuItems || []).length === 0
                                            ? (salon ? "Loading services…" : "Loading menu…")
                                            : `No matching ${noun}s.`}
                                    </p>
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
                        <button className="tbill-add-toggle" disabled={busy} onClick={() => setAdding(true)}>
                            ＋ Add a missed {noun}
                        </button>
                    )}
                </div>

                <div className="tbill-foot">
                    <div className="tbill-tot"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
                    {discount > 0 && (
                        <div className="tbill-tot"><span>{discountLabel}</span><span>−₹{discount.toFixed(2)}</span></div>
                    )}
                    {[...taxLines, ...serviceLines, ...chargeLines].map((c, i) => (
                        <div className="tbill-tot" key={`${c.charge_name}-${i}`}>
                            <span>{c.charge_name}</span><span>₹{c.amount.toFixed(2)}</span>
                        </div>
                    ))}
                    <div className="tbill-tot grand"><span>Total</span><span>₹{total.toFixed(2)}</span></div>

                    {changed && (
                        <div className={`billedit-diff${difference > 0 ? " up" : " down"}`}>
                            <span>Was charged ₹{charged.toFixed(2)}</span>
                            <span>
                                {difference > 0 ? "Collect" : "Refund"} ₹{Math.abs(difference).toFixed(2)}
                            </span>
                        </div>
                    )}

                    <div className="tbill-pay">
                        <span className="tbill-pay-label">Payment</span>
                        <div className="tbill-pay-methods">
                            {["Cash", "Card", "UPI"].map((m) => (
                                <button
                                    key={m}
                                    className={`tbill-pay-btn${method === m ? " active" : ""}`}
                                    onClick={() => setMethod(m)}
                                >{m}</button>
                            ))}
                        </div>
                    </div>

                    {(() => {
                        const totals = {
                            subtotal, gst, service, total, discount, discountLabel,
                            taxLines: [...taxLines, ...serviceLines],
                            charges: chargeLines
                        };
                        const reprintLabel = busy ? "Working…" : `🖨 ${changed ? "Save & Reprint" : "Reprint"} · ₹${total.toFixed(2)}`;
                        // Without a WhatsApp handler (or in a no-printer salon) the
                        // single button keeps the old behaviour. With both, the same
                        // corrected bill can go out on paper, on WhatsApp, or both —
                        // always the same order number (rebill reuses the order).
                        if (!onWhatsApp) {
                            return (
                                <button className="tbill-generate" disabled={busy || groups.length === 0}
                                    onClick={() => onReprint(method, totals)}>
                                    {reprintLabel}
                                </button>
                            );
                        }
                        return (
                            <div className="tbill-deliver">
                                <button className="tbill-generate" disabled={busy || groups.length === 0}
                                    onClick={() => onReprint(method, totals)}>
                                    {reprintLabel}
                                </button>
                                <div className="tbill-deliver-wa">
                                    <button className="tbill-wa" disabled={busy || groups.length === 0}
                                        onClick={() => onWhatsApp(method, totals, { print: false })}>
                                        Send on WhatsApp
                                    </button>
                                    <button className="tbill-wa tbill-wa-both" disabled={busy || groups.length === 0}
                                        onClick={() => onWhatsApp(method, totals, { print: true })}>
                                        Bill + WhatsApp
                                    </button>
                                </div>
                            </div>
                        );
                    })()}
                </div>

            </div>
        </div>
    );
}

export default BillEditModal;
