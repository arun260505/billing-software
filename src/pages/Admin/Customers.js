import React, { useCallback, useEffect, useMemo, useState } from "react";

import AdminLayout from "../../layouts/AdminLayout";
import useEscapeClose from "../../hooks/useEscapeClose";
import {
    getCustomers,
    getCustomerHistory,
    createCustomer,
    updateCustomer,
    deleteCustomer
} from "../../services/customerService";
import { isSalon } from "../../utils/businessType";

import "../../styles/Admin/Dashboard.css";
import "../../styles/pages/Salon/Salon.css";

const PAGE_SIZE = 20;
const MOBILE_RE = /^[0-9]{10}$/;

const money = (v) =>
    `₹${Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (v) =>
    v ? new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const fmtDateTime = (v) =>
    v
        ? new Date(v).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
        : "—";

const pad = (n) => String(n).padStart(2, "0");

// A DATE column arrives as a timestamp; the date input wants the local day.
const toDateInput = (v) => {
    if (!v) return "";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "";
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const isThisMonth = (v) => {
    if (!v) return false;
    const d = new Date(v);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
};

const SORTS = [
    { key: "recent", label: "Recent visit" },
    { key: "spent", label: "Top spenders" },
    { key: "visits", label: "Most visits" },
    { key: "name", label: "Name (A–Z)" }
];

const SORTERS = {
    recent: (a, b) =>
        (new Date(b.last_visit || 0) - new Date(a.last_visit || 0)) ||
        String(a.customer_name).localeCompare(String(b.customer_name)),
    spent: (a, b) => Number(b.lifetime_spent) - Number(a.lifetime_spent),
    visits: (a, b) => Number(b.visit_count) - Number(a.visit_count),
    name: (a, b) => String(a.customer_name).localeCompare(String(b.customer_name))
};

function CustomerModal({ customer, onClose, onSaved }) {

    const [saving, setSaving] = useState(false);
    useEscapeClose(onClose, !saving);

    const isEdit = Boolean(customer);

    const [form, setForm] = useState(() => ({
        customer_name: customer?.customer_name || "",
        mobile: customer?.mobile || "",
        email: customer?.email || "",
        gender: customer?.gender || "",
        date_of_birth: toDateInput(customer?.date_of_birth),
        address: customer?.address || "",
        gst_number: customer?.gst_number || "",
        status: customer?.status || "Active"
    }));
    const [problem, setProblem] = useState("");

    const set = (field) => (e) => {
        // Digits only in the mobile box, stopped at the keyboard.
        const value = field === "mobile"
            ? e.target.value.replace(/[^0-9]/g, "").slice(0, 10)
            : e.target.value;
        setForm((f) => ({ ...f, [field]: value }));
    };

    const submit = async (e) => {
        e.preventDefault();

        if (!form.customer_name.trim()) return setProblem("Customer name is required.");
        if (!MOBILE_RE.test(form.mobile)) return setProblem("Mobile number must be exactly 10 digits.");

        setSaving(true);
        setProblem("");
        try {
            if (isEdit) await updateCustomer(customer.id, form);
            else await createCustomer(form);
            onSaved();
        } catch (err) {
            setProblem(err.response?.data?.message || err.friendlyMessage || "Could not save the customer.");
            setSaving(false);
        }
    };

    return (
        <div className="sl-overlay" onClick={() => !saving && onClose()}>
            <form className="sl-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>

                <div className="sl-modal-head">
                    <h3>{isEdit ? "Edit Customer" : "Add Customer"}</h3>
                    <button type="button" className="sl-modal-x" onClick={onClose} disabled={saving} aria-label="Close">✕</button>
                </div>

                <div className="sl-modal-body">
                    {problem && <div className="sl-error">{problem}</div>}

                    <div className="sl-form">
                        <div className="sl-field">
                            <label htmlFor="cust-name">Name *</label>
                            <input id="cust-name" value={form.customer_name} onChange={set("customer_name")} maxLength={150} autoFocus />
                        </div>
                        <div className="sl-field">
                            <label htmlFor="cust-mobile">Mobile *</label>
                            <input id="cust-mobile" type="tel" inputMode="numeric" value={form.mobile} onChange={set("mobile")} placeholder="10-digit mobile" />
                        </div>
                        <div className="sl-field">
                            <label htmlFor="cust-email">Email</label>
                            <input id="cust-email" type="email" value={form.email} onChange={set("email")} maxLength={100} />
                        </div>
                        <div className="sl-field">
                            <label htmlFor="cust-gender">Gender</label>
                            <select id="cust-gender" value={form.gender} onChange={set("gender")}>
                                <option value="">Not given</option>
                                <option value="Female">Female</option>
                                <option value="Male">Male</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        <div className="sl-field">
                            <label htmlFor="cust-dob">Birthday</label>
                            <input id="cust-dob" type="date" value={form.date_of_birth} onChange={set("date_of_birth")} />
                        </div>
                        <div className="sl-field">
                            <label htmlFor="cust-status">Status</label>
                            <select id="cust-status" value={form.status} onChange={set("status")}>
                                <option value="Active">Active</option>
                                <option value="Inactive">Inactive</option>
                            </select>
                        </div>
                        <div className="sl-field sl-field-full">
                            <label htmlFor="cust-address">Address</label>
                            <textarea id="cust-address" rows={2} value={form.address} onChange={set("address")} />
                        </div>
                        <div className="sl-field sl-field-full">
                            <label htmlFor="cust-gst">GST number</label>
                            <input id="cust-gst" value={form.gst_number} onChange={set("gst_number")} maxLength={30} placeholder="Only for business customers" />
                        </div>
                    </div>
                </div>

                <div className="sl-modal-foot">
                    <button type="button" className="sl-btn sl-btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
                    <button type="submit" className="sl-btn sl-btn-primary" disabled={saving}>
                        {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Customer"}
                    </button>
                </div>

            </form>
        </div>
    );
}

// One customer: who they are, what they've spent and every bill they've had.
function CustomerHistory({ customerId, onClose, onEdit }) {

    useEscapeClose(onClose);

    const salon = isSalon();
    const [data, setData] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        let live = true;
        getCustomerHistory(customerId)
            .then((res) => { if (live) setData(res.data.data); })
            .catch((err) => {
                if (live) setError(err.response?.data?.message || err.friendlyMessage || "Could not load this customer.");
            });
        return () => { live = false; };
    }, [customerId]);

    const c = data?.customer;
    const bills = data?.bills || [];
    const visits = Number(c?.visit_count || 0);
    const spent = Number(c?.lifetime_spent || 0);

    const statusBadge = (bill) =>
        bill.order_status === "Cancelled" ? <span className="sl-badge sl-badge-bad">Cancelled</span> :
        bill.order_status === "Completed" ? <span className="sl-badge sl-badge-ok">Paid</span> :
        <span className="sl-badge sl-badge-warn">Unpaid</span>;

    return (
        <div className="sl-overlay" onClick={onClose}>
            <div className="sl-modal sl-modal-wide" onClick={(e) => e.stopPropagation()}>

                <div className="sl-modal-head">
                    <div>
                        <h3>{c ? c.customer_name : "Customer"}</h3>
                        {c && <p>{c.mobile}{c.status === "Inactive" ? " · Inactive" : ""}</p>}
                    </div>
                    <button type="button" className="sl-modal-x" onClick={onClose} aria-label="Close">✕</button>
                </div>

                <div className="sl-modal-body">
                    {error ? (
                        <div className="sl-error">{error}</div>
                    ) : !data ? (
                        <p className="sl-hint">Loading…</p>
                    ) : (
                        <>
                            <div className="sl-tiles">
                                <div className="sl-tile"><span>Visits</span><strong>{visits}</strong></div>
                                <div className="sl-tile"><span>Total spent</span><strong>{money(spent)}</strong></div>
                                <div className="sl-tile"><span>Average bill</span><strong>{money(visits ? spent / visits : 0)}</strong></div>
                                <div className="sl-tile"><span>Last visit</span><strong>{fmtDate(c.last_visit)}</strong></div>
                                <div className="sl-tile"><span>Email</span><strong>{c.email || "—"}</strong></div>
                                <div className="sl-tile">
                                    <span>Birthday</span>
                                    <strong>
                                        {c.date_of_birth
                                            ? new Date(c.date_of_birth).toLocaleDateString("en-IN", { day: "2-digit", month: "long" })
                                            : "—"}
                                    </strong>
                                </div>
                                <div className="sl-tile"><span>Customer since</span><strong>{fmtDate(c.created_at)}</strong></div>
                                {c.address && <div className="sl-tile"><span>Address</span><strong>{c.address}</strong></div>}
                            </div>

                            <h4 className="sl-section-title">Bills</h4>

                            <div className="sl-card" style={{ boxShadow: "none", border: "1px solid #E5E7EB" }}>
                                <div className="sl-table-wrap">
                                    <table className="sl-table">
                                        <thead>
                                            <tr>
                                                <th>Bill No.</th>
                                                <th>Date</th>
                                                <th>{salon ? "Services" : "Items"}</th>
                                                <th>Paid via</th>
                                                <th>Status</th>
                                                <th className="num">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {bills.length === 0 ? (
                                                <tr><td colSpan={6} className="sl-empty">No bills yet.</td></tr>
                                            ) : bills.map((b) => (
                                                <tr key={b.id}>
                                                    <td className="sl-name">{b.order_number}</td>
                                                    <td>{fmtDateTime(b.created_at)}</td>
                                                    <td>
                                                        {b.items || "—"}
                                                        {(b.stylist_name || b.employee_name) && (
                                                            <span className="sl-sub">
                                                                {[
                                                                    b.stylist_name && `Stylist: ${b.stylist_name}`,
                                                                    b.employee_name && `Billed by ${b.employee_name}`
                                                                ].filter(Boolean).join(" · ")}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td>{b.payment_method || "—"}</td>
                                                    <td>{statusBadge(b)}</td>
                                                    <td className="num">{money(b.grand_total)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className="sl-modal-foot">
                    <button type="button" className="sl-btn sl-btn-ghost" onClick={onClose}>Close</button>
                    {c && <button type="button" className="sl-btn sl-btn-primary" onClick={() => onEdit(c)}>Edit Customer</button>}
                </div>

            </div>
        </div>
    );
}

function Customers() {

    const salon = isSalon();

    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);

    const [search, setSearch] = useState("");
    const [sort, setSort] = useState("recent");
    const [page, setPage] = useState(1);

    // null = closed, { customer: null } = adding, { customer } = editing.
    const [editing, setEditing] = useState(null);
    const [viewingId, setViewingId] = useState(null);

    const load = useCallback(async () => {
        try {
            const res = await getCustomers();
            setCustomers(res.data.data || []);
            setLoadError(false);
        } catch (err) {
            console.error("Customers load error:", err);
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    useEffect(() => { setPage(1); }, [search, sort]);

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        const list = customers.filter((c) =>
            !term ||
            [c.customer_name, c.mobile, c.email].some((v) => String(v || "").toLowerCase().includes(term))
        );
        return [...list].sort(SORTERS[sort]);
    }, [customers, search, sort]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

    const visitedThisMonth = customers.filter((c) => isThisMonth(c.last_visit)).length;
    const newThisMonth = customers.filter((c) => isThisMonth(c.created_at)).length;
    const totalRevenue = customers.reduce((s, c) => s + Number(c.lifetime_spent || 0), 0);

    const remove = async (customer) => {
        if (!window.confirm(`Remove ${customer.customer_name}?\n\nTheir past bills stay on record.`)) return;
        try {
            await deleteCustomer(customer.id);
            if (viewingId === customer.id) setViewingId(null);
            load();
        } catch (err) {
            alert(err.response?.data?.message || err.friendlyMessage || "Could not remove the customer.");
        }
    };

    const stop = (fn) => (e) => { e.stopPropagation(); fn(); };

    return (
        <AdminLayout>
            <div className="dashboard-content sl-page">

                <div className="sl-head">
                    <div>
                        <h2>Customers</h2>
                        <p>
                            {salon
                                ? "Everyone who has visited, what they've had done and what they've spent."
                                : "Everyone who has ordered, how often and what they've spent."}
                        </p>
                    </div>
                    <div className="sl-head-actions">
                        <button className="sl-btn sl-btn-primary" onClick={() => setEditing({ customer: null })}>
                            + Add Customer
                        </button>
                    </div>
                </div>

                <div className="sl-stats">
                    <div className="sl-stat" style={{ "--accent": "#2563EB" }}>
                        <span>Total customers</span><strong>{customers.length}</strong>
                    </div>
                    <div className="sl-stat" style={{ "--accent": "#16A34A" }}>
                        <span>Visited this month</span><strong>{visitedThisMonth}</strong>
                    </div>
                    <div className="sl-stat" style={{ "--accent": "#8B5CF6" }}>
                        <span>New this month</span><strong>{newThisMonth}</strong>
                    </div>
                    <div className="sl-stat" style={{ "--accent": "#F59E0B" }}>
                        <span>Total spent by customers</span><strong>{money(totalRevenue)}</strong>
                    </div>
                </div>

                <div className="sl-toolbar">
                    <input
                        className="sl-search"
                        type="search"
                        placeholder="Search name, mobile or email…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        aria-label="Search customers"
                    />
                    <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort by">
                        {SORTS.map((s) => <option key={s.key} value={s.key}>Sort: {s.label}</option>)}
                    </select>
                </div>

                <div className="sl-card">
                    <div className="sl-table-wrap">
                        <table className="sl-table">
                            <thead>
                                <tr>
                                    <th>Customer</th>
                                    <th>Mobile</th>
                                    <th className="num">Visits</th>
                                    <th className="num">Total spent</th>
                                    <th>Last visit</th>
                                    <th>Status</th>
                                    <th className="num">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={7} className="sl-empty">Loading customers…</td></tr>
                                ) : loadError ? (
                                    <tr>
                                        <td colSpan={7} className="sl-empty">
                                            <p>Could not load customers.</p>
                                            <button className="sl-btn sl-btn-ghost" onClick={load}>Retry</button>
                                        </td>
                                    </tr>
                                ) : pageRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="sl-empty">
                                            {customers.length === 0
                                                ? (salon
                                                    ? "No customers yet. They're added here, or at the counter when a bill carries a mobile number."
                                                    : "No customers yet.")
                                                : "No customer matches that search."}
                                        </td>
                                    </tr>
                                ) : pageRows.map((c) => (
                                    <tr key={c.id} className="sl-clickable" onClick={() => setViewingId(c.id)}>
                                        <td>
                                            <span className="sl-name">{c.customer_name}</span>
                                            {c.email && <span className="sl-sub">{c.email}</span>}
                                        </td>
                                        <td>{c.mobile}</td>
                                        <td className="num">{Number(c.visit_count || 0)}</td>
                                        <td className="num">{money(c.lifetime_spent)}</td>
                                        <td>{fmtDate(c.last_visit)}</td>
                                        <td>
                                            <span className={`sl-badge ${c.status === "Inactive" ? "sl-badge-muted" : "sl-badge-ok"}`}>
                                                {c.status || "Active"}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="sl-actions">
                                                <button className="sl-btn sl-btn-ghost sl-btn-sm" onClick={stop(() => setViewingId(c.id))}>View</button>
                                                <button className="sl-btn sl-btn-ghost sl-btn-sm" onClick={stop(() => setEditing({ customer: c }))}>Edit</button>
                                                <button className="sl-btn sl-btn-danger sl-btn-sm" onClick={stop(() => remove(c))}>Delete</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {!loading && !loadError && filtered.length > PAGE_SIZE && (
                        <div className="sl-pager">
                            <span>
                                Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
                            </span>
                            <div>
                                <button className="sl-btn sl-btn-ghost sl-btn-sm" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}>← Previous</button>
                                <button className="sl-btn sl-btn-ghost sl-btn-sm" disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)}>Next →</button>
                            </div>
                        </div>
                    )}
                </div>

            </div>

            {viewingId && (
                <CustomerHistory
                    customerId={viewingId}
                    onClose={() => setViewingId(null)}
                    onEdit={(customer) => { setViewingId(null); setEditing({ customer }); }}
                />
            )}

            {editing && (
                <CustomerModal
                    customer={editing.customer}
                    onClose={() => setEditing(null)}
                    onSaved={() => { setEditing(null); load(); }}
                />
            )}
        </AdminLayout>
    );
}

export default Customers;
