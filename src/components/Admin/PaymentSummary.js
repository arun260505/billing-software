import React from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { FaRupeeSign } from "react-icons/fa";
import "../../styles/Admin/PaymentSummary.css";

const money = (v) => `₹${Number(v || 0).toLocaleString("en-IN")}`;

const METHOD_META = [
  { key: "cash", label: "Cash" },
  { key: "upi", label: "GPay / UPI" },
  { key: "card", label: "Card" },
  { key: "wallet", label: "Wallet" },
  { key: "other", label: "Other" }
];

const COLORS = {
  cash: "#10B981",
  upi: "#2563EB",
  card: "#8B5CF6",
  wallet: "#F59E0B",
  other: "#64748B"
};

function PaymentSummary({ summary = {}, loading = false }) {

  const rows = METHOD_META
    .map((m) => ({
      key: m.key,
      label: m.label,
      amount: Number(summary[`${m.key}_amount`] || 0)
    }))
    .filter((r) => r.amount > 0);

  const total = Number(summary.total_collection || 0);

  if (loading) {
    return (
      <div className="ad-card ad-pay">
        <div className="ad-card-head">
          <h3>Payment Summary</h3>
        </div>
        <div className="ad-skel ad-skel-block" />
        <div className="ad-skel-lines">
          <span className="ad-skel ad-skel-line" />
          <span className="ad-skel ad-skel-line" />
          <span className="ad-skel ad-skel-line" />
        </div>
      </div>
    );
  }

  return (
    <div className="ad-card ad-pay">
      <div className="ad-card-head">
        <h3>Payment Summary</h3>
        <span className="ad-card-sub">Today&rsquo;s collections</span>
      </div>

      {total <= 0 || rows.length === 0 ? (
        <div className="ad-state">
          <div className="ad-state-icon"><FaRupeeSign /></div>
          <p>No payments collected yet today.</p>
        </div>
      ) : (
        <>
          <div className="ad-pay-donut">
            <ResponsiveContainer width="100%" height={190}>
              <PieChart>
                <Pie
                  data={rows}
                  dataKey="amount"
                  nameKey="label"
                  innerRadius={62}
                  outerRadius={86}
                  paddingAngle={3}
                  strokeWidth={0}
                  animationDuration={600}
                >
                  {rows.map((r) => (
                    <Cell key={r.key} fill={COLORS[r.key] || "#94A3B8"} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [money(value), name]}
                  contentStyle={{
                    borderRadius: 10,
                    border: "1px solid #E2E8F0",
                    boxShadow: "0 8px 20px rgba(15,23,42,.12)",
                    fontSize: 13
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="ad-pay-center">
              <strong>{money(total)}</strong>
              <span>TOTAL COLLECTION</span>
            </div>
          </div>

          <div className="ad-pay-list">
            {rows.map((r) => (
              <div className="ad-pay-row" key={r.key}>
                <span
                  className="ad-dot"
                  style={{ background: COLORS[r.key] || "#94A3B8" }}
                />
                <span className="ad-pay-label">{r.label}</span>
                <span className="ad-pay-amt">{money(r.amount)}</span>
                <span className="ad-pay-pct">
                  {Math.round((r.amount / total) * 100)}%
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default PaymentSummary;