import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowRight, FaBoxOpen, FaCut } from "react-icons/fa";

import AdminLayout from "../../layouts/AdminLayout";
import { DayProvider, DayButton } from "../../components/DayControl";
import DashboardCard from "../../components/Admin/DashboardCard";
import SalesChart from "../../components/Admin/SalesChart";
import PaymentSummary from "../../components/Admin/PaymentSummary";
import TopSelling from "../../components/Admin/TopSelling";
import RecentOrders from "../../components/Admin/RecentOrders";
import ConnectionStatus from "../../components/Admin/ConnectionStatus";

import {
  getDashboardSummary,
  getDashboardHealth,
  getTopItems,
  getRecentOrders,
  getSalesChart
} from "../../services/dashboardService";
import { getInventory } from "../../services/inventoryService";
import { getStylistBoard } from "../../services/stylistService";
import { getSyncStatus } from "../../services/systemService";
import authService from "../../services/authService";
import { buildChartSeries } from "../../utils/salesChartSeries";

import "../../styles/Admin/Dashboard.css";
import "../../styles/Admin/DashboardCard.css";
import "../../styles/pages/Salon/Salon.css";

const money = (v) => `₹${Number(v || 0).toLocaleString("en-IN")}`;
const qty = (v) => Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

// Stock at or below its reorder level, emptiest first.
function LowStockCard({ items, loading, error, onOpen }) {
  return (
    <div className="ad-card">
      <div className="ad-card-head">
        <div>
          <h3>Low Stock</h3>
          <span className="ad-card-sub">At or below the reorder level</span>
        </div>
        <button className="ad-view-all" onClick={onOpen}>
          Inventory <FaArrowRight />
        </button>
      </div>

      {loading ? (
        <div className="ad-skel-lines">
          <span className="ad-skel ad-skel-line" />
          <span className="ad-skel ad-skel-line" />
          <span className="ad-skel ad-skel-line" />
        </div>
      ) : error ? (
        <div className="ad-state"><p>Couldn't load stock levels.</p></div>
      ) : items.length === 0 ? (
        <div className="ad-state">
          <div className="ad-state-icon"><FaBoxOpen /></div>
          <p>Everything is stocked.</p>
        </div>
      ) : (
        <ul className="sl-lowstock">
          {items.slice(0, 6).map((it) => {
            const out = Number(it.quantity) <= 0;
            return (
              <li key={it.id}>
                <span>
                  <span className="sl-name">{it.item_name}</span>
                  <span className="sl-sub">Reorder at {qty(it.min_quantity)} {it.unit}</span>
                </span>
                <span className={`sl-badge ${out ? "sl-badge-bad" : "sl-badge-warn"}`}>
                  {out ? "Out" : `${qty(it.quantity)} ${it.unit} left`}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const timeOf = (v) =>
  v ? new Date(v).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";

// Today, per stylist: customers served, bills, services and sales (paid bills),
// refreshed every few seconds. The top earner so far is highlighted.
function StylistBoard({ rows, loading, error, updatedAt }) {
  const top = rows.find((r) => Number(r.bills) > 0);

  return (
    <div className="ad-card">
      <div className="ad-card-head">
        <div>
          <h3>Stylists Today</h3>
          <span className="ad-card-sub">Customers served and sales per stylist · paid bills</span>
        </div>
        <span className={`sl-live${error ? " sl-stale" : ""}`} title="Refreshes every 10 seconds">
          <i />
          {error
            ? "Reconnecting…"
            : `Live${updatedAt ? ` · ${updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : ""}`}
        </span>
      </div>

      {loading ? (
        <div className="ad-skel-lines">
          <span className="ad-skel ad-skel-line" />
          <span className="ad-skel ad-skel-line" />
          <span className="ad-skel ad-skel-line" />
        </div>
      ) : rows.length === 0 ? (
        <div className="ad-state">
          <div className="ad-state-icon"><FaCut /></div>
          <p>{error ? "Couldn't load the stylist board." : "No stylists yet. Add them in Employees."}</p>
        </div>
      ) : (
        <div className="sl-table-wrap">
          <table className="sl-table">
            <thead>
              <tr>
                <th>Stylist</th>
                <th className="num">Customers</th>
                <th className="num">Bills</th>
                <th className="num">Services</th>
                <th className="num">Sales</th>
                <th>Last bill</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isTop = top && top.id === r.id;
                const unpaid = Number(r.unpaid_bills || 0);
                return (
                  <tr key={r.id} className={isTop ? "sl-top" : ""}>
                    <td>
                      <span className="sl-name">{r.full_name}</span>
                      {isTop && <span className="sl-badge sl-badge-ok" style={{ marginLeft: 8 }}>Top today</span>}
                      {unpaid > 0 && <span className="sl-sub">{unpaid} unpaid at the desk</span>}
                    </td>
                    <td className="num">{Number(r.customers || 0)}</td>
                    <td className="num">{Number(r.bills || 0)}</td>
                    <td className="num">{Number(r.services || 0)}</td>
                    <td className="num">{money(r.sales)}</td>
                    <td>{timeOf(r.last_bill_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// The salon owner's home: today's takings, who came in, what each stylist has
// done, what sold, and what needs reordering. No tables, kitchen or service types.
function SalonDashboard() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [summary, setSummary] = useState({});
  const [topItems, setTopItems] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [health, setHealth] = useState(null);
  const [syncAt, setSyncAt] = useState(null);

  const [lowStock, setLowStock] = useState([]);
  const [stockError, setStockError] = useState(false);

  const [stylistRows, setStylistRows] = useState([]);
  const [stylistLoading, setStylistLoading] = useState(true);
  const [stylistError, setStylistError] = useState(false);
  const [stylistAt, setStylistAt] = useState(null);

  // The stylist board is the live part of this page, so it refreshes on its own,
  // faster timer (and straight away when the tab comes back into view).
  useEffect(() => {
    let active = true;
    const load = () =>
      getStylistBoard()
        .then((res) => {
          if (!active) return;
          setStylistRows(res.data.data || []);
          setStylistError(false);
          setStylistAt(new Date());
        })
        .catch(() => { if (active) setStylistError(true); })
        .finally(() => { if (active) setStylistLoading(false); });

    load();
    const timer = setInterval(load, 10000);
    const onReturn = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onReturn);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, []);

  const [period, setPeriod] = useState("today");
  const [chartData, setChartData] = useState([]);
  const [chartLoading, setChartLoading] = useState(true);
  const [chartError, setChartError] = useState(false);

  const user = authService.getUser();
  const salonName = summary.restaurant_name || user?.restaurant_name || "your salon";

  const loadCore = useCallback(async () => {
    setError(false);
    try {
      const [summaryRes, healthRes, itemsRes, ordersRes] = await Promise.all([
        getDashboardSummary(),
        getDashboardHealth(),
        getTopItems(),
        getRecentOrders()
      ]);

      if (summaryRes.data.success) setSummary(summaryRes.data.data || {});
      if (itemsRes.data.success) setTopItems(itemsRes.data.data || []);
      if (ordersRes.data.success) setRecentOrders(ordersRes.data.data || []);
      if (healthRes.data.success) setHealth(healthRes.data.data);
    } catch (err) {
      console.error("Salon dashboard load error:", err);
      setError(true);
    } finally {
      setLoading(false);
    }

    // Stock is its own request: a failure here shouldn't blank the sales view.
    try {
      const res = await getInventory();
      const low = (res.data.data || [])
        .filter((i) => i.status !== "Inactive" && Number(i.quantity) <= Number(i.min_quantity))
        .sort((a, b) => Number(a.quantity) - Number(b.quantity));
      setLowStock(low);
      setStockError(false);
    } catch (err) {
      console.error("Low stock load error:", err);
      setStockError(true);
    }
  }, []);

  const loadChart = useCallback(async (p) => {
    setChartLoading(true);
    setChartError(false);
    try {
      const res = await getSalesChart(p);
      if (res.data.success) setChartData(buildChartSeries(res.data.data || [], p));
    } catch (err) {
      console.error("Sales chart error:", err);
      setChartError(true);
    } finally {
      setChartLoading(false);
    }
  }, []);

  // Same 15s refresh as the restaurant dashboard, and again on returning to the tab.
  useEffect(() => {
    loadCore();
    const timer = setInterval(loadCore, 15000);
    const refreshOnReturn = () => {
      if (document.visibilityState === "visible") loadCore();
    };
    document.addEventListener("visibilitychange", refreshOnReturn);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshOnReturn);
    };
  }, [loadCore]);

  useEffect(() => {
    let active = true;
    const load = () =>
      getSyncStatus()
        .then((res) => { if (active && res.data?.success) setSyncAt(res.data.last_sync_at); })
        .catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => { active = false; clearInterval(t); };
  }, []);

  useEffect(() => {
    loadChart(period);
  }, [period, loadChart]);

  const lowCount = Number(summary.low_stock_items || 0);

  const cardData = [
    {
      title: "Today's Sales",
      value: money(summary.total_sales),
      sub: "Paid bills today",
      icon: "FaRupeeSign",
      accent: "#2563EB"
    },
    {
      title: "Bills Today",
      value: Number(summary.total_orders || 0),
      sub: "Excludes cancelled",
      icon: "FaClipboardList",
      accent: "#16A34A"
    },
    {
      title: "Customers Today",
      value: Number(summary.customers_today || 0),
      sub: "Billed with a mobile number",
      icon: "FaUsers",
      accent: "#8B5CF6"
    },
    {
      title: "Low Stock",
      value: lowCount,
      sub: lowCount ? "Items to reorder" : "Everything is stocked",
      icon: lowCount ? "FaExclamationTriangle" : "FaBoxOpen",
      accent: lowCount ? "#DC2626" : "#F59E0B"
    }
  ];

  return (
    <AdminLayout>
      {/* Owner can open/close the salon day (or a day the receptionist forgot). */}
      <DayProvider gate={false}>
      <div className="dashboard-content ad-dashboard">

        <div className="ad-heading">
          <div>
            <h1>Welcome back</h1>
            <p>Here&rsquo;s what&rsquo;s happening at {salonName} today.</p>
          </div>
          <DayButton className="ad-dayclose" />
        </div>

        {error ? (
          <div className="ad-state ad-error">
            <div className="ad-state-icon">!</div>
            <h3>Unable to load dashboard data</h3>
            <p>Check your connection and try again.</p>
            <button className="ad-retry" onClick={loadCore}>Retry</button>
          </div>
        ) : (
          <>
            <div className="ad-summary">
              {loading
                ? [0, 1, 2, 3].map((i) => (
                    <div className="dashboard-card ad-skel-card" key={i}>
                      <span className="ad-skel ad-skel-icon" />
                      <div className="ad-skel-lines">
                        <span className="ad-skel ad-skel-line" />
                        <span className="ad-skel ad-skel-line ad-skel-line-lg" />
                        <span className="ad-skel ad-skel-line ad-skel-line-sm" />
                      </div>
                    </div>
                  ))
                : cardData.map((c) => (
                    <DashboardCard
                      key={c.title}
                      title={c.title}
                      value={c.value}
                      sub={c.sub}
                      icon={c.icon}
                      accent={c.accent}
                    />
                  ))}
            </div>

            <div className="ad-grid">
              <div className="ad-col sl-col-12">
                <StylistBoard
                  rows={stylistRows}
                  loading={stylistLoading}
                  error={stylistError}
                  updatedAt={stylistAt}
                />
              </div>
            </div>

            <div className="ad-grid">
              <div className="ad-col ad-col-8">
                <SalesChart
                  data={chartData}
                  loading={chartLoading}
                  error={chartError}
                  period={period}
                  onPeriodChange={setPeriod}
                  onRetry={() => loadChart(period)}
                />
              </div>
              <div className="ad-col ad-col-4">
                <PaymentSummary summary={summary} loading={loading} />
              </div>
            </div>

            <div className="ad-grid">
              <div className="ad-col ad-col-8">
                <TopSelling items={topItems} loading={loading} title="Top Services" unitLabel="Services done" />
              </div>
              <div className="ad-col ad-col-4">
                <LowStockCard
                  items={lowStock}
                  loading={loading}
                  error={stockError}
                  onOpen={() => navigate("/admin/inventory")}
                />
              </div>
            </div>

            <div className="ad-grid ad-grid-bottom">
              <div className="ad-col ad-col-8">
                <RecentOrders
                  orders={recentOrders}
                  loading={loading}
                  onRetry={loadCore}
                  title="Recent Bills"
                  subtitle="Latest bills from the front desk"
                  showType={false}
                />
              </div>
              <div className="ad-col ad-col-4">
                <ConnectionStatus
                  health={health}
                  loading={loading}
                  syncAt={syncAt}
                  onRetry={loadCore}
                />
              </div>
            </div>
          </>
        )}

      </div>
      </DayProvider>
    </AdminLayout>
  );
}

export default SalonDashboard;
