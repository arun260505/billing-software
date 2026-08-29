import React from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { FaFire } from "react-icons/fa";
import "../../styles/Admin/TopSelling.css";

const inr = (v) => `₹${Number(v || 0).toLocaleString("en-IN")}`;

const COLORS = ["#2563EB", "#10B981", "#F59E0B", "#8B5CF6", "#EF4444", "#94A3B8"];

function TopItemTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0].payload;
  return (
    <div className="ad-top-tip">
      <div className="ad-top-tip-name">{label}</div>
      <div className="ad-top-tip-row">{Number(item.total_qty)} sold</div>
      <div className="ad-top-tip-row">{inr(item.total_sales)} revenue</div>
    </div>
  );
}

function TopSelling({ items = [], loading = false }) {

  if (loading) {
    return (
      <div className="ad-card ad-top">
        <div className="ad-card-head">
          <h3>Top Selling Items</h3>
          <span className="ad-card-sub">Best sellers by quantity</span>
        </div>
        <div className="ad-skel ad-skel-block" />
        <div className="ad-skel-lines">
          <span className="ad-skel ad-skel-line" />
          <span className="ad-skel ad-skel-line" />
          <span className="ad-skel ad-skel-line" />
          <span className="ad-skel ad-skel-line" />
        </div>
      </div>
    );
  }

  // Top 5 items; everything after that folds into "Other".
  const top = items.slice(0, 5);
  const rest = items.slice(5);

  let chartData = top.map((it) => ({
    item_name: it.item_name,
    total_qty: Number(it.total_qty || 0),
    total_sales: Number(it.total_sales || 0)
  }));

  if (rest.length > 0) {
    chartData.push({
      item_name: "Other",
      total_qty: rest.reduce((s, r) => s + Number(r.total_qty || 0), 0),
      total_sales: rest.reduce((s, r) => s + Number(r.total_sales || 0), 0)
    });
  }

  chartData = chartData.filter((d) => d.total_qty > 0);

  const totalQty = chartData.reduce((s, d) => s + d.total_qty, 0);

  return (
    <div className="ad-card ad-top">
      <div className="ad-card-head">
        <h3>Top Selling Items</h3>
        <span className="ad-card-sub">Best sellers by quantity</span>
      </div>

      {chartData.length === 0 ? (
        <div className="ad-state">
          <div className="ad-state-icon"><FaFire /></div>
          <p>No sales recorded yet.</p>
        </div>
      ) : (
        <>
          <div className="ad-top-donut">
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="total_qty"
                  nameKey="item_name"
                  innerRadius={62}
                  outerRadius={88}
                  paddingAngle={3}
                  strokeWidth={0}
                  animationDuration={600}
                >
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<TopItemTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="ad-top-center">
              <strong>{totalQty}</strong>
              <span>Items sold</span>
            </div>
          </div>

          <div className="ad-top-legend">
            {chartData.map((d, i) => (
              <div className="ad-top-row" key={d.item_name}>
                <span
                  className="ad-dot"
                  style={{ background: COLORS[i % COLORS.length] }}
                />
                <span className="ad-top-name">{d.item_name}</span>
                <span className="ad-top-meta">
                  {totalQty > 0 ? Math.round((d.total_qty / totalQty) * 100) : 0}
                  % · {inr(d.total_sales)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default TopSelling;