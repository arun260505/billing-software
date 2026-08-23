import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    PieChart,
    Pie,
    Cell
} from "recharts";
import {
    FaRupeeSign,
    FaShoppingBag,
    FaChartLine,
    FaMoneyBillWave,
    FaHourglassHalf,
    FaTags,
    FaPercentage,
    FaPlusCircle,
    FaCalendarAlt,
    FaChevronDown,
    FaFileExport,
    FaPrint,
    FaArrowUp,
    FaArrowDown,
    FaFire,
    FaCheckCircle,
    FaExclamationTriangle,
    FaTimesCircle,
    FaInfoCircle,
    FaInbox,
    FaSyncAlt
} from "react-icons/fa";

import AdminLayout from "../../layouts/AdminLayout";
import { getReportsOverview } from "../../services/reportService";

import "../../styles/pages/Admin/Reports.css";

/* ─────────────────────────── helpers ─────────────────────────── */

const pad = (n) => String(n).padStart(2, "0");

const toISO = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const addDays = (d, n) => {
    const c = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    c.setDate(c.getDate() + n);
    return c;
};

const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const compactNum = (v) => {
    const n = Number(v || 0);
    if (Math.abs(n) >= 100000) return `${(n / 100000).toFixed(1)}L`;
    if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return String(n);
};

const fmtDay = (iso) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short"
    });

const trendPct = (cur, prev) => {
    if (!prev || prev <= 0) return null;
    return ((cur - prev) / prev) * 100;
};

function getPresetRange(key) {
    const now = new Date();
    const t = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (key) {
        case "today":
            return { from: toISO(t), to: toISO(t) };
        case "yesterday": {
            const y = addDays(t, -1);
            return { from: toISO(y), to: toISO(y) };
        }
        case "this_week": {
            const mon = addDays(t, -((t.getDay() + 6) % 7));
            return { from: toISO(mon), to: toISO(t) };
        }
        case "last_week": {
            const mon = addDays(t, -((t.getDay() + 6) % 7) - 7);
            return { from: toISO(mon), to: toISO(addDays(mon, 6)) };
        }
        case "this_month":
            return {
                from: toISO(new Date(t.getFullYear(), t.getMonth(), 1)),
                to: toISO(t)
            };
        case "last_month":
            return {
                from: toISO(new Date(t.getFullYear(), t.getMonth() - 1, 1)),
                to: toISO(new Date(t.getFullYear(), t.getMonth(), 0))
            };
        default:
            return { from: toISO(t), to: toISO(t) };
    }
}

const PRESETS = [
    { key: "today", label: "Today" },
    { key: "yesterday", label: "Yesterday" },
    { key: "this_week", label: "This Week" },
    { key: "last_week", label: "Last Week" },
    { key: "this_month", label: "This Month" },
    { key: "last_month", label: "Last Month" }
];

const PRESET_LABELS = Object.fromEntries(PRESETS.map((p) => [p.key, p.label]));

const TABS = [
    { key: "overview", label: "Overview" },
    { key: "sales", label: "Sales" },
    { key: "orders", label: "Orders" },
    { key: "items", label: "Items" },
    { key: "payments", label: "Payments" },
    { key: "staff", label: "Staff" },
    { key: "kitchen", label: "Kitchen" },
    { key: "tables", label: "Tables" },
    { key: "charges", label: "Charges & Tax" }
];

const ORDER_TYPE_COLORS = {
    "Dine-In": "#4F46E5",
    Takeaway: "#10B981",
    Delivery: "#F59E0B"
};

const PAYMENT_COLORS = {
    Cash: "#10B981",
    UPI: "#2563EB",
    Card: "#8B5CF6",
    Wallet: "#F59E0B",
    "Bank Transfer": "#0EA5E9",
    Split: "#64748B",
    Pending: "#EF4444"
};

const hourLabel = (h) => {
    const suffix = h >= 12 ? "PM" : "AM";
    const hr = h % 12 === 0 ? 12 : h % 12;
    return `${hr} ${suffix}`;
};

/* ─────────────────────── click outside hook ──────────────────── */

function useClickOutside(ref, onClose) {
    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) onClose();
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [ref, onClose]);
}

/* ───────────────────────── KPI card ──────────────────────────── */

function KpiCard({ icon, accent, label, value, trend, foot }) {
    return (
        <div className="rp-kpi" style={{ "--rp-accent": accent }}>
            <div className="rp-kpi-top">
                <span className="rp-kpi-label">{label}</span>
                <span className="rp-kpi-icon">{icon}</span>
            </div>
            <div className="rp-kpi-value">{value}</div>
            <div className="rp-kpi-foot">
                {typeof trend === "number" && (
                    <span className={`rp-trend ${trend >= 0 ? "up" : "down"}`}>
                        {trend >= 0 ? <FaArrowUp /> : <FaArrowDown />}
                        {Math.abs(trend).toFixed(1)}%
                    </span>
                )}
                {foot && <span>{foot}</span>}
            </div>
        </div>
    );
}

/* ───────────────────── chart tooltip ─────────────────────────── */

function ChartTooltip({ active, payload, label, prefix }) {
    if (!active || !payload || !payload.length) return null;
    return (
        <div className="rp-tooltip">
            <div className="rp-tooltip-title">{label}</div>
            <div className="rp-tooltip-value">
                {prefix ? inr(payload[0].value) : `${payload[0].value} orders`}
            </div>
        </div>
    );
}

/* ───────────────── sales overview card ───────────────────────── */

function SalesOverviewCard({ series, span = 8 }) {

    const [mode, setMode] = useState("sales");

    const data = useMemo(
        () =>
            (series || []).map((p) => ({
                ...p,
                label: fmtDay(p.date)
            })),
        [series]
    );

    const hasPoints = data.some((p) => p.sales > 0 || p.orders > 0);

    return (
        <div className={`rp-card rp-span-${span}`}>
            <div className="rp-card-head">
                <div>
                    <h3 className="rp-card-title">Sales Overview</h3>
                    <p className="rp-card-sub">
                        Track revenue performance over the selected period
                    </p>
                </div>
                <div className="rp-toggle">
                    <button
                        type="button"
                        className={mode === "sales" ? "active" : ""}
                        onClick={() => setMode("sales")}
                    >
                        Sales
                    </button>
                    <button
                        type="button"
                        className={mode === "orders" ? "active" : ""}
                        onClick={() => setMode("orders")}
                    >
                        Orders
                    </button>
                </div>
            </div>

            {!hasPoints ? (
                <div className="rp-state empty">
                    <div className="rp-state-icon"><FaInbox /></div>
                    <h3>No report data available</h3>
                    <p>Try selecting a different date range.</p>
                </div>
            ) : (
                <div className="rp-chart-box">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                            data={data}
                            margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
                        >
                            <defs>
                                <linearGradient id="rpAreaFill" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#2563EB" stopOpacity={0.28} />
                                    <stop offset="100%" stopColor="#4F46E5" stopOpacity={0.02} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="4 6" stroke="#EEF2F7" vertical={false} />
                            <XAxis
                                dataKey="label"
                                tick={{ fontSize: 12, fill: "#9CA3AF" }}
                                tickLine={false}
                                axisLine={{ stroke: "#EEF2F7" }}
                                minTickGap={26}
                            />
                            <YAxis
                                tick={{ fontSize: 12, fill: "#9CA3AF" }}
                                tickLine={false}
                                axisLine={false}
                                width={46}
                                tickFormatter={(v) =>
                                    mode === "sales" ? compactNum(v) : v
                                }
                            />
                            <Tooltip
                                content={
                                    <ChartTooltip prefix={mode === "sales"} />
                                }
                                cursor={{ stroke: "#C7D2FE", strokeWidth: 1 }}
                            />
                            <Area
                                type="monotone"
                                dataKey={mode}
                                stroke="#2563EB"
                                strokeWidth={2.5}
                                fill="url(#rpAreaFill)"
                                animationDuration={600}
                                dot={data.length <= 14 ? { r: 3, fill: "#2563EB", strokeWidth: 0 } : false}
                                activeDot={{ r: 5 }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
}

/* ─────────────────── order type donut card ───────────────────── */

function OrderTypeCard({ orderTypes, span = 4 }) {

    const rows = (orderTypes || []).filter((r) => r.orders > 0);
    const totalOrders = rows.reduce((s, r) => s + r.orders, 0);

    return (
        <div className={`rp-card rp-span-${span}`}>
            <div className="rp-card-head">
                <div>
                    <h3 className="rp-card-title">Order Type Analysis</h3>
                    <p className="rp-card-sub">Where your orders come from</p>
                </div>
            </div>

            {rows.length === 0 ? (
                <div className="rp-state empty">
                    <div className="rp-state-icon"><FaInbox /></div>
                    <h3>No report data available</h3>
                    <p>Try selecting a different date range.</p>
                </div>
            ) : (
                <>
                    <div className="rp-donut-wrap">
                        <ResponsiveContainer width="100%" height={210}>
                            <PieChart>
                                <Pie
                                    data={rows}
                                    dataKey="orders"
                                    nameKey="order_type"
                                    innerRadius={64}
                                    outerRadius={92}
                                    paddingAngle={3}
                                    strokeWidth={0}
                                    animationDuration={600}
                                >
                                    {rows.map((r) => (
                                        <Cell
                                            key={r.order_type}
                                            fill={ORDER_TYPE_COLORS[r.order_type] || "#94A3B8"}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(value, name) => [
                                        `${value} orders`,
                                        name
                                    ]}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="rp-donut-center">
                            <strong>{totalOrders}</strong>
                            <span>Orders</span>
                        </div>
                    </div>

                    <div className="rp-legend">
                        {rows.map((r) => (
                            <div className="rp-legend-row" key={r.order_type}>
                                <span
                                    className="rp-dot"
                                    style={{
                                        background:
                                            ORDER_TYPE_COLORS[r.order_type] || "#94A3B8"
                                    }}
                                />
                                <span className="rp-legend-name">{r.order_type}</span>
                                <span className="rp-legend-meta">
                                    {totalOrders > 0
                                        ? Math.round((r.orders / totalOrders) * 100)
                                        : 0}
                                    % · <b>{inr(r.sales)}</b>
                                </span>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

/* ─────────────────── payment summary card ────────────────────── */

function PaymentSummaryCard({ payments, span = 7 }) {

    const methods = payments?.methods || [];
    const pending = payments?.pending || { orders: 0, amount: 0 };

    const rows = methods.map((m) => ({
        method: m.method,
        orders: m.transactions,
        amount: m.amount
    }));

    if (pending.orders > 0) {
        rows.push({
            method: "Pending",
            orders: pending.orders,
            amount: pending.amount
        });
    }

    const total = rows.reduce((s, r) => s + r.amount, 0);
    const maxAmount = rows.reduce((m, r) => Math.max(m, r.amount), 0);

    return (
        <div className={`rp-card rp-span-${span}`}>
            <div className="rp-card-head">
                <div>
                    <h3 className="rp-card-title">Payment Summary</h3>
                    <p className="rp-card-sub">Collected by payment method</p>
                </div>
            </div>

            {rows.length === 0 ? (
                <div className="rp-state empty">
                    <div className="rp-state-icon"><FaInbox /></div>
                    <h3>No report data available</h3>
                    <p>Try selecting a different date range.</p>
                </div>
            ) : (
                <>
                    <div className="rp-pay-list">
                        {rows.map((r) => (
                            <div className="rp-pay-row" key={r.method}>
                                <span className="rp-pay-name">{r.method}</span>
                                <div className="rp-pay-track">
                                    <div
                                        className="rp-pay-fill"
                                        style={{
                                            width: maxAmount > 0
                                                ? `${(r.amount / maxAmount) * 100}%`
                                                : "0%",
                                            background:
                                                PAYMENT_COLORS[r.method] || "#94A3B8"
                                        }}
                                    />
                                </div>
                                <span className="rp-pay-amt">{inr(r.amount)}</span>
                                <span className="rp-pay-pct">
                                    {total > 0
                                        ? Math.round((r.amount / total) * 100)
                                        : 0}
                                    %
                                </span>
                            </div>
                        ))}
                    </div>

                    <div className="rp-table-wrap">
                        <table className="rp-table">
                            <thead>
                                <tr>
                                    <th>Payment Method</th>
                                    <th className="num">Orders</th>
                                    <th className="num">Amount</th>
                                    <th className="num">Share</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r) => (
                                    <tr key={r.method}>
                                        <td>
                                            <span className="rp-dot"
                                                style={{
                                                    display: "inline-block",
                                                    marginRight: 8,
                                                    background:
                                                        PAYMENT_COLORS[r.method] || "#94A3B8"
                                                }}
                                            />
                                            {r.method}
                                        </td>
                                        <td className="num">{r.orders}</td>
                                        <td className="num">{inr(r.amount)}</td>
                                        <td className="num">
                                            {total > 0
                                                ? Math.round((r.amount / total) * 100)
                                                : 0}
                                            %
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}

/* ─────────────────── top selling items card ──────────────────── */

function TopItemsCard({ items, span = 7 }) {

    const [showAll, setShowAll] = useState(false);
    const visible = showAll ? items : items.slice(0, 5);

    const rankClass = (rank) =>
        rank === 1 ? "gold" : rank === 2 ? "silver" : rank === 3 ? "bronze" : "";

    return (
        <div className={`rp-card rp-span-${span}`}>
            <div className="rp-card-head">
                <div>
                    <h3 className="rp-card-title">Top Selling Items</h3>
                    <p className="rp-card-sub">Best performers by quantity sold</p>
                </div>
            </div>

            {items.length === 0 ? (
                <div className="rp-state empty">
                    <div className="rp-state-icon"><FaInbox /></div>
                    <h3>No report data available</h3>
                    <p>Try selecting a different date range.</p>
                </div>
            ) : (
                <>
                    <div className="rp-table-wrap">
                        <table className="rp-table">
                            <thead>
                                <tr>
                                    <th>Rank</th>
                                    <th>Item</th>
                                    <th>Category</th>
                                    <th className="num">Qty Sold</th>
                                    <th className="num">Revenue</th>
                                    <th className="num">Share</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visible.map((it) => (
                                    <tr key={`${it.rank}-${it.item_name}`}>
                                        <td>
                                            <span className={`rp-rank ${rankClass(it.rank)}`}>
                                                {it.rank}
                                            </span>
                                        </td>
                                        <td className="rp-item-name">{it.item_name}</td>
                                        <td>
                                            <span className="rp-chip">
                                                {it.category_name}
                                            </span>
                                        </td>
                                        <td className="num">{it.qty}</td>
                                        <td className="num">{inr(it.revenue)}</td>
                                        <td className="num">
                                            <div className="rp-bar-cell">
                                                <div className="rp-bar-track">
                                                    <div
                                                        className="rp-bar-fill"
                                                        style={{
                                                            width: `${Math.min(100, it.percentage)}%`
                                                        }}
                                                    />
                                                </div>
                                                {it.percentage}%
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {items.length > 5 && (
                        <button
                            type="button"
                            className="rp-view-all"
                            onClick={() => setShowAll(!showAll)}
                        >
                            {showAll
                                ? "Show Less"
                                : `View Full Item Report (${items.length})`}
                        </button>
                    )}
                </>
            )}
        </div>
    );
}

/* ─────────────────── low selling items card ──────────────────── */

function LowItemsCard({ items, span = 12 }) {
    return (
        <div className={`rp-card rp-span-${span}`}>
            <div className="rp-card-head">
                <div>
                    <h3 className="rp-card-title">Low Selling Items</h3>
                    <p className="rp-card-sub">
                        Available menu items with no sales in this period
                    </p>
                </div>
            </div>

            {items.length === 0 ? (
                <p className="rp-note">
                    Every available item recorded at least one sale in this period.
                </p>
            ) : (
                <div className="rp-legend" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {items.map((it) => (
                        <span className="rp-chip" key={it.item_name}>
                            {it.item_name} · {it.category_name}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

/* ─────────────────── peak hours card ─────────────────────────── */

function PeakHoursCard({ peakHours, peak, span = 5 }) {

    const maxOrders = (peakHours || []).reduce(
        (m, h) => Math.max(m, h.orders),
        0
    );

    return (
        <div className={`rp-card rp-span-${span}`}>
            <div className="rp-card-head">
                <div>
                    <h3 className="rp-card-title">Peak Hours</h3>
                    <p className="rp-card-sub">Order volume by hour of day</p>
                </div>
            </div>

            {(!peakHours || peakHours.length === 0) ? (
                <div className="rp-state empty">
                    <div className="rp-state-icon"><FaInbox /></div>
                    <h3>No report data available</h3>
                    <p>Try selecting a different date range.</p>
                </div>
            ) : (
                <>
                    {peak && (
                        <div className="rp-peak-highlight">
                            <div className="rp-peak-flame"><FaFire /></div>
                            <div className="rp-peak-info">
                                <strong>
                                    Peak Hour · {hourLabel(peak.hour)} –{" "}
                                    {hourLabel((peak.hour + 1) % 24)}
                                </strong>
                                <span>
                                    {peak.orders} orders · {inr(peak.sales)} sales
                                </span>
                            </div>
                        </div>
                    )}

                    <div className="rp-hours">
                        {peakHours.map((h) => (
                            <div
                                className={`rp-hour-row ${peak && h.hour === peak.hour ? "peak" : ""}`}
                                key={h.hour}
                            >
                                <span className="rp-hour-label">
                                    {hourLabel(h.hour)}
                                </span>
                                <div className="rp-hour-track">
                                    <div
                                        className="rp-hour-fill"
                                        style={{
                                            width: maxOrders > 0
                                                ? `${(h.orders / maxOrders) * 100}%`
                                                : "0%"
                                        }}
                                    />
                                </div>
                                <span className="rp-hour-count">
                                    {h.orders} · {compactNum(h.sales)}
                                </span>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

/* ─────────────────── kitchen performance card ────────────────── */

function KitchenCard({ kitchen, span = 5 }) {

    const k = kitchen || {};
    const status = k.status || null;

    const statusMeta = {
        good: { cls: "good", text: "Within target", icon: <FaCheckCircle /> },
        warning: { cls: "warning", text: "Needs attention", icon: <FaExclamationTriangle /> },
        critical: { cls: "critical", text: "Critical", icon: <FaTimesCircle /> }
    };

    const meta = status ? statusMeta[status] : null;

    const progress =
        k.avg_prep_min !== null && k.expected_prep_min
            ? Math.min(100, Math.round((k.expected_prep_min / k.avg_prep_min) * 100))
            : status === "critical" ? 15 : status === "warning" ? 55 : 85;

    return (
        <div className={`rp-card rp-span-${span}`}>
            <div className="rp-card-head">
                <div>
                    <h3 className="rp-card-title">Kitchen Performance</h3>
                    <p className="rp-card-sub">Preparation speed &amp; completion</p>
                </div>
            </div>

            {(k.total || 0) === 0 ? (
                <div className="rp-state empty">
                    <div className="rp-state-icon"><FaInbox /></div>
                    <h3>No report data available</h3>
                    <p>Try selecting a different date range.</p>
                </div>
            ) : (
                <>
                    <div className="rp-kitchen-grid">
                        <div className="rp-kitchen-stat">
                            <b>{k.total}</b>
                            <span>Total Orders</span>
                        </div>
                        <div className="rp-kitchen-stat">
                            <b>{k.completed}</b>
                            <span>Completed</span>
                        </div>
                        <div className="rp-kitchen-stat">
                            <b>{k.delayed}</b>
                            <span>Delayed</span>
                        </div>
                        <div className="rp-kitchen-stat">
                            <b>
                                {k.avg_prep_min !== null ? `${k.avg_prep_min}m` : "—"}
                            </b>
                            <span>Avg Prep Time</span>
                        </div>
                    </div>

                    {meta && (
                        <div style={{ display: "flex", justifyContent: "center" }}>
                            <span className={`rp-status-pill ${meta.cls}`}>
                                <span className="rp-status-dot" />
                                {meta.text}
                                {k.expected_prep_min !== null && k.avg_prep_min !== null
                                    ? ` · target ${k.expected_prep_min} min`
                                    : ""}
                            </span>
                        </div>
                    )}

                    {meta && (
                        <div className="rp-prep-track">
                            <div className={`rp-prep-fill ${meta.cls}`} style={{ width: `${progress}%` }} />
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

/* ─────────────────── charges & tax card ──────────────────────── */

function ChargesTaxCard({ chargesConfig, taxSummary, chargesCollected, span = 4 }) {

    const charges = chargesConfig || [];
    const tax = taxSummary || {};

    return (
        <div className={`rp-card rp-span-${span}`}>
            <div className="rp-card-head">
                <div>
                    <h3 className="rp-card-title">Charges &amp; Tax Summary</h3>
                    <p className="rp-card-sub">Configured charges and tax split</p>
                </div>
            </div>

            {charges.length === 0 && !tax.total ? (
                <div className="rp-state empty">
                    <div className="rp-state-icon"><FaInbox /></div>
                    <h3>No report data available</h3>
                    <p>No charges configured for this restaurant.</p>
                </div>
            ) : (
                <>
                    {charges.map((c) => (
                        <div className="rp-charge-row" key={c.charge_name}>
                            <span className="rp-charge-name">
                                {c.charge_name}
                                <span className="rp-charge-type">
                                    {Number(c.amount)}
                                    {c.charge_type === "Percentage" ? "%" : ""}
                                </span>
                            </span>
                        </div>
                    ))}

                    {chargesCollected > 0 && (
                        <div className="rp-charge-row">
                            <span className="rp-charge-name">
                                Collected (actual)
                            </span>
                            <span className="rp-charge-val">
                                {inr(chargesCollected)}
                            </span>
                        </div>
                    )}

                    <div className="rp-tax-box">
                        <div className="rp-tax-grid">
                            <div className="rp-tax-cell">
                                <b>{inr(tax.cgst)}</b>
                                <span>CGST{tax.percentage ? ` (${tax.percentage / 2}%)` : ""}</span>
                            </div>
                            <div className="rp-tax-cell">
                                <b>{inr(tax.sgst)}</b>
                                <span>SGST{tax.percentage ? ` (${tax.percentage / 2}%)` : ""}</span>
                            </div>
                            <div className="rp-tax-cell">
                                <b>{inr(tax.total)}</b>
                                <span>Total Tax</span>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

/* ─────────────────── business health card ────────────────────── */

function buildInsights(data) {

    const out = [];
    const k = data.kpis || {};
    const c = data.comparison || {};

    const hasComparison = (c.total_orders || 0) > 0 || (c.total_sales || 0) > 0;

    if (!hasComparison) {
        out.push({
            tone: "neutral",
            icon: <FaInfoCircle />,
            text: "No comparison data available."
        });
    } else {

        const sPct = trendPct(k.total_sales, c.total_sales);
        if (sPct !== null) {
            out.push({
                tone: sPct >= 0 ? "good" : "bad",
                icon: sPct >= 0 ? <FaArrowUp /> : <FaArrowDown />,
                text: `Sales ${sPct >= 0 ? "increased" : "decreased"} by ${Math.abs(sPct).toFixed(1)}% compared with the previous period.`
            });
        }

        const oPct = trendPct(k.total_orders, c.total_orders);
        if (oPct !== null) {
            out.push({
                tone: oPct >= 0 ? "good" : "bad",
                icon: oPct >= 0 ? <FaArrowUp /> : <FaArrowDown />,
                text: `Orders ${oPct >= 0 ? "grew" : "dropped"} by ${Math.abs(oPct).toFixed(1)}% versus the previous period.`
            });
        }

        const aovDiff = (k.avg_order_value || 0) - (c.avg_order_value || 0);
        if (aovDiff !== 0) {
            out.push({
                tone: aovDiff > 0 ? "good" : "bad",
                icon: aovDiff > 0 ? <FaArrowUp /> : <FaArrowDown />,
                text: `Average order value ${aovDiff > 0 ? "rose" : "fell"} by ${inr(Math.abs(aovDiff))}.`
            });
        }
    }

    const kit = data.kitchen || {};
    if (
        kit.avg_prep_min !== null &&
        kit.expected_prep_min !== null &&
        kit.expected_prep_min > 0
    ) {
        const ratio = kit.avg_prep_min / kit.expected_prep_min;
        if (ratio > 1.15) {
            out.push({
                tone: "warning",
                icon: <FaExclamationTriangle />,
                text: `Kitchen preparation time is ${Math.round((ratio - 1) * 100)}% above the menu target.`
            });
        } else {
            out.push({
                tone: "good",
                icon: <FaCheckCircle />,
                text: "Kitchen preparation time is within target."
            });
        }
    }

    if ((kit.delayed || 0) > 0) {
        out.push({
            tone: "warning",
            icon: <FaExclamationTriangle />,
            text: `${kit.delayed} order${kit.delayed === 1 ? "" : "s"} finished later than expected.`
        });
    }

    if ((k.cancelled_orders || 0) > 0) {
        out.push({
            tone: "bad",
            icon: <FaTimesCircle />,
            text: `${k.cancelled_orders} order${k.cancelled_orders === 1 ? " was" : "s were"} cancelled during this period.`
        });
    }

    return out;
}

function HealthCard({ insights, span = 8 }) {
    return (
        <div className={`rp-card rp-span-${span}`}>
            <div className="rp-card-head">
                <div>
                    <h3 className="rp-card-title">Business Health</h3>
                    <p className="rp-card-sub">
                        Automatic insights from this period&rsquo;s data
                    </p>
                </div>
            </div>

            <div className="rp-health-list">
                {insights.length === 0 ? (
                    <div className="rp-health-item neutral">
                        <span className="rp-health-icon"><FaInfoCircle /></span>
                        No comparison data available.
                    </div>
                ) : (
                    insights.map((i, idx) => (
                        <div className={`rp-health-item ${i.tone}`} key={idx}>
                            <span className="rp-health-icon">{i.icon}</span>
                            <span>{i.text}</span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

/* ─────────────────── staff & tables cards ────────────────────── */

function StaffCard({ staff, span = 6 }) {
    return (
        <div className={`rp-card rp-span-${span}`}>
            <div className="rp-card-head">
                <div>
                    <h3 className="rp-card-title">Staff Report</h3>
                    <p className="rp-card-sub">Orders handled per employee</p>
                </div>
            </div>

            {staff.length === 0 ? (
                <div className="rp-state empty">
                    <div className="rp-state-icon"><FaInbox /></div>
                    <h3>No report data available</h3>
                    <p>Try selecting a different date range.</p>
                </div>
            ) : (
                <div className="rp-table-wrap">
                    <table className="rp-table">
                        <thead>
                            <tr>
                                <th>Staff</th>
                                <th className="num">Orders</th>
                                <th className="num">Sales</th>
                                <th className="num">Avg Order</th>
                            </tr>
                        </thead>
                        <tbody>
                            {staff.map((s) => (
                                <tr key={s.name}>
                                    <td className="rp-item-name">{s.name}</td>
                                    <td className="num">{s.orders}</td>
                                    <td className="num">{inr(s.sales)}</td>
                                    <td className="num">{inr(s.avg)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function TablesCard({ tables, span = 6 }) {
    return (
        <div className={`rp-card rp-span-${span}`}>
            <div className="rp-card-head">
                <div>
                    <h3 className="rp-card-title">Table Report</h3>
                    <p className="rp-card-sub">Revenue generated per table</p>
                </div>
            </div>

            {tables.length === 0 ? (
                <div className="rp-state empty">
                    <div className="rp-state-icon"><FaInbox /></div>
                    <h3>No report data available</h3>
                    <p>Try selecting a different date range.</p>
                </div>
            ) : (
                <div className="rp-table-wrap">
                    <table className="rp-table">
                        <thead>
                            <tr>
                                <th>Table</th>
                                <th className="num">Orders</th>
                                <th className="num">Sales</th>
                                <th className="num">Avg Bill</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tables.map((t) => (
                                <tr key={t.table_name}>
                                    <td className="rp-item-name">{t.table_name}</td>
                                    <td className="num">{t.orders}</td>
                                    <td className="num">{inr(t.sales)}</td>
                                    <td className="num">{inr(t.avg)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

/* ─────────────────────── export helpers ──────────────────────── */

function buildWorkbook(d) {

    const wb = [];

    wb.push({
        title: "Summary",
        header: ["Metric", "Value"],
        rows: [
            ["Date Range", `${d.range.from} to ${d.range.to}`],
            ["Total Sales", d.kpis.total_sales],
            ["Total Orders", d.kpis.total_orders],
            ["Average Order Value", d.kpis.avg_order_value],
            ["Paid Amount", d.kpis.paid_amount],
            ["Pending Amount", d.kpis.pending_amount],
            ["Discounts", d.kpis.discounts],
            ["Tax", d.kpis.tax],
            ["Additional Charges Collected", d.kpis.charges_collected],
            ["Cancelled Orders", d.kpis.cancelled_orders]
        ]
    });

    wb.push({
        title: "Daily Sales",
        header: ["Date", "Sales", "Orders"],
        rows: d.sales_series.map((p) => [p.date, p.sales, p.orders])
    });

    wb.push({
        title: "Order Types",
        header: ["Type", "Orders", "Sales"],
        rows: d.order_types.map((o) => [o.order_type, o.orders, o.sales])
    });

    wb.push({
        title: "Payments",
        header: ["Method", "Transactions", "Amount"],
        rows: [
            ...d.payments.methods.map((m) => [m.method, m.transactions, m.amount]),
            ["Pending", d.payments.pending.orders, d.payments.pending.amount]
        ]
    });

    wb.push({
        title: "Top Selling Items",
        header: ["Rank", "Item", "Category", "Qty", "Revenue"],
        rows: d.top_items.map((i) => [
            i.rank, i.item_name, i.category_name, i.qty, i.revenue
        ])
    });

    wb.push({
        title: "Staff",
        header: ["Staff", "Orders", "Sales", "Avg Order"],
        rows: d.staff.map((s) => [s.name, s.orders, s.sales, s.avg])
    });

    wb.push({
        title: "Tables",
        header: ["Table", "Orders", "Sales", "Avg Bill"],
        rows: d.tables.map((t) => [t.table_name, t.orders, t.sales, t.avg])
    });

    wb.push({
        title: "Charges & Tax",
        header: ["Item", "Value"],
        rows: [
            ...d.charges_config.map((c) => [
                `${c.charge_name} (${Number(c.amount)}${c.charge_type === "Percentage" ? "%" : ""})`,
                ""
            ]),
            ["CGST", d.tax_summary.cgst],
            ["SGST", d.tax_summary.sgst],
            ["Total Tax", d.tax_summary.total]
        ]
    });

    return wb;
}

function downloadBlob(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

const csvCell = (v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function exportCsv(d) {
    const wb = buildWorkbook(d);
    const parts = wb.map((sec) => [
        sec.title,
        sec.header.join(","),
        ...sec.rows.map((r) => r.map(csvCell).join(","))
    ].join("\n"));
    downloadBlob(
        parts.join("\n\n"),
        `inwallz-report_${d.range.from}_to_${d.range.to}.csv`,
        "text/csv;charset=utf-8;"
    );
}

const escHtml = (v) =>
    String(v ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

function exportExcel(d) {
    const wb = buildWorkbook(d);
    const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"/></head><body>${wb
        .map(
            (sec) =>
                `<h3>${escHtml(sec.title)}</h3><table border="1"><tr>${sec.header
                    .map((h) => `<th>${escHtml(h)}</th>`)
                    .join("")}</tr>${sec.rows
                    .map(
                        (r) =>
                            `<tr>${r.map((c) => `<td>${escHtml(c)}</td>`).join("")}</tr>`
                    )
                    .join("")}</table><br/>`
        )
        .join("")}</body></html>`;
    downloadBlob(
        html,
        `inwallz-report_${d.range.from}_to_${d.range.to}.xls`,
        "application/vnd.ms-excel"
    );
}

/* ───────────────────── skeleton loaders ──────────────────────── */

function LoadingSkeleton() {
    return (
        <>
            <div className="rp-skel-kpis">
                {[...Array(8)].map((_, i) => (
                    <div className="rp-skel rp-skel-kpi" key={i} />
                ))}
            </div>
            <div className="rp-skel rp-skel-block" />
            <p className="rp-loading-text">Loading report...</p>
        </>
    );
}

/* ─────────────────────── main component ──────────────────────── */

function Reports() {

    const [preset, setPreset] = useState("today");
    const [appliedCustom, setAppliedCustom] = useState(null);
    const [dateOpen, setDateOpen] = useState(false);
    const [exportOpen, setExportOpen] = useState(false);
    const [customFrom, setCustomFrom] = useState(toISO(new Date()));
    const [customTo, setCustomTo] = useState(toISO(new Date()));

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [retryTick, setRetryTick] = useState(0);

    const [tab, setTab] = useState("overview");

    const dateRef = useRef(null);
    const exportRef = useRef(null);

    useClickOutside(dateRef, useCallback(() => setDateOpen(false), []));
    useClickOutside(exportRef, useCallback(() => setExportOpen(false), []));

    const range = useMemo(
        () => appliedCustom || getPresetRange(preset),
        [appliedCustom, preset]
    );

    useEffect(() => {
        let cancelled = false;

        setLoading(true);
        setError(false);

        getReportsOverview(range.from, range.to)
            .then((res) => {
                if (cancelled) return;
                setData(res.data.success ? res.data.data : null);
            })
            .catch(() => {
                if (!cancelled) setError(true);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };

    }, [range.from, range.to, retryTick]);

    const selectPreset = (key) => {
        setAppliedCustom(null);
        setPreset(key);
        setDateOpen(false);
    };

    const applyCustom = () => {
        if (!customFrom || !customTo || customFrom > customTo) return;
        setAppliedCustom({ from: customFrom, to: customTo });
        setDateOpen(false);
    };

    const rangeLabelText = appliedCustom
        ? `${fmtDay(appliedCustom.from)} → ${fmtDay(appliedCustom.to)}`
        : `${PRESET_LABELS[preset]} · ${fmtDay(range.from)}${range.from !== range.to ? ` → ${fmtDay(range.to)}` : ""}`;

    /* derived view state */
    const hasData =
        data &&
        ((data.kpis?.total_orders || 0) > 0 ||
            (data.sales_series || []).some((p) => p.orders > 0 || p.sales > 0));

    const insights = useMemo(
        () => (hasData ? buildInsights(data) : []),
        [data, hasData]
    );

    const showSection = (...keys) =>
        tab === "overview" || keys.includes(tab);

    return (
        <AdminLayout>

            <div className="reports-page">

                {/* header */}
                <div className="rp-header">
                    <div>
                        <h2>Reports</h2>
                        <p className="rp-header-sub">
                            Restaurant performance, sales and operational insights
                        </p>
                        <span className="rp-range-label">
                            <FaCalendarAlt /> {rangeLabelText}
                        </span>
                    </div>

                    <div className="rp-actions">

                        <div className="rp-dropdown" ref={dateRef}>
                            <button
                                type="button"
                                className="rp-btn"
                                onClick={() => { setDateOpen(!dateOpen); setExportOpen(false); }}
                            >
                                <FaCalendarAlt />
                                Date Range
                                <FaChevronDown size={11} />
                            </button>

                            {dateOpen && (
                                <div className="rp-menu">
                                    {PRESETS.map((p) => (
                                        <button
                                            key={p.key}
                                            type="button"
                                            className={`rp-menu-item ${!appliedCustom && preset === p.key ? "active" : ""}`}
                                            onClick={() => selectPreset(p.key)}
                                        >
                                            {p.label}
                                        </button>
                                    ))}

                                    <div className="rp-menu-sep" />

                                    <button
                                        type="button"
                                        className={`rp-menu-item ${appliedCustom ? "active" : ""}`}
                                        style={{ fontWeight: 600 }}
                                        disabled
                                    >
                                        Custom Range
                                    </button>

                                    <div className="rp-custom-row">
                                        <input
                                            type="date"
                                            value={customFrom}
                                            onChange={(e) => setCustomFrom(e.target.value)}
                                        />
                                        <span className="rp-custom-arrow">→</span>
                                        <input
                                            type="date"
                                            value={customTo}
                                            onChange={(e) => setCustomTo(e.target.value)}
                                        />
                                    </div>

                                    <button
                                        type="button"
                                        className="rp-custom-apply"
                                        onClick={applyCustom}
                                        disabled={!customFrom || !customTo || customFrom > customTo}
                                    >
                                        Apply
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="rp-dropdown" ref={exportRef}>
                            <button
                                type="button"
                                className="rp-btn"
                                onClick={() => { setExportOpen(!exportOpen); setDateOpen(false); }}
                                disabled={!hasData}
                            >
                                <FaFileExport />
                                Export
                                <FaChevronDown size={11} />
                            </button>

                            {exportOpen && hasData && (
                                <div className="rp-menu">
                                    <button
                                        type="button"
                                        className="rp-menu-item"
                                        onClick={() => { exportCsv(data); setExportOpen(false); }}
                                    >
                                        Download CSV
                                    </button>
                                    <button
                                        type="button"
                                        className="rp-menu-item"
                                        onClick={() => { exportExcel(data); setExportOpen(false); }}
                                    >
                                        Download Excel
                                    </button>
                                    <div className="rp-menu-sep" />
                                    <button
                                        type="button"
                                        className="rp-menu-item"
                                        onClick={() => { setExportOpen(false); window.print(); }}
                                    >
                                        Print / Save as PDF
                                    </button>
                                </div>
                            )}
                        </div>

                        <button
                            type="button"
                            className="rp-btn"
                            onClick={() => window.print()}
                            disabled={!hasData}
                        >
                            <FaPrint />
                            Print
                        </button>

                    </div>
                </div>

                {/* body */}
                {loading && !data ? (
                    <LoadingSkeleton />
                ) : error ? (
                    <div className="rp-state error">
                        <div className="rp-state-icon"><FaSyncAlt /></div>
                        <h3>Unable to load reports.</h3>
                        <p>Something went wrong while fetching report data.</p>
                        <button
                            type="button"
                            className="rp-retry"
                            onClick={() => setRetryTick((t) => t + 1)}
                        >
                            Retry
                        </button>
                    </div>
                ) : !hasData ? (
                    <div className="rp-state empty">
                        <div className="rp-state-icon"><FaInbox /></div>
                        <h3>No report data available</h3>
                        <p>Try selecting a different date range.</p>
                    </div>
                ) : (
                    <>
                        {/* KPI strip */}
                        <div className="rp-kpis">
                            <KpiCard
                                icon={<FaRupeeSign />}
                                accent="#2563EB"
                                label="Total Sales"
                                value={inr(data.kpis.total_sales)}
                                trend={
                                    trendPct(
                                        data.kpis.total_sales,
                                        data.comparison.total_sales
                                    ) ?? undefined
                                }
                                foot={trendPct(data.kpis.total_sales, data.comparison.total_sales) === null ? "Paid orders only" : "vs previous period"}
                            />
                            <KpiCard
                                icon={<FaShoppingBag />}
                                accent="#4F46E5"
                                label="Total Orders"
                                value={data.kpis.total_orders}
                                trend={
                                    trendPct(
                                        data.kpis.total_orders,
                                        data.comparison.total_orders
                                    ) ?? undefined
                                }
                                foot={trendPct(data.kpis.total_orders, data.comparison.total_orders) === null ? "Excludes cancelled" : "vs previous period"}
                            />
                            <KpiCard
                                icon={<FaChartLine />}
                                accent="#0EA5E9"
                                label="Average Order"
                                value={inr(data.kpis.avg_order_value)}
                                trend={
                                    trendPct(
                                        data.kpis.avg_order_value,
                                        data.comparison.avg_order_value
                                    ) ?? undefined
                                }
                                foot={trendPct(data.kpis.avg_order_value, data.comparison.avg_order_value) === null ? "Per paid order" : "vs previous period"}
                            />
                            <KpiCard
                                icon={<FaMoneyBillWave />}
                                accent="#10B981"
                                label="Paid"
                                value={inr(data.kpis.paid_amount)}
                                foot="Successfully collected"
                            />
                            <KpiCard
                                icon={<FaHourglassHalf />}
                                accent="#F59E0B"
                                label="Pending"
                                value={inr(data.kpis.pending_amount)}
                                foot="Awaiting payment"
                            />
                            <KpiCard
                                icon={<FaTags />}
                                accent="#8B5CF6"
                                label="Discounts"
                                value={inr(data.kpis.discounts)}
                                foot="Given on orders"
                            />
                            <KpiCard
                                icon={<FaPercentage />}
                                accent="#EC4899"
                                label="Tax"
                                value={inr(data.kpis.tax)}
                                foot="Applied on orders"
                            />
                            <KpiCard
                                icon={<FaPlusCircle />}
                                accent="#14B8A6"
                                label="Additional Charges"
                                value={inr(data.kpis.charges_collected)}
                                foot="Collected with payments"
                            />
                        </div>

                        {/* tabs */}
                        <div className="rp-tabs">
                            {TABS.map((t) => (
                                <button
                                    key={t.key}
                                    type="button"
                                    className={`rp-tab ${tab === t.key ? "active" : ""}`}
                                    onClick={() => setTab(t.key)}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>

                        {/* sections */}
                        <div className="rp-grid">

                            {showSection("sales") && (
                                <SalesOverviewCard
                                    series={data.sales_series}
                                    span={tab === "overview" ? 8 : 12}
                                />
                            )}

                            {showSection("orders") && (
                                <OrderTypeCard
                                    orderTypes={data.order_types}
                                    span={tab === "orders" ? 6 : 4}
                                />
                            )}

                            {showSection("payments") && (
                                <PaymentSummaryCard
                                    payments={data.payments}
                                    span={tab === "payments" ? 12 : 7}
                                />
                            )}

                            {showSection("items") && (
                                <TopItemsCard
                                    items={data.top_items}
                                    span={tab === "items" ? 8 : 7}
                                />
                            )}

                            {showSection("orders") && (
                                <PeakHoursCard
                                    peakHours={data.peak_hours}
                                    peak={data.peak}
                                    span={tab === "orders" ? 6 : 5}
                                />
                            )}

                            {showSection("kitchen") && (
                                <KitchenCard
                                    kitchen={data.kitchen}
                                    span={tab === "kitchen" ? 12 : 5}
                                />
                            )}

                            {showSection("charges") && (
                                <ChargesTaxCard
                                    chargesConfig={data.charges_config}
                                    taxSummary={data.tax_summary}
                                    chargesCollected={data.kpis.charges_collected}
                                    span={tab === "charges" ? 6 : 4}
                                />
                            )}

                            {showSection("charges") && (
                                <HealthCard
                                    insights={insights}
                                    span={tab === "charges" ? 6 : 8}
                                />
                            )}

                            {showSection("staff") && (
                                <StaffCard
                                    staff={data.staff}
                                    span={tab === "staff" ? 12 : 6}
                                />
                            )}

                            {showSection("tables") && (
                                <TablesCard
                                    tables={data.tables}
                                    span={tab === "tables" ? 12 : 6}
                                />
                            )}

                            {showSection("items") && tab !== "overview" && (
                                <LowItemsCard items={data.low_items} span={4} />
                            )}

                            {tab === "overview" && (
                                <LowItemsCard items={data.low_items} span={12} />
                            )}

                        </div>
                    </>
                )}

            </div>

        </AdminLayout>
    );
}

export default Reports;
