import React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from "recharts";
import { FaChartLine } from "react-icons/fa";
import "../../styles/Admin/Chart.css";

const PERIODS = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" }
];

const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const compactAxis = (v) => {
  const n = Number(v || 0);
  if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${n}`;
};

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="ad-chart-tip">
      <div className="ad-chart-tip-label">{label}</div>
      <div className="ad-chart-tip-value">{inr(payload[0].value)}</div>
    </div>
  );
}

function SalesChart({
  data = [],
  loading = false,
  error = false,
  period = "today",
  onPeriodChange,
  onRetry
}) {

  const hasSales = data.some((d) => Number(d.sales) > 0);

  return (
    <div className="ad-card ad-chart">
      <div className="ad-card-head">
        <div>
          <h3>Sales Overview</h3>
          <span className="ad-card-sub">Revenue over the selected period</span>
        </div>

        <div className="ad-period-switch">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              className={period === p.key ? "active" : ""}
              onClick={() => onPeriodChange && onPeriodChange(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="ad-chart-body">
        {loading ? (
          <div className="ad-chart-loading">
            <span className="ad-skel ad-skel-block" />
          </div>
        ) : error ? (
          <div className="ad-state">
            <div className="ad-state-icon"><FaChartLine /></div>
            <p>Unable to load sales data.</p>
            <button className="ad-retry" onClick={onRetry}>Retry</button>
          </div>
        ) : !hasSales ? (
          <div className="ad-state">
            <div className="ad-state-icon"><FaChartLine /></div>
            <p>No sales data available yet.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart
              data={data}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="adAreaFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563EB" stopOpacity={0.24} />
                  <stop offset="100%" stopColor="#2563EB" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 6" stroke="#EEF2F7" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: "#9CA3AF" }}
                tickLine={false}
                axisLine={{ stroke: "#EEF2F7" }}
                minTickGap={28}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "#9CA3AF" }}
                tickLine={false}
                axisLine={false}
                width={52}
                tickFormatter={compactAxis}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#C7D2FE", strokeWidth: 1 }} />
              <Area
                type="monotone"
                dataKey="sales"
                stroke="#2563EB"
                strokeWidth={2.5}
                fill="url(#adAreaFill)"
                animationDuration={600}
                dot={data.length <= 25 ? { r: 3, fill: "#2563EB", strokeWidth: 0 } : false}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export default SalesChart;