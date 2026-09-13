import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import AdminLayout from "../../layouts/AdminLayout";
import menuService from "../../services/menuService";
import useEscapeClose from "../../hooks/useEscapeClose";

import "../../styles/Admin/Dashboard.css";
import "../../styles/pages/Salon/Salon.css";

const money = (v) =>
    `₹${Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/*
| A salon's services are menu_items underneath — the same rows a restaurant's
| menu uses — so the counter, bills, reports and till sync all work unchanged.
| The restaurant-only columns (food type, kitchen section, prep time, specials)
| stay at their defaults and are never shown here.
*/

function ServiceModal({ service, categories, onClose, onSaved }) {

    const [saving, setSaving] = useState(false);
    useEscapeClose(onClose, !saving);

    const isEdit = Boolean(service);

    const [form, setForm] = useState(() => ({
        item_name: service?.item_name || "",
        category_id: String(service?.category_id || categories[0]?.id || ""),
        price: service ? String(Number(service.price)) : "",
        description: service?.description || "",
        available: service ? Boolean(Number(service.available)) : true
    }));
    const [problem, setProblem] = useState("");

    const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

    const submit = async (e) => {
        e.preventDefault();

        const name = form.item_name.trim();
        const price = Number(form.price);
        if (!name) return setProblem("Service name is required.");
        if (!form.category_id) return setProblem("Choose a category.");
        if (form.price === "" || !Number.isFinite(price) || price < 0) return setProblem("Enter a valid price.");

        // An update replaces the whole row, so start from what is stored and
        // change only the fields this form owns.
        const payload = {
            is_today_special: 0,
            is_best_seller: 0,
            is_new_item: 0,
            is_seasonal: 0,
            display_order: 0,
            ...(service || {}),
            item_name: name,
            category_id: Number(form.category_id),
            price,
            description: form.description.trim(),
            available: form.available ? 1 : 0
        };

        setSaving(true);
        setProblem("");
        try {
            if (isEdit) await menuService.updateMenuItem(service.id, payload);
            else await menuService.addMenuItem(payload);
            onSaved();
        } catch (err) {
            setProblem(err.response?.data?.message || err.friendlyMessage || "Could not save the service.");
            setSaving(false);
        }
    };

    return (
        <div className="sl-overlay" onClick={() => !saving && onClose()}>
            <form className="sl-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>

                <div className="sl-modal-head">
                    <h3>{isEdit ? "Edit Service" : "Add Service"}</h3>
                    <button type="button" className="sl-modal-x" onClick={onClose} disabled={saving} aria-label="Close">✕</button>
                </div>

                <div className="sl-modal-body">
                    {problem && <div className="sl-error">{problem}</div>}

                    <div className="sl-form">
                        <div className="sl-field sl-field-full">
                            <label htmlFor="svc-name">Service name *</label>
                            <input
                                id="svc-name"
                                value={form.item_name}
                                onChange={set("item_name")}
                                placeholder="e.g. Haircut & Styling"
                                maxLength={150}
                                autoFocus
                            />
                        </div>

                        <div className="sl-field">
                            <label htmlFor="svc-cat">Category *</label>
                            <select id="svc-cat" value={form.category_id} onChange={set("category_id")}>
                                {categories.length === 0 && <option value="">No categories yet</option>}
                                {categories.map((c) => (
                                    <option key={c.id} value={c.id}>{c.category_name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="sl-field">
                            <label htmlFor="svc-price">Price (₹) *</label>
                            <input
                                id="svc-price"
                                type="number"
                                min="0"
                                step="0.01"
                                inputMode="decimal"
                                value={form.price}
                                onChange={set("price")}
                                placeholder="0.00"
                            />
                        </div>

                        <div className="sl-field sl-field-full">
                            <label htmlFor="svc-desc">Description</label>
                            <textarea
                                id="svc-desc"
                                rows={2}
                                value={form.description}
                                onChange={set("description")}
                                placeholder="Shown under the service name at the counter"
                            />
                        </div>

                        <div className="sl-field sl-field-full">
                            <label htmlFor="svc-status">Status</label>
                            <select
                                id="svc-status"
                                value={form.available ? "1" : "0"}
                                onChange={(e) => setForm((f) => ({ ...f, available: e.target.value === "1" }))}
                            >
                                <option value="1">Available — can be billed</option>
                                <option value="0">Unavailable — can't be billed right now</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="sl-modal-foot">
                    <button type="button" className="sl-btn sl-btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
                    <button type="submit" className="sl-btn sl-btn-primary" disabled={saving}>
                        {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Service"}
                    </button>
                </div>

            </form>
        </div>
    );
}

function Services() {

    const [services, setServices] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);

    const [search, setSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");

    // null = closed, { service: null } = adding, { service } = editing.
    const [modal, setModal] = useState(null);

    const load = useCallback(async () => {
        try {
            const [itemsRes, activeCategories] = await Promise.all([
                menuService.getMenuItems(),
                menuService.getCategories()
            ]);
            setServices(itemsRes.data || []);
            setCategories(activeCategories || []);
            setLoadError(false);
        } catch (err) {
            console.error("Services load error:", err);
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        return services.filter((s) => {
            if (categoryFilter && String(s.category_id) !== categoryFilter) return false;
            if (statusFilter === "available" && !Number(s.available)) return false;
            if (statusFilter === "unavailable" && Number(s.available)) return false;
            if (!term) return true;
            return [s.item_name, s.category_name, s.description]
                .some((v) => String(v || "").toLowerCase().includes(term));
        });
    }, [services, search, categoryFilter, statusFilter]);

    const availableCount = services.filter((s) => Number(s.available)).length;
    const averagePrice = services.length
        ? services.reduce((sum, s) => sum + Number(s.price || 0), 0) / services.length
        : 0;

    // Flip it on screen straight away and put it back if the save fails.
    const toggleAvailability = async (service) => {
        const next = Number(service.available) ? 0 : 1;
        const patch = (value) =>
            setServices((prev) => prev.map((s) => (s.id === service.id ? { ...s, available: value } : s)));

        patch(next);
        try {
            await menuService.setAvailability(service.id, next);
        } catch (err) {
            patch(service.available);
            alert(err.response?.data?.message || err.friendlyMessage || "Could not change availability.");
        }
    };

    const remove = async (service) => {
        if (!window.confirm(`Delete "${service.item_name}"?\n\nPast bills keep it on record.`)) return;
        try {
            await menuService.deleteMenuItem(service.id);
            load();
        } catch (err) {
            alert(err.response?.data?.message || err.friendlyMessage || "Could not delete the service.");
        }
    };

    return (
        <AdminLayout>
            <div className="dashboard-content sl-page">

                <div className="sl-head">
                    <div>
                        <h2>Services</h2>
                        <p>What your salon offers and what each service costs.</p>
                    </div>
                    <div className="sl-head-actions">
                        <button
                            className="sl-btn sl-btn-primary"
                            onClick={() => setModal({ service: null })}
                            disabled={categories.length === 0}
                            title={categories.length === 0 ? "Add a category first" : undefined}
                        >
                            + Add Service
                        </button>
                    </div>
                </div>

                <div className="sl-stats">
                    <div className="sl-stat" style={{ "--accent": "#2563EB" }}>
                        <span>Total services</span><strong>{services.length}</strong>
                    </div>
                    <div className="sl-stat" style={{ "--accent": "#16A34A" }}>
                        <span>Available</span><strong>{availableCount}</strong>
                    </div>
                    <div className="sl-stat" style={{ "--accent": "#8B5CF6" }}>
                        <span>Categories</span><strong>{categories.length}</strong>
                    </div>
                    <div className="sl-stat" style={{ "--accent": "#F59E0B" }}>
                        <span>Average price</span><strong>{money(averagePrice)}</strong>
                    </div>
                </div>

                {!loading && !loadError && categories.length === 0 && (
                    <div className="sl-card">
                        <div className="sl-empty">
                            <h3>Add a category first</h3>
                            <p>Services are grouped by category — Hair, Skin, Nails, Spa.</p>
                            <Link className="sl-btn sl-btn-primary" to="/admin/categories">Go to Categories</Link>
                        </div>
                    </div>
                )}

                <div className="sl-toolbar">
                    <input
                        className="sl-search"
                        type="search"
                        placeholder="Search services…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        aria-label="Search services"
                    />
                    <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} aria-label="Category">
                        <option value="">All categories</option>
                        {categories.map((c) => (
                            <option key={c.id} value={String(c.id)}>{c.category_name}</option>
                        ))}
                    </select>
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Status">
                        <option value="">All status</option>
                        <option value="available">Available</option>
                        <option value="unavailable">Unavailable</option>
                    </select>
                </div>

                <div className="sl-card">
                    <div className="sl-table-wrap">
                        <table className="sl-table">
                            <thead>
                                <tr>
                                    <th>Service</th>
                                    <th>Category</th>
                                    <th className="num">Price</th>
                                    <th>Status</th>
                                    <th className="num">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={5} className="sl-empty">Loading services…</td></tr>
                                ) : loadError ? (
                                    <tr>
                                        <td colSpan={5} className="sl-empty">
                                            <p>Could not load services.</p>
                                            <button className="sl-btn sl-btn-ghost" onClick={load}>Retry</button>
                                        </td>
                                    </tr>
                                ) : filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="sl-empty">
                                            {services.length === 0
                                                ? "No services yet. Add your first one."
                                                : "No service matches these filters."}
                                        </td>
                                    </tr>
                                ) : (
                                    filtered.map((s) => {
                                        const on = Boolean(Number(s.available));
                                        return (
                                            <tr key={s.id}>
                                                <td>
                                                    <span className="sl-name">{s.item_name}</span>
                                                    {s.description && <span className="sl-sub">{s.description}</span>}
                                                </td>
                                                <td>{s.category_name || "—"}</td>
                                                <td className="num">{money(s.price)}</td>
                                                <td>
                                                    <button
                                                        type="button"
                                                        className={`sl-badge ${on ? "sl-badge-ok" : "sl-badge-muted"}`}
                                                        onClick={() => toggleAvailability(s)}
                                                        title={on ? "Click to mark unavailable" : "Click to mark available"}
                                                    >
                                                        {on ? "Available" : "Unavailable"}
                                                    </button>
                                                </td>
                                                <td>
                                                    <div className="sl-actions">
                                                        <button className="sl-btn sl-btn-ghost sl-btn-sm" onClick={() => setModal({ service: s })}>Edit</button>
                                                        <button className="sl-btn sl-btn-danger sl-btn-sm" onClick={() => remove(s)}>Delete</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>

            {modal && (
                <ServiceModal
                    service={modal.service}
                    categories={categories}
                    onClose={() => setModal(null)}
                    onSaved={() => { setModal(null); load(); }}
                />
            )}
        </AdminLayout>
    );
}

export default Services;
