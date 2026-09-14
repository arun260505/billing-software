import React, { useCallback, useEffect, useMemo, useState } from "react";

import AdminLayout from "../../layouts/AdminLayout";
import useEscapeClose from "../../hooks/useEscapeClose";
import categoryService from "../../services/categoryService";
import {
    getInventory,
    getInventorySummary,
    createInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    moveStock,
    getStockMovements
} from "../../services/inventoryService";

import "../../styles/Admin/Dashboard.css";
import "../../styles/pages/Salon/Salon.css";

const UNITS = ["pcs", "ml", "L", "g", "kg", "bottle", "tube", "box", "pack", "sachet"];

const money = (v) =>
    `₹${Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const qty = (v) => Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

const round2 = (n) => Math.round(Number(n) * 100) / 100;

const fmtDateTime = (v) =>
    v
        ? new Date(v).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
        : "—";

const MOVE_TYPES = {
    In: { label: "Stock In", field: "Quantity received", badge: "sl-badge-ok", hint: "New stock that came in — a delivery or purchase." },
    Out: { label: "Stock Out", field: "Quantity used", badge: "sl-badge-warn", hint: "Stock used on clients, sold, damaged or expired." },
    Adjust: { label: "Adjust", field: "Counted quantity", badge: "sl-badge-info", hint: "You counted the shelf — set stock to exactly this number." }
};

function stockState(item) {
    if (item.status === "Inactive") return { label: "Inactive", cls: "sl-badge-muted" };
    if (Number(item.quantity) <= 0) return { label: "Out of stock", cls: "sl-badge-bad" };
    if (Number(item.quantity) <= Number(item.min_quantity)) return { label: "Low stock", cls: "sl-badge-warn" };
    return { label: "In stock", cls: "sl-badge-ok" };
}

function ItemModal({ item, categories, salonCats = [], onClose, onSaved }) {

    const [saving, setSaving] = useState(false);
    useEscapeClose(onClose, !saving);

    const isEdit = Boolean(item);

    const [form, setForm] = useState(() => ({
        item_name: item?.item_name || "",
        category: item?.category || "",
        category_id: item?.category_id ? String(item.category_id) : "",
        sku: item?.sku || "",
        unit: item?.unit || "pcs",
        quantity: "",
        min_quantity: item ? String(Number(item.min_quantity)) : "",
        cost_price: item ? String(Number(item.cost_price)) : "",
        status: item?.status || "Active",
        sell_on_bills: item ? Number(item.sell_on_bills) === 1 : false,
        sell_price: item && Number(item.sell_price) ? String(Number(item.sell_price)) : ""
    }));

    // Picking a category sets both its id (for the product mirror) and its name.
    const onCategory = (e) => {
        const id = e.target.value;
        const found = salonCats.find((c) => String(c.id) === String(id));
        setForm((f) => ({ ...f, category_id: id, category: found ? found.category_name : "" }));
    };
    const [problem, setProblem] = useState("");

    const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

    // Keep a unit typed in before this list existed selectable.
    const units = UNITS.includes(form.unit) ? UNITS : [form.unit, ...UNITS];

    const submit = async (e) => {
        e.preventDefault();

        if (!form.item_name.trim()) return setProblem("Item name is required.");
        for (const [field, label] of [["quantity", "Opening stock"], ["min_quantity", "Reorder level"], ["cost_price", "Cost price"]]) {
            if (field === "quantity" && isEdit) continue;
            if (form[field] !== "" && !(Number(form[field]) >= 0)) return setProblem(`${label} must be 0 or more.`);
        }
        if (form.sell_on_bills) {
            if (!form.category_id) return setProblem("Choose a category for a product sold on bills.");
            if (!(Number(form.sell_price) > 0)) return setProblem("Set a selling price for a product sold on bills.");
        }

        setSaving(true);
        setProblem("");
        try {
            if (isEdit) await updateInventoryItem(item.id, form);
            else await createInventoryItem(form);
            onSaved();
        } catch (err) {
            setProblem(err.response?.data?.message || err.friendlyMessage || "Could not save the item.");
            setSaving(false);
        }
    };

    return (
        <div className="sl-overlay" onClick={() => !saving && onClose()}>
            <form className="sl-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>

                <div className="sl-modal-head">
                    <h3>{isEdit ? "Edit Item" : "Add Stock Item"}</h3>
                    <button type="button" className="sl-modal-x" onClick={onClose} disabled={saving} aria-label="Close">✕</button>
                </div>

                <div className="sl-modal-body">
                    {problem && <div className="sl-error">{problem}</div>}

                    <div className="sl-form">
                        <div className="sl-field sl-field-full">
                            <label htmlFor="inv-name">Item name *</label>
                            <input id="inv-name" value={form.item_name} onChange={set("item_name")} placeholder="e.g. Keratin Shampoo 1L" maxLength={150} autoFocus />
                        </div>

                        <div className="sl-field">
                            <label htmlFor="inv-cat">Category</label>
                            <select id="inv-cat" value={form.category_id} onChange={onCategory}>
                                <option value="">— Select category —</option>
                                {salonCats.map((c) => <option key={c.id} value={c.id}>{c.category_name}</option>)}
                            </select>
                        </div>

                        <div className="sl-field">
                            <label htmlFor="inv-sku">Code / SKU</label>
                            <input id="inv-sku" value={form.sku} onChange={set("sku")} maxLength={60} />
                        </div>

                        <div className="sl-field">
                            <label htmlFor="inv-unit">Unit</label>
                            <select id="inv-unit" value={form.unit} onChange={set("unit")}>
                                {units.map((u) => <option key={u} value={u}>{u}</option>)}
                            </select>
                        </div>

                        {isEdit ? (
                            <div className="sl-field">
                                <label>In stock</label>
                                <input value={`${qty(item.quantity)} ${item.unit}`} readOnly disabled />
                                <span className="sl-hint">Change it with Update Stock, so it's on the log.</span>
                            </div>
                        ) : (
                            <div className="sl-field">
                                <label htmlFor="inv-qty">Opening stock</label>
                                <input id="inv-qty" type="number" min="0" step="0.01" inputMode="decimal" value={form.quantity} onChange={set("quantity")} placeholder="0" />
                            </div>
                        )}

                        <div className="sl-field">
                            <label htmlFor="inv-min">Reorder level</label>
                            <input id="inv-min" type="number" min="0" step="0.01" inputMode="decimal" value={form.min_quantity} onChange={set("min_quantity")} placeholder="0" />
                            <span className="sl-hint">Flagged as low stock at or below this.</span>
                        </div>

                        <div className="sl-field">
                            <label htmlFor="inv-cost">Cost per {form.unit || "unit"} (₹)</label>
                            <input id="inv-cost" type="number" min="0" step="0.01" inputMode="decimal" value={form.cost_price} onChange={set("cost_price")} placeholder="0.00" />
                        </div>

                        <div className="sl-field sl-field-full">
                            <label htmlFor="inv-status">Status</label>
                            <select id="inv-status" value={form.status} onChange={set("status")}>
                                <option value="Active">Active</option>
                                <option value="Inactive">Inactive — no longer stocked</option>
                            </select>
                        </div>

                        <div className="sl-field sl-field-full">
                            <label className="sl-check">
                                <input
                                    type="checkbox"
                                    checked={form.sell_on_bills}
                                    onChange={(e) => setForm((f) => ({ ...f, sell_on_bills: e.target.checked }))}
                                />
                                <span>Sell this on bills — shows in the POS under its category, and its stock drops when sold.</span>
                            </label>
                        </div>

                        {form.sell_on_bills && (
                            <div className="sl-field">
                                <label htmlFor="inv-sell">Selling price (₹)</label>
                                <input id="inv-sell" type="number" min="0" step="0.01" inputMode="decimal"
                                    value={form.sell_price} onChange={set("sell_price")} placeholder="0.00" />
                                <span className="sl-hint">What the customer pays for one {form.unit || "unit"}.</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="sl-modal-foot">
                    <button type="button" className="sl-btn sl-btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
                    <button type="submit" className="sl-btn sl-btn-primary" disabled={saving}>
                        {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Item"}
                    </button>
                </div>

            </form>
        </div>
    );
}

// Record stock coming in, going out, or a shelf count.
function StockModal({ item, onClose, onSaved }) {

    const [saving, setSaving] = useState(false);
    useEscapeClose(onClose, !saving);

    const [type, setType] = useState("In");
    const [quantity, setQuantity] = useState("");
    const [note, setNote] = useState("");
    const [problem, setProblem] = useState("");

    const current = Number(item.quantity);
    const q = Number(quantity);
    const entered = quantity !== "" && Number.isFinite(q) && q >= 0;
    const next = !entered ? null
        : type === "In" ? round2(current + q)
        : type === "Out" ? round2(current - q)
        : round2(q);

    const submit = async (e) => {
        e.preventDefault();
        if (!entered || (type !== "Adjust" && q <= 0)) return setProblem("Enter a quantity.");
        if (next < 0) return setProblem(`Only ${qty(current)} ${item.unit} in stock.`);
        if (next === round2(current)) return setProblem("That doesn't change the stock.");

        setSaving(true);
        setProblem("");
        try {
            await moveStock(item.id, { movement_type: type, quantity: q, note: note.trim() });
            onSaved();
        } catch (err) {
            setProblem(err.response?.data?.message || err.friendlyMessage || "Could not update the stock.");
            setSaving(false);
        }
    };

    return (
        <div className="sl-overlay" onClick={() => !saving && onClose()}>
            <form className="sl-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>

                <div className="sl-modal-head">
                    <div>
                        <h3>Update Stock</h3>
                        <p>{item.item_name}</p>
                    </div>
                    <button type="button" className="sl-modal-x" onClick={onClose} disabled={saving} aria-label="Close">✕</button>
                </div>

                <div className="sl-modal-body">
                    {problem && <div className="sl-error">{problem}</div>}

                    <div className="sl-seg" role="tablist" style={{ marginBottom: 12 }}>
                        {Object.entries(MOVE_TYPES).map(([key, t]) => (
                            <button
                                key={key}
                                type="button"
                                role="tab"
                                aria-selected={type === key}
                                className={type === key ? "active" : ""}
                                onClick={() => { setType(key); setProblem(""); }}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                    <p className="sl-hint" style={{ margin: "0 0 14px" }}>{MOVE_TYPES[type].hint}</p>

                    <div className="sl-form">
                        <div className="sl-field">
                            <label htmlFor="stk-qty">{MOVE_TYPES[type].field} ({item.unit})</label>
                            <input
                                id="stk-qty"
                                type="number"
                                min="0"
                                step="0.01"
                                inputMode="decimal"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div className="sl-field">
                            <label htmlFor="stk-note">Note</label>
                            <input
                                id="stk-note"
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                maxLength={255}
                                placeholder={type === "In" ? "e.g. Supplier invoice #" : type === "Out" ? "e.g. Used this week" : "e.g. Monthly count"}
                            />
                        </div>
                    </div>

                    <div className="sl-tiles" style={{ marginTop: 16, marginBottom: 0 }}>
                        <div className="sl-tile"><span>In stock now</span><strong>{qty(current)} {item.unit}</strong></div>
                        <div className="sl-tile">
                            <span>After this</span>
                            <strong style={{ color: next !== null && next < 0 ? "#B91C1C" : undefined }}>
                                {next === null ? "—" : `${qty(next)} ${item.unit}`}
                            </strong>
                        </div>
                    </div>
                </div>

                <div className="sl-modal-foot">
                    <button type="button" className="sl-btn sl-btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
                    <button type="submit" className="sl-btn sl-btn-primary" disabled={saving}>
                        {saving ? "Saving…" : `Save ${MOVE_TYPES[type].label}`}
                    </button>
                </div>

            </form>
        </div>
    );
}

function MovementTable({ rows, showItem }) {
    const columns = showItem ? 7 : 6;
    return (
        <div className="sl-table-wrap">
            <table className="sl-table">
                <thead>
                    <tr>
                        <th>When</th>
                        {showItem && <th>Item</th>}
                        <th>Type</th>
                        <th className="num">Change</th>
                        <th className="num">Stock after</th>
                        <th>Note</th>
                        <th>By</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.length === 0 ? (
                        <tr><td colSpan={columns} className="sl-empty">No stock movements yet.</td></tr>
                    ) : rows.map((m) => {
                        const change = Number(m.quantity);
                        const t = MOVE_TYPES[m.movement_type] || { label: m.movement_type, badge: "sl-badge-muted" };
                        return (
                            <tr key={m.id}>
                                <td>{fmtDateTime(m.created_at)}</td>
                                {showItem && <td className="sl-name">{m.item_name}</td>}
                                <td><span className={`sl-badge ${t.badge}`}>{t.label}</span></td>
                                <td className={`num ${change >= 0 ? "sl-pos-change" : "sl-neg-change"}`}>
                                    {change >= 0 ? "+" : "−"}{qty(Math.abs(change))} {m.unit}
                                </td>
                                <td className="num">{qty(m.balance_after)} {m.unit}</td>
                                <td>{m.note || "—"}</td>
                                <td>{m.created_by_name || "—"}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

function HistoryModal({ item, onClose }) {

    useEscapeClose(onClose);

    const [rows, setRows] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        let live = true;
        getStockMovements(item.id)
            .then((res) => { if (live) setRows(res.data.data || []); })
            .catch((err) => { if (live) setError(err.response?.data?.message || err.friendlyMessage || "Could not load the history."); });
        return () => { live = false; };
    }, [item.id]);

    return (
        <div className="sl-overlay" onClick={onClose}>
            <div className="sl-modal sl-modal-wide" onClick={(e) => e.stopPropagation()}>
                <div className="sl-modal-head">
                    <div>
                        <h3>Stock History</h3>
                        <p>{item.item_name} · {qty(item.quantity)} {item.unit} in stock</p>
                    </div>
                    <button type="button" className="sl-modal-x" onClick={onClose} aria-label="Close">✕</button>
                </div>
                <div className="sl-modal-body">
                    {error ? <div className="sl-error">{error}</div>
                        : rows === null ? <p className="sl-hint">Loading…</p>
                        : <div className="sl-card" style={{ boxShadow: "none", border: "1px solid #E5E7EB" }}><MovementTable rows={rows} /></div>}
                </div>
                <div className="sl-modal-foot">
                    <button type="button" className="sl-btn sl-btn-ghost" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
}

function Inventory() {

    const [items, setItems] = useState([]);
    const [summary, setSummary] = useState({});
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);

    const [tab, setTab] = useState("stock");
    const [movements, setMovements] = useState(null);

    const [search, setSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("");
    const [stateFilter, setStateFilter] = useState("");

    // Which modal is open: { kind: "item" | "stock" | "history", item }.
    const [modal, setModal] = useState(null);

    // The salon's own categories (created in Categories) — items are filed under
    // these, so they read the same everywhere.
    const [salonCats, setSalonCats] = useState([]);

    const load = useCallback(async () => {
        try {
            const [itemsRes, summaryRes, catsRes] = await Promise.all([
                getInventory(), getInventorySummary(), categoryService.getCategories()
            ]);
            setItems(itemsRes.data.data || []);
            setSummary(summaryRes.data.data || {});
            const cats = catsRes.data?.data || catsRes.data || [];
            setSalonCats(cats.filter((c) => c && c.category_name));
            setLoadError(false);
        } catch (err) {
            console.error("Inventory load error:", err);
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    }, []);

    const loadMovements = useCallback(async () => {
        try {
            const res = await getStockMovements();
            setMovements(res.data.data || []);
        } catch (err) {
            console.error("Stock movements load error:", err);
            setMovements([]);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (tab === "log") loadMovements();
    }, [tab, loadMovements]);

    // Category NAMES for the filter/list: the salon's own categories plus any
    // category already saved on a stock item that isn't in that list.
    const salonCatNames = useMemo(() => salonCats.map((c) => c.category_name), [salonCats]);
    const categories = useMemo(
        () => [
            ...salonCatNames,
            ...[...new Set(items.map((i) => i.category).filter(Boolean))]
                .filter((c) => !salonCatNames.includes(c))
                .sort((a, b) => a.localeCompare(b))
        ],
        [items, salonCatNames]
    );

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        return items.filter((i) => {
            if (categoryFilter && i.category !== categoryFilter) return false;
            const state = stockState(i).label;
            if (stateFilter === "low" && state !== "Low stock") return false;
            if (stateFilter === "out" && state !== "Out of stock") return false;
            if (stateFilter === "inactive" && state !== "Inactive") return false;
            if (!term) return true;
            return [i.item_name, i.sku, i.category].some((v) => String(v || "").toLowerCase().includes(term));
        });
    }, [items, search, categoryFilter, stateFilter]);

    const afterChange = () => {
        setModal(null);
        load();
        if (tab === "log") loadMovements();
    };

    const remove = async (item) => {
        if (!window.confirm(`Remove "${item.item_name}" from inventory?`)) return;
        try {
            await deleteInventoryItem(item.id);
            afterChange();
        } catch (err) {
            alert(err.response?.data?.message || err.friendlyMessage || "Could not remove the item.");
        }
    };

    return (
        <AdminLayout>
            <div className="dashboard-content sl-page">

                <div className="sl-head">
                    <div>
                        <h2>Inventory</h2>
                        <p>Products you keep in stock, and every time that stock changes.</p>
                    </div>
                    <div className="sl-head-actions">
                        <button className="sl-btn sl-btn-primary" onClick={() => setModal({ kind: "item", item: null })}>
                            + Add Item
                        </button>
                    </div>
                </div>

                <div className="sl-stats">
                    <div className="sl-stat" style={{ "--accent": "#2563EB" }}>
                        <span>Items</span><strong>{summary.total_items || 0}</strong>
                    </div>
                    <div className="sl-stat" style={{ "--accent": "#F59E0B" }}>
                        <span>Low stock</span><strong>{summary.low_stock || 0}</strong>
                    </div>
                    <div className="sl-stat" style={{ "--accent": "#DC2626" }}>
                        <span>Out of stock</span><strong>{summary.out_of_stock || 0}</strong>
                    </div>
                    <div className="sl-stat" style={{ "--accent": "#16A34A" }}>
                        <span>Stock value (at cost)</span><strong>{money(summary.stock_value)}</strong>
                    </div>
                </div>

                <div className="sl-seg" role="tablist" style={{ alignSelf: "flex-start" }}>
                    <button type="button" role="tab" aria-selected={tab === "stock"} className={tab === "stock" ? "active" : ""} onClick={() => setTab("stock")}>
                        Stock
                    </button>
                    <button type="button" role="tab" aria-selected={tab === "log"} className={tab === "log" ? "active" : ""} onClick={() => setTab("log")}>
                        Movement log
                    </button>
                </div>

                {tab === "stock" ? (
                    <>
                        <div className="sl-toolbar">
                            <input
                                className="sl-search"
                                type="search"
                                placeholder="Search item, code or category…"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                aria-label="Search inventory"
                            />
                            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} aria-label="Category">
                                <option value="">All categories</option>
                                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} aria-label="Stock level">
                                <option value="">All stock levels</option>
                                <option value="low">Low stock</option>
                                <option value="out">Out of stock</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>

                        <div className="sl-card">
                            <div className="sl-table-wrap">
                                <table className="sl-table">
                                    <thead>
                                        <tr>
                                            <th>Item</th>
                                            <th>Category</th>
                                            <th className="num">In stock</th>
                                            <th className="num">Reorder at</th>
                                            <th className="num">Cost</th>
                                            <th className="num">Value</th>
                                            <th>Status</th>
                                            <th className="num">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading ? (
                                            <tr><td colSpan={8} className="sl-empty">Loading inventory…</td></tr>
                                        ) : loadError ? (
                                            <tr>
                                                <td colSpan={8} className="sl-empty">
                                                    <p>Could not load inventory.</p>
                                                    <button className="sl-btn sl-btn-ghost" onClick={load}>Retry</button>
                                                </td>
                                            </tr>
                                        ) : filtered.length === 0 ? (
                                            <tr>
                                                <td colSpan={8} className="sl-empty">
                                                    {items.length === 0
                                                        ? "Nothing in inventory yet. Add the products you keep in stock."
                                                        : "No item matches these filters."}
                                                </td>
                                            </tr>
                                        ) : filtered.map((i) => {
                                            const state = stockState(i);
                                            return (
                                                <tr key={i.id}>
                                                    <td>
                                                        <span className="sl-name">{i.item_name}</span>
                                                        {i.sku && <span className="sl-sub">{i.sku}</span>}
                                                    </td>
                                                    <td>{i.category || "—"}</td>
                                                    <td className="num">{qty(i.quantity)} {i.unit}</td>
                                                    <td className="num">{qty(i.min_quantity)} {i.unit}</td>
                                                    <td className="num">{money(i.cost_price)}</td>
                                                    <td className="num">{money(Number(i.quantity) * Number(i.cost_price))}</td>
                                                    <td><span className={`sl-badge ${state.cls}`}>{state.label}</span></td>
                                                    <td>
                                                        <div className="sl-actions">
                                                            <button className="sl-btn sl-btn-primary sl-btn-sm" onClick={() => setModal({ kind: "stock", item: i })}>Update Stock</button>
                                                            <button className="sl-btn sl-btn-ghost sl-btn-sm" onClick={() => setModal({ kind: "history", item: i })}>History</button>
                                                            <button className="sl-btn sl-btn-ghost sl-btn-sm" onClick={() => setModal({ kind: "item", item: i })}>Edit</button>
                                                            <button className="sl-btn sl-btn-danger sl-btn-sm" onClick={() => remove(i)}>Delete</button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="sl-card">
                        {movements === null
                            ? <div className="sl-empty">Loading movements…</div>
                            : <MovementTable rows={movements} showItem />}
                    </div>
                )}

            </div>

            {modal?.kind === "item" && (
                <ItemModal item={modal.item} categories={categories} salonCats={salonCats} onClose={() => setModal(null)} onSaved={afterChange} />
            )}
            {modal?.kind === "stock" && (
                <StockModal item={modal.item} onClose={() => setModal(null)} onSaved={afterChange} />
            )}
            {modal?.kind === "history" && (
                <HistoryModal item={modal.item} onClose={() => setModal(null)} />
            )}
        </AdminLayout>
    );
}

export default Inventory;
