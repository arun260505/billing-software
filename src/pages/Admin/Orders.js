import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    FaEye,
    FaPen,
    FaEllipsisV,
    FaSyncAlt,
    FaCheckCircle,
    FaTimesCircle,
    FaClipboardList,
    FaFireAlt,
    FaUtensils
} from "react-icons/fa";

import AdminLayout from "../../layouts/AdminLayout";
import OrderDetailsModal from "../../components/Admin/OrderDetailsModal";

import { getOrders, markOrderServed, cancelOrder } from "../../services/orderService";
import { getPayments } from "../../services/paymentService";
import { isSalon } from "../../utils/businessType";

import "../../styles/Admin/Dashboard.css";
import "../../styles/pages/Admin/Orders.css";

const PAGE_SIZE = 20;

// Tab key -> the order_status value it filters on. "New" maps to the DB's
// initial "Pending" status; "Confirmed" exists in the UI per design but no
// workflow writes it yet, so it shows an honest empty state.
const STATUS_TABS = [
    { key: "all", label: "All" },
    { key: "Pending", label: "New" },
    { key: "Confirmed", label: "Confirmed" },
    { key: "Preparing", label: "Preparing" },
    { key: "Ready", label: "Ready" },
    { key: "Served", label: "Served" },
    { key: "Completed", label: "Completed" },
    { key: "Cancelled", label: "Cancelled" }
];

const STATUS_LABELS = {
    Pending: "New",
    Preparing: "Preparing",
    Ready: "Ready",
    Served: "Served",
    Completed: "Completed",
    Cancelled: "Cancelled",
    Confirmed: "Confirmed"
};

const ORDER_TYPES = [
    { value: "", label: "All Types", icon: "" },
    { value: "Dine-In", label: "Dine-in", icon: "🍽" },
    { value: "Takeaway", label: "Takeaway", icon: "📦" },
    { value: "Delivery", label: "Delivery", icon: "🛵" }
];

const PAYMENT_OPTIONS = ["Paid", "Pending", "Partial", "Refunded"];

const money = (v) =>
    `₹${Number(v || 0).toLocaleString("en-IN")}`;

const timeOf = (value) =>
    new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function Orders() {

    const navigate = useNavigate();

    // A salon's orders are its bills: no tables, no kitchen stages, no service
    // types. Unpaid / Completed / Cancelled is the whole lifecycle, and the
    // customer is what identifies a bill.
    const salon = isSalon();
    const statusTabs = salon
        ? STATUS_TABS
            .filter((t) => ["all", "Pending", "Completed", "Cancelled"].includes(t.key))
            .map((t) => (t.key === "Pending" ? { ...t, label: "Unpaid" } : t))
        : STATUS_TABS;
    const columnCount = salon ? 8 : 9;

    // ── Data ────────────────────────────────────────────────────────
    const [orders, setOrders] = useState([]);
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);

    // ── Filters ─────────────────────────────────────────────────────
    const [search, setSearch] = useState("");
    // Period preset: today | week | month | range | all. Defaults to today so the
    // page opens on the current day's bills rather than the whole history.
    const [period, setPeriod] = useState("today");
    const [rangeFrom, setRangeFrom] = useState("");
    const [rangeTo, setRangeTo] = useState("");
    const [orderType, setOrderType] = useState("");
    const [paymentFilter, setPaymentFilter] = useState("");
    const [activeTab, setActiveTab] = useState("all");

    // ── Pagination + modals + row menu ──────────────────────────────
    const [page, setPage] = useState(1);
    const [viewOrder, setViewOrder] = useState(null);
    const [editOrder, setEditOrder] = useState(null);
    const [menuOrderId, setMenuOrderId] = useState(null);

    const load = useCallback(async (showSpinner = false) => {

        if (showSpinner) setLoading(true);

        try {

            const [ordersRes, paymentsRes] = await Promise.all([
                getOrders(),
                getPayments()
            ]);

            if (ordersRes.data.success) setOrders(ordersRes.data.data || []);
            if (paymentsRes.data.success) setPayments(paymentsRes.data.data || []);

            setLoadError(false);

        } catch (err) {
            console.error("Orders load error:", err);
            setLoadError(true);
        } finally {
            if (showSpinner) setLoading(false);
        }

    }, []);

    useEffect(() => {
        load(true);
        const t = setInterval(() => load(false), 20000);
        return () => clearInterval(t);
    }, [load]);

    // Close the row action menu when clicking anywhere else.
    useEffect(() => {
        if (menuOrderId === null) return;
        const close = () => setMenuOrderId(null);
        document.addEventListener("click", close);
        return () => document.removeEventListener("click", close);
    }, [menuOrderId]);

    // Any filter change brings the user back to the first page.
    useEffect(() => {
        setPage(1);
    }, [search, period, rangeFrom, rangeTo, orderType, paymentFilter, activeTab]);

    // ── Period window + shared filters (everything EXCEPT the status tab) ─
    // The summary cards AND the table both read from this list, so switching
    // Today / This Week / This Month changes the totals too — not just the rows.
    const scoped = useMemo(() => {

        const term = search.trim().toLowerCase().replace(/^#/, "");

        // Period window as a YYYY-MM-DD range on the order date (local).
        const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let from = "", to = "";
        if (period === "today") { from = to = ymd(today); }
        else if (period === "week") {
            const sun = new Date(today); sun.setDate(today.getDate() - today.getDay()); // Sunday..
            from = ymd(sun); to = ymd(today);
        }
        else if (period === "month") { from = ymd(new Date(now.getFullYear(), now.getMonth(), 1)); to = ymd(today); }
        else if (period === "range") { from = rangeFrom; to = rangeTo; }
        // "all" leaves from/to empty (no date filter).

        return orders.filter((o) => {

            const day = String(o.created_at).slice(0, 10);
            if (from && day < from) return false;
            if (to && day > to) return false;

            if (orderType && o.order_type !== orderType) return false;

            if (paymentFilter && o.payment_status !== paymentFilter) return false;

            if (term) {
                const matchesId = String(o.id).includes(term);
                const matchesNumber = String(o.order_number || "").toLowerCase().includes(term);
                const matchesCustomer =
                    String(o.customer_name || "").toLowerCase().includes(term) ||
                    String(o.customer_mobile || "").includes(term);
                if (!matchesId && !matchesNumber && !matchesCustomer) return false;
            }

            return true;

        });

    }, [orders, search, period, rangeFrom, rangeTo, orderType, paymentFilter]);

    // ── Summary counts for the selected period (real data, never hardcoded) ─
    const summary = useMemo(() => {
        const byStatus = scoped.reduce((acc, o) => {
            acc[o.order_status] = (acc[o.order_status] || 0) + 1;
            return acc;
        }, {});
        return {
            total: scoped.length,
            new: byStatus.Pending || 0,
            preparing: byStatus.Preparing || 0,
            ready: byStatus.Ready || 0,
            completed: byStatus.Completed || 0,
            cancelled: byStatus.Cancelled || 0
        };
    }, [scoped]);

    // ── The table: apply the status tab, then sort ─────────────────────
    const filtered = useMemo(() => {

        const rows = activeTab === "all"
            ? scoped
            : scoped.filter((o) => o.order_status === activeTab);

        // Active orders (still being prepared / unpaid) float to the top; within
        // each group, newest first — so the latest and the ones needing action
        // are always at the top.
        const rank = (s) => (["Pending", "Preparing", "Ready"].includes(s) ? 0 : 1);
        return [...rows].sort((a, b) => {
            const r = rank(a.order_status) - rank(b.order_status);
            if (r !== 0) return r;
            return new Date(b.created_at) - new Date(a.created_at);
        });

    }, [scoped, activeTab]);

    // ── Pagination ──────────────────────────────────────────────────
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * PAGE_SIZE;
    const pageRows = filtered.slice(start, start + PAGE_SIZE);

    const pageNumbers = useMemo(() => {
        const pages = [];
        const window = 2;
        for (let i = 1; i <= totalPages; i++) {
            if (
                i === 1 ||
                i === totalPages ||
                (i >= safePage - window && i <= safePage + window)
            ) {
                pages.push(i);
            } else if (pages[pages.length - 1] !== "…") {
                pages.push("…");
            }
        }
        return pages;
    }, [totalPages, safePage]);

    // ── Row actions (reuse existing endpoints only) ─────────────────
    const handleMarkServed = async (order) => {
        try {
            await markOrderServed(order.id);
            await load(false);
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.message || "Could not mark the order as served.");
        }
    };

    const handleCancelFromRow = async (order) => {
        if (!window.confirm(`Cancel order #${order.id}? This cannot be undone.`)) return;
        try {
            await cancelOrder(order.id);
            await load(false);
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.message || "Could not cancel the order.");
        }
    };

    const typeMeta = (value) =>
        ORDER_TYPES.find((t) => t.value === value) || { icon: "", label: value };

    const summaryCards = salon ? [
        { title: "Total Bills", value: summary.total, icon: <FaClipboardList />, color: "#2563EB", tab: "all" },
        { title: "Unpaid", value: summary.new, icon: <FaFireAlt />, color: "#F59E0B", tab: "Pending" },
        { title: "Completed", value: summary.completed, icon: <FaCheckCircle />, color: "#15803D", tab: "Completed" },
        { title: "Cancelled", value: summary.cancelled, icon: <FaTimesCircle />, color: "#EF4444", tab: "Cancelled" }
    ] : [
        { title: "Total Orders", value: summary.total, icon: <FaClipboardList />, color: "#2563EB", tab: "all" },
        { title: "New", value: summary.new, icon: <FaFireAlt />, color: "#3B82F6", tab: "Pending" },
        { title: "Preparing", value: summary.preparing, icon: <FaUtensils />, color: "#F59E0B", tab: "Preparing" },
        { title: "Ready", value: summary.ready, icon: <FaCheckCircle />, color: "#22C55E", tab: "Ready" },
        { title: "Completed", value: summary.completed, icon: <FaCheckCircle />, color: "#15803D", tab: "Completed" },
        { title: "Cancelled", value: summary.cancelled, icon: <FaTimesCircle />, color: "#EF4444", tab: "Cancelled" }
    ];

    return (

        <AdminLayout>

            <div className="dashboard-content orders-page">

                {/* Header */}
                <div className="orders-header">
                    <div>
                        <h2>{salon ? "Bills" : "Orders"}</h2>
                        <p>{salon ? "Every bill from the front desk" : "Manage and monitor all restaurant orders"}</p>
                    </div>
                    {/* Salon bills are rung up by the receptionist at the counter. */}
                    {!salon && (
                        <button className="orders-new-btn" onClick={() => navigate("/cashier")}>
                            + New Order
                        </button>
                    )}
                </div>

                {/* Summary cards */}
                <div className="orders-cards">
                    {summaryCards.map((card) => (
                        <button
                            key={card.title}
                            className={`orders-card${activeTab === card.tab ? " active" : ""}`}
                            style={{ "--card-accent": card.color }}
                            onClick={() => setActiveTab(card.tab)}
                        >
                            <span className="orders-card-icon" style={{ background: `${card.color}1A`, color: card.color }}>
                                {card.icon}
                            </span>
                            <span className="orders-card-title">{card.title}</span>
                            <span className="orders-card-value">{card.value}</span>
                        </button>
                    ))}
                </div>

                {/* Status tabs */}
                <div className="orders-tabs">
                    {statusTabs.map((tab) => {
                        const count =
                            tab.key === "all"
                                ? orders.length
                                : orders.filter((o) => o.order_status === tab.key).length;
                        return (
                            <button
                                key={tab.key}
                                className={`orders-tab${activeTab === tab.key ? " active" : ""}`}
                                onClick={() => setActiveTab(tab.key)}
                            >
                                {tab.label}
                                <span className="orders-tab-count">{count}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Filters */}
                <div className="orders-filters">
                    <div className="orders-search">
                        <span className="orders-search-icon">🔍</span>
                        <input
                            type="text"
                            placeholder={salon ? "Search bill, customer or mobile" : "Search Order ID"}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <select
                        className="orders-date-input"
                        value={period}
                        onChange={(e) => setPeriod(e.target.value)}
                        title="Period"
                    >
                        <option value="today">Today</option>
                        <option value="week">This Week</option>
                        <option value="month">This Month</option>
                        <option value="range">Date Range</option>
                        <option value="all">All Time</option>
                    </select>

                    {period === "range" && (
                        <>
                            <input
                                type="date"
                                className="orders-date-input"
                                value={rangeFrom}
                                max={rangeTo || undefined}
                                onChange={(e) => setRangeFrom(e.target.value)}
                                title="From date"
                            />
                            <input
                                type="date"
                                className="orders-date-input"
                                value={rangeTo}
                                min={rangeFrom || undefined}
                                onChange={(e) => setRangeTo(e.target.value)}
                                title="To date"
                            />
                        </>
                    )}

                    {!salon && (
                        <select value={orderType} onChange={(e) => setOrderType(e.target.value)} title="Order Type">
                            <option value="">Order Type: All</option>
                            <option value="Dine-In">🍽 Dine-in</option>
                            <option value="Takeaway">📦 Takeaway</option>
                            <option value="Delivery">🛵 Delivery</option>
                        </select>
                    )}

                    <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} title="Payment">
                        <option value="">Payment: All</option>
                        {PAYMENT_OPTIONS.map((p) => (
                            <option key={p} value={p}>{p}</option>
                        ))}
                    </select>

                    <select
                        value={activeTab === "all" ? "" : activeTab}
                        onChange={(e) => setActiveTab(e.target.value || "all")}
                        title="Status"
                    >
                        <option value="">Status: All</option>
                        {statusTabs.filter((t) => t.key !== "all").map((tab) => (
                            <option key={tab.key} value={tab.key}>{tab.label}</option>
                        ))}
                    </select>

                    <button className="orders-refresh" onClick={() => load(true)} title="Refresh">
                        <FaSyncAlt />
                    </button>
                </div>

                {/* Table */}
                <div className="orders-table-card">

                    <table className="orders-table">
                        <thead>
                            <tr>
                                <th>{salon ? "Bill" : "Order ID"}</th>
                                <th>Time</th>
                                <th>{salon ? "Customer" : "Table"}</th>
                                <th>{salon ? "Stylist" : "Staff"}</th>
                                {!salon && <th>Type</th>}
                                <th>Amount</th>
                                <th>Payment</th>
                                <th>Status</th>
                                <th className="orders-actions-col">Actions</th>
                            </tr>
                        </thead>
                        <tbody>

                            {loading ? (
                                <tr>
                                    <td colSpan={columnCount} className="orders-empty">Loading orders…</td>
                                </tr>
                            ) : loadError ? (
                                <tr>
                                    <td colSpan={columnCount} className="orders-empty">
                                        Could not load orders.
                                        <button className="orders-retry" onClick={() => load(true)}>Retry</button>
                                    </td>
                                </tr>
                            ) : pageRows.length === 0 ? (
                                <tr>
                                    <td colSpan={columnCount} className="orders-empty">No orders match your filters.</td>
                                </tr>
                            ) : (
                                pageRows.map((order) => {

                                    const meta = typeMeta(order.order_type);
                                    const canServe = !salon && ["Pending", "Preparing", "Ready"].includes(order.order_status);
                                    const canCancel = !["Completed", "Cancelled"].includes(order.order_status);

                                    return (
                                        <tr key={order.id} className={menuOrderId === order.id ? "menu-open" : ""}>
                                            <td>
                                                <span className="orders-id" title={`#${order.id}`}>
                                                    {order.order_number || `#${order.id}`}
                                                </span>
                                            </td>
                                            <td title={new Date(order.created_at).toLocaleString()}>
                                                {timeOf(order.created_at)}
                                            </td>
                                            <td>
                                                {salon
                                                    ? (order.customer_name || "Walk-in")
                                                    : (order.table_name || "—")}
                                            </td>
                                            <td>{(salon ? order.stylist_name : order.employee_name) || "—"}</td>
                                            {!salon && (
                                                <td>
                                                    <span className="orders-type">
                                                        <span className="orders-type-icon">{meta.icon}</span>
                                                        {meta.label}
                                                    </span>
                                                </td>
                                            )}
                                            <td className="orders-amount">{money(order.grand_total)}</td>
                                            <td>
                                                <span className={`pay-chip pay-${(order.payment_status || "").toLowerCase()}`}>
                                                    {order.payment_status}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`order-badge badge-${(order.order_status || "").toLowerCase()}`}>
                                                    {STATUS_LABELS[order.order_status] || order.order_status}
                                                </span>
                                            </td>
                                            <td className="orders-actions-col">
                                                <div className="orders-actions">

                                                    <button
                                                        className="action-btn view"
                                                        title="View order"
                                                        onClick={() => { setMenuOrderId(null); setViewOrder(order); }}
                                                    >
                                                        <FaEye />
                                                    </button>

                                                    {/* Editing changes kitchen status, which a salon
                                                        doesn't have; its bills are corrected from the
                                                        counter's Bills screen. */}
                                                    {!salon && (
                                                        <button
                                                            className="action-btn edit"
                                                            title="Edit order"
                                                            onClick={() => { setMenuOrderId(null); setEditOrder(order); }}
                                                        >
                                                            <FaPen />
                                                        </button>
                                                    )}

                                                    {(canServe || canCancel) && (
                                                        <div
                                                            className="orders-more"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <button
                                                                className="action-btn more"
                                                                title="More"
                                                                onClick={() =>
                                                                    setMenuOrderId(menuOrderId === order.id ? null : order.id)
                                                                }
                                                            >
                                                                <FaEllipsisV />
                                                            </button>

                                                            {menuOrderId === order.id && (
                                                                <div className="orders-menu">
                                                                    {canServe && (
                                                                        <button onClick={() => { setMenuOrderId(null); handleMarkServed(order); }}>
                                                                            Mark as Served
                                                                        </button>
                                                                    )}
                                                                    {canCancel && (
                                                                        <button
                                                                            className="danger"
                                                                            onClick={() => { setMenuOrderId(null); handleCancelFromRow(order); }}
                                                                        >
                                                                            {salon ? "Cancel Bill" : "Cancel Order"}
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                </div>
                                            </td>
                                        </tr>
                                    );

                                })
                            )}

                        </tbody>
                    </table>

                    {/* Pagination */}
                    {!loading && !loadError && filtered.length > 0 && (
                        <div className="orders-pagination">
                            <span className="orders-pagination-info">
                                Showing {start + 1}–{Math.min(start + PAGE_SIZE, filtered.length)} of {filtered.length}
                            </span>

                            <div className="orders-pagination-controls">
                                <button
                                    disabled={safePage === 1}
                                    onClick={() => setPage(safePage - 1)}
                                    title="Previous"
                                >
                                    ←
                                </button>

                                {pageNumbers.map((p, idx) =>
                                    p === "…" ? (
                                        <span key={`ellipsis-${idx}`} className="orders-pagination-ellipsis">…</span>
                                    ) : (
                                        <button
                                            key={p}
                                            className={safePage === p ? "active" : ""}
                                            onClick={() => setPage(p)}
                                        >
                                            {p}
                                        </button>
                                    )
                                )}

                                <button
                                    disabled={safePage === totalPages}
                                    onClick={() => setPage(safePage + 1)}
                                    title="Next"
                                >
                                    →
                                </button>
                            </div>
                        </div>
                    )}

                </div>

                {/* Modals — View / Edit reuse one details modal */}
                {viewOrder && (
                    <OrderDetailsModal
                        order={viewOrder}
                        payments={payments}
                        editable={false}
                        onClose={() => setViewOrder(null)}
                    />
                )}

                {editOrder && (
                    <OrderDetailsModal
                        order={editOrder}
                        payments={payments}
                        editable={true}
                        onClose={() => setEditOrder(null)}
                        onUpdated={() => load(false)}
                    />
                )}

            </div>

        </AdminLayout>

    );

}

export default Orders;
