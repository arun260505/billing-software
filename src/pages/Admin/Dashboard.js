import React, { useCallback, useEffect, useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";

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
import WaiterActivity from "../../components/Admin/WaiterActivity";

import {
  getDashboardSummary,
  getDashboardHealth,
  getTopItems,
  getRecentOrders,
  getSalesChart,
  getWaiterActivity
} from "../../services/dashboardService";

import authService from "../../services/authService";
import { buildChartSeries } from "../../utils/salesChartSeries";

import "../../styles/Admin/Dashboard.css";
import "../../styles/Admin/DashboardCard.css";

const money = (v) => `₹${Number(v || 0).toLocaleString("en-IN")}`;

// "2026-09-22" -> "22 Sep 2026" (parsed by parts so no timezone shift).
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const bizDateLabel = (ymd) => {
  if (!ymd) return "";
  const [y, m, d] = String(ymd).split("-").map(Number);
  return y && m && d ? `${d} ${MONTHS[m - 1]} ${y}` : String(ymd);
};

function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [summary, setSummary] = useState({});
  const [topItems, setTopItems] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [, setHealth] = useState(null);

  const [hideValues, setHideValues] = useState(true);

  const [period, setPeriod] = useState("today");
  const [chartData, setChartData] = useState([]);
  const [chartLoading, setChartLoading] = useState(true);
  const [chartError, setChartError] = useState(false);

  const [waiters, setWaiters] = useState([]);
  const [waiterLoading, setWaiterLoading] = useState(true);
  const [waiterError, setWaiterError] = useState(false);
  const [waiterAt, setWaiterAt] = useState(null);

  const user = authService.getUser();
  const restaurantName =
    summary.restaurant_name || user?.restaurant_name || "Restaurant";

  // background = a silent 15s refresh: DON'T flip `loading`, or every poll
  // flashes the whole dashboard back to skeletons (the "blinking every ~10s").
  const loadCore = useCallback(async (background = false) => {
    if (!background) setLoading(true);
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

  // The waiter board is the live part of this page, so it refreshes on its own,
  // aligned with the dashboard cadence, and again when the tab returns to view.
  // A failure here only affects this section, never the rest of the dashboard.
  const loadWaiters = useCallback(async (background = false) => {
    if (!background) setWaiterLoading(true);
    setWaiterError(false);
    try {
      const res = await getWaiterActivity();
      if (res.data.success) {
        setWaiters(res.data.data || []);
        setWaiterAt(new Date());
      }
    } catch (err) {
      console.error("Waiter activity error:", err);
      setWaiterError(true);
    } finally {
      setWaiterLoading(false);
    }
  }, []);

  // The dashboard loaded once on mount and then never again, so the table-status
  // widget, the recent-orders list and the sales figures all froze at whatever
  // was true when the page opened — an admin watching the floor saw nothing
  // change. Refresh on the same 15s cadence the rest of the app polls at, and
  // again whenever the tab is brought back to the front.
  useEffect(() => {
    loadCore();

    const timer = setInterval(() => loadCore(true), 15000);

    const refreshOnReturn = () => {
      if (document.visibilityState === "visible") loadCore(true);
    };
    document.addEventListener("visibilitychange", refreshOnReturn);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshOnReturn);
    };
  }, [loadCore]);

  useEffect(() => {
    loadChart(period);
  }, [period, loadChart]);

  useEffect(() => {
    loadWaiters();

    const timer = setInterval(() => loadWaiters(true), 15000);

    const refreshOnReturn = () => {
      if (document.visibilityState === "visible") loadWaiters(true);
    };
    document.addEventListener("visibilitychange", refreshOnReturn);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshOnReturn);
    };
  }, [loadWaiters]);

  const cardData = [
    {
      title: "Today's Sales",
      value: hideValues ? "₹••••••" : money(summary.total_sales),
      sub: "Paid orders today",
      icon: "FaRupeeSign",
      accent: "#2563EB"
    },
    {
      title: "Today's Orders",
      value: hideValues ? "••" : Number(summary.total_orders || 0),
      sub: "Orders created today",
      icon: "FaClipboardList",
      accent: "#16A34A"
    },
    {
      title: "Payment Collection",
      value: hideValues ? "₹••••••" : money(summary.total_collection),
      sub: "Collected via all methods",
      icon: "FaMoneyBillWave",
      accent: "#8B5CF6"
    },
    {
      title: "Tables",
      value: hideValues
        ? "•• / ••"
        : `${Number(summary.occupied_tables || 0)} / ${Number(summary.total_tables || 0)}`,
      sub: "Tables occupied",
      icon: "FaUtensils",
      accent: "#F59E0B"
    },
    {
      title: "This Week's Sales",
      value: hideValues ? "₹••••••" : money(summary.week_sales),
      sub: "Paid orders this week",
      icon: "FaChartLine",
      accent: "#0EA5E9"
    },
    {
      title: "This Month's Sales",
      value: hideValues ? "₹••••••" : money(summary.month_sales),
      sub: "Paid orders this month",
      icon: "FaChartPie",
      accent: "#EC4899"
    }
  ];

  return (
    <AdminLayout>
      <div className="dashboard-content ad-dashboard">

        {/* Page title */}
        <div className="ad-heading">
          <div>
            <h1>Welcome back, {restaurantName} Owner</h1>
            <p>Here&rsquo;s what&rsquo;s happening at {restaurantName} today.</p>
            {summary.today_business_date && (
              <p
                className="ad-heading-day"
                style={{
                  marginTop: 6, fontSize: 13, fontWeight: 700,
                  color: Number(summary.day_is_open) ? "#2563eb" : "#b45309"
                }}
              >
                {Number(summary.day_is_open)
                  ? `Showing: ${bizDateLabel(summary.today_business_date)} (today)`
                  : `Showing: ${bizDateLabel(summary.today_business_date)} — day closed. Open the shop to start a new day.`}
              </p>
            )}
          </div>

          <button
            type="button"
            className={`ad-hide-toggle${hideValues ? " ad-hide-toggle-active" : ""}`}
            onClick={() => setHideValues(!hideValues)}
            title={hideValues ? "Show dashboard figures" : "Hide dashboard figures"}
          >
            {hideValues ? <FaEyeSlash /> : <FaEye />}
            <span>{hideValues ? "Show figures" : "Hide figures"}</span>
          </button>
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

            {/* Waiter activity */}
            <div className="ad-grid">
              <div className="ad-col ad-col-12">
                <WaiterActivity
                  waiters={waiters}
                  loading={waiterLoading}
                  error={waiterError}
                  updatedAt={waiterAt}
                  onRetry={loadWaiters}
                />
              </div>
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
                <QuickActions />
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

            {/* Payment Summary + system status */}
            <div className="ad-grid ad-grid-bottom">
              <div className="ad-col ad-col-6">
                <PaymentSummary summary={summary} loading={loading} />
              </div>

              <div className="ad-col ad-col-6">
                <PrinterStatus />
              </div>
            </div>
          </>
        )}

      </div>
    </AdminLayout>
  );
}

export default Dashboard;