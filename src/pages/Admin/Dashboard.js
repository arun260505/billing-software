import React, { useCallback, useEffect, useState } from "react";

import AdminLayout from "../../layouts/AdminLayout";
import DashboardCard from "../../components/Admin/DashboardCard";
import SalesChart from "../../components/Admin/SalesChart";
import PaymentSummary from "../../components/Admin/PaymentSummary";
import TopSelling from "../../components/Admin/TopSelling";
import RecentOrders from "../../components/Admin/RecentOrders";
import RestaurantStatus from "../../components/Admin/RestaurantStatus";
import QuickActions from "../../components/Admin/QuickActions";
import NotificationPanel from "../../components/Admin/NotificationPanel";
import PrinterStatus from "../../components/Admin/PrinterStatus";
import ConnectionStatus from "../../components/Admin/ConnectionStatus";

import {
  getDashboardSummary,
  getDashboardHealth,
  getTopItems,
  getRecentOrders,
  getSalesChart
} from "../../services/dashboardService";

import authService from "../../services/authService";

import "../../styles/Admin/Dashboard.css";
import "../../styles/Admin/DashboardCard.css";

const pad = (n) => String(n).padStart(2, "0");

const money = (v) => `₹${Number(v || 0).toLocaleString("en-IN")}`;

// True when the current time falls inside the restaurant's configured
// open/close window (or the restaurant is otherwise recorded as Active).
const isCurrentlyOpen = (summary) => {
  if (!summary || summary.restaurant_status === "Inactive") return false;
  const open = summary.opening_time;
  const close = summary.closing_time;
  if (!open || !close) return true;
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const toMins = (t) => {
    const [h, m] = String(t).split(":").map(Number);
    return h * 60 + (m || 0);
  };
  const oMins = toMins(open);
  const cMins = toMins(close);
  if (oMins === cMins) return true;
  if (oMins < cMins) return mins >= oMins && mins <= cMins;
  return mins >= oMins || mins <= cMins; // spans midnight
};

function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [summary, setSummary] = useState({});
  const [topItems, setTopItems] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [health, setHealth] = useState(null);
  const [lastSync, setLastSync] = useState(null);

  const [period, setPeriod] = useState("today");
  const [chartData, setChartData] = useState([]);
  const [chartLoading, setChartLoading] = useState(true);
  const [chartError, setChartError] = useState(false);

  const user = authService.getUser();
  const restaurantName =
    summary.restaurant_name || user?.restaurant_name || "Restaurant";

  const loadCore = useCallback(async () => {
    setLoading(true);
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
      setLastSync(new Date());
    } catch (err) {
      console.error("Dashboard load error:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadChart = useCallback(async (p) => {
    setChartLoading(true);
    setChartError(false);
    try {
      const res = await getSalesChart(p);
      if (res.data.success) {
        setChartData(buildChartSeries(res.data.data || [], p));
      }
    } catch (err) {
      console.error("Sales chart error:", err);
      setChartError(true);
    } finally {
      setChartLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCore();
  }, [loadCore]);

  useEffect(() => {
    loadChart(period);
  }, [period, loadChart]);

  const open = isCurrentlyOpen(summary);

  const cardData = [
    {
      title: "Today's Sales",
      value: money(summary.total_sales),
      sub: "Paid orders today",
      icon: "FaRupeeSign",
      accent: "#2563EB"
    },
    {
      title: "Today's Orders",
      value: Number(summary.total_orders || 0),
      sub: "Orders created today",
      icon: "FaClipboardList",
      accent: "#16A34A"
    },
    {
      title: "Payment Collection",
      value: money(summary.total_collection),
      sub: "Collected via all methods",
      icon: "FaMoneyBillWave",
      accent: "#8B5CF6"
    },
    {
      title: "Tables",
      value: `${Number(summary.occupied_tables || 0)} / ${Number(summary.total_tables || 0)}`,
      sub: "Tables occupied",
      icon: "FaUtensils",
      accent: "#F59E0B"
    }
  ];

  return (
    <AdminLayout>
      <div className="dashboard-content ad-dashboard">

        {/* Page title */}
        <div className="ad-heading">
          <div>
            <h1>Welcome back, Admin</h1>
            <p>Here&rsquo;s what&rsquo;s happening at {restaurantName} today.</p>
          </div>
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
            {/* Summary cards */}
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

            {/* Analytics row */}
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

            {/* Top selling + restaurant status */}
            <div className="ad-grid">
              <div className="ad-col ad-col-8">
                <TopSelling items={topItems} loading={loading} onRetry={loadCore} />
              </div>

              <div className="ad-col ad-col-4">
                <RestaurantStatus
                  summary={summary}
                  restaurantName={restaurantName}
                  isOpen={open}
                  loading={loading}
                />
              </div>
            </div>

            {/* Recent orders + notifications */}
            <div className="ad-grid">
              <div className="ad-col ad-col-8">
                <RecentOrders orders={recentOrders} loading={loading} onRetry={loadCore} />
              </div>

              <div className="ad-col ad-col-4">
                <NotificationPanel
                  recentOrders={recentOrders}
                  summary={summary}
                  loading={loading}
                />
              </div>
            </div>

            {/* Quick actions + system status */}
            <div className="ad-grid ad-grid-bottom">
              <div className="ad-col ad-col-4">
                <QuickActions />
              </div>

              <div className="ad-col ad-col-4">
                <ConnectionStatus
                  health={health}
                  loading={loading}
                  lastSync={lastSync}
                  onRetry={loadCore}
                />
              </div>

              <div className="ad-col ad-col-4">
                <PrinterStatus />
              </div>
            </div>
          </>
        )}

      </div>
    </AdminLayout>
  );
}

// Build a continuous, gap-free chart series for the selected period so the
// Sales Overview never shows a broken line or a huge blank area.
function buildChartSeries(rows, period) {
  const map = {};
  rows.forEach((r) => {
    map[normaliseKey(r.label)] = Number(r.sales) || 0;
  });

  const isHourly = period === "today" || period === "yesterday";
  const out = [];

  if (isHourly) {
    for (let h = 0; h < 24; h++) {
      const key = String(h);
      out.push({
        label: `${pad(h)}:00`,
        sales: map[key] || 0
      });
    }
    return out;
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const points = [];

  if (period === "week") {
    const mon = new Date(today);
    mon.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    for (let d = new Date(mon); d <= today; d.setDate(d.getDate() + 1)) {
      points.push(new Date(d));
    }
  } else {
    for (let d = 1; d <= today.getDate(); d++) {
      points.push(new Date(today.getFullYear(), today.getMonth(), d));
    }
  }

  points.forEach((d) => {
    const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    out.push({
      label: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
      sales: map[key] || 0
    });
  });

  return out;
}

function normaliseKey(raw) {
  if (raw == null) return "";
  const s = String(raw);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s.trim();
}

export default Dashboard;