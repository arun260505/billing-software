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

    // ── Data ────────────────────────────────────────────────────────
    const [orders, setOrders] = useState([]);
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);

    // ── Filters ─────────────────────────────────────────────────────
    const [search, setSearch] = useState("");
    const [date, setDate] = useState("");
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
    }, [search, date, orderType, paymentFilter, activeTab]);

    // ── Summary counts (real data, never hardcoded) ─────────────────
    const summary = useMemo(() => {
        const byStatus = orders.reduce((acc, o) => {
            acc[o.order_status] = (acc[o.order_status] || 0) + 1;
            return acc;
        }, {});
        return {
            total: orders.length,
            new: byStatus.Pending || 0,
            preparing: byStatus.Preparing || 0,
            ready: byStatus.Ready || 0,
            completed: byStatus.Completed || 0,
            cancelled: byStatus.Cancelled || 0
        };
    }, [orders]);

    // ── Combined filtering (search + date + type + payment + status) ─
    const filtered = useMemo(() => {

        const term = search.trim().toLowerCase().replace(/^#/, "");

        return orders.filter((o) => {

            if (activeTab !== "all" && o.order_status !== activeTab) return false;

            if (date && String(o.created_at).slice(0, 10) !== date) return false;

            if (orderType && o.order_type !== orderType) return false;

            if (paymentFilter && o.payment_status !== paymentFilter) return false;

            if (term) {
                const matchesId = String(o.id).includes(term);
                const matchesNumber = String(o.order_number || "").toLowerCase().includes(term);
                if (!matchesId && !matchesNumber) return false;
            }

            return true;

        });

    }, [orders, search, date, orderType, paymentFilter, activeTab]);

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

    const summaryCards = [
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
                        <h2>Orders</h2>
                        <p>Manage and monitor all restaurant orders</p>
                    </div>
                    <button className="orders-new-btn" onClick={() => navigate("/cashier")}>
                        + New Order
                    </button>
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
                    {STATUS_TABS.map((tab) => {
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
                            placeholder="Search Order ID"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <input
                        type="date"
                        className="orders-date-input"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        title="Filter by order date"
                    />

                    <select value={orderType} onChange={(e) => setOrderType(e.target.value)} title="Order Type">
                        <option value="">Order Type: All</option>
                        <option value="Dine-In">🍽 Dine-in</option>
                        <option value="Takeaway">📦 Takeaway</option>
                        <option value="Delivery">🛵 Delivery</option>
                    </select>

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
                        {STATUS_TABS.filter((t) => t.key !== "all").map((tab) => (
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
                                <th>Order ID</th>
                                <th>Time</th>
                                <th>Table</th>
                                <th>Staff</th>
                                <th>Type</th>
                                <th>Amount</th>
                                <th>Payment</th>
                                <th>Status</th>
                                <th className="orders-actions-col">Actions</th>
                            </tr>
                        </thead>
                        <tbody>

                            {loading ? (
                                <tr>
                                    <td colSpan={9} className="orders-empty">Loading orders…</td>
                                </tr>
                            ) : loadError ? (
                                <tr>
                                    <td colSpan={9} className="orders-empty">
                                        Could not load orders.
                                        <button className="orders-retry" onClick={() => load(true)}>Retry</button>
                                    </td>
                                </tr>
                            ) : pageRows.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="orders-empty">No orders match your filters.</td>
                                </tr>
                            ) : (
                                pageRows.map((order) => {

                                    const meta = typeMeta(order.order_type);
                                    const canServe = ["Pending", "Preparing", "Ready"].includes(order.order_status);
                                    const canCancel = !["Completed", "Cancelled"].includes(order.order_status);

                                    return (
                                        <tr key={order.id} className={menuOrderId === order.id ? "menu-open" : ""}>
                                            <td>
                                                <span className="orders-id" title={order.order_number}>
                                                    #{order.id}
                                                </span>
                                            </td>
                                            <td title={new Date(order.created_at).toLocaleString()}>
                                                {timeOf(order.created_at)}
                                            </td>
                                            <td>{order.table_name || "—"}</td>
                                            <td>{order.employee_name || "—"}</td>
                                            <td>
                                                <span className="orders-type">
                                                    <span className="orders-type-icon">{meta.icon}</span>
                                                    {meta.label}
                                                </span>
                                            </td>
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

                                                    <button
                                                        className="action-btn edit"
                                                        title="Edit order"
                                                        onClick={() => { setMenuOrderId(null); setEditOrder(order); }}
                                                    >
                                                        <FaPen />
                                                    </button>

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
                                                                            Cancel Order
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
