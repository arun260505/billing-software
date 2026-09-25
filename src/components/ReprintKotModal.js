import { useState } from "react";
import "./ReprintKotModal.css";

// Pick which items to re-send to the kitchen when a KOT didn't print fully
// (e.g. the paper ran out mid-print). EVERYTHING STARTS UNSELECTED — staff tick
// only the items the kitchen missed, so already-cooked items aren't remade. The
// chosen items are printed in the normal KOT format by the caller.
function ReprintKotModal({ title = "Reprint KOT", items = [], busy = false, onPrint, onClose }) {

    // One line per item+price, quantities summed (an order can hold several rows
    // for the same item).
    const groups = [];
    const byKey = {};
    items.forEach((it) => {
        const name = it.item_name || it.name;
        const price = Number(it.price || 0);
        const qty = Number(it.quantity != null ? it.quantity : it.qty || 0);
        if (!name || qty <= 0) return;
        const key = `${name}|${price}`;
        if (!byKey[key]) { byKey[key] = { key, item_name: name, price, quantity: 0 }; groups.push(byKey[key]); }
        byKey[key].quantity += qty;
    });

    const [sel, setSel] = useState({});   // key -> true (default: none)
    const toggle = (k) => setSel((p) => ({ ...p, [k]: !p[k] }));
    const chosen = groups.filter((g) => sel[g.key]);
    const allOn = groups.length > 0 && chosen.length === groups.length;
    const setAll = (on) => setSel(on ? Object.fromEntries(groups.map((g) => [g.key, true])) : {});
    const chosenQty = chosen.reduce((s, g) => s + g.quantity, 0);

    const doPrint = () => {
        if (!chosen.length || busy) return;
        onPrint(chosen.map((g) => ({ item_name: g.item_name, quantity: g.quantity, price: g.price })));
    };

    return (
        <div className="rk-overlay" onClick={onClose}>
            <div className="rk-modal" onClick={(e) => e.stopPropagation()}>

                <div className="rk-head">
                    <h3>{title}</h3>
                    <button className="rk-x" onClick={onClose} disabled={busy} aria-label="Close">✕</button>
                </div>

                <p className="rk-sub">Tick only the items the kitchen missed, then reprint. Nothing is selected by default.</p>

                {groups.length === 0 ? (
                    <p className="rk-empty">No items to reprint.</p>
                ) : (
                    <>
                        <button className="rk-all" onClick={() => setAll(!allOn)} disabled={busy}>
                            {allOn ? "Unselect all" : "Select all"}
                        </button>
                        <div className="rk-list">
                            {groups.map((g) => (
                                <label key={g.key} className={`rk-row${sel[g.key] ? " on" : ""}`}>
                                    <input
                                        type="checkbox"
                                        checked={!!sel[g.key]}
                                        onChange={() => toggle(g.key)}
                                        disabled={busy}
                                    />
                                    <span className="rk-name">{g.item_name}</span>
                                    <span className="rk-qty">×{g.quantity}</span>
                                </label>
                            ))}
                        </div>
                    </>
                )}

                <div className="rk-foot">
                    <button className="rk-cancel" onClick={onClose} disabled={busy}>Cancel</button>
                    <button className="rk-print" onClick={doPrint} disabled={busy || chosen.length === 0}>
                        {busy ? "Printing…" : `🖨 Reprint${chosenQty ? ` (${chosenQty})` : ""}`}
                    </button>
                </div>

            </div>
        </div>
    );
}

export default ReprintKotModal;
