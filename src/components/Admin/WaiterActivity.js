import React from "react";
import { FaUserTie } from "react-icons/fa";
import "../../styles/Admin/WaiterActivity.css";

const money = (v) => `₹${Number(v || 0).toLocaleString("en-IN")}`;

const timeOf = (v) =>
  v ? new Date(v).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";

// Today, per staff member who takes orders (waiters + cashiers): orders, items,
// bills and sales (paid orders), refreshed on the dashboard's own cadence. The
// top earner so far is highlighted.
const roleLabel = (r) => (r === "cashier" ? "Cashier" : r === "waiter" ? "Waiter" : (r || "Staff"));

function WaiterActivity({ waiters = [], loading = false, error = false, updatedAt = null, onRetry }) {
  const top = waiters.find((w) => Number(w.orders) > 0);

  return (
    <div className="ad-card ad-wa">
      <div className="ad-card-head">
        <div>
          <h3>Staff Activity</h3>
          <span className="ad-card-sub">Today&rsquo;s orders and sales handled by each waiter &amp; cashier</span>
        </div>
        <span className={`ad-wa-live${error ? " ad-wa-stale" : ""}`} title="Refreshes automatically">
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
          <span className="ad-skel ad-skel-line" />
        </div>
      ) : error ? (
        <div className="ad-state">
          <div className="ad-state-icon">
            <FaUserTie />
          </div>
          <h3>Unable to load waiter activity</h3>
          <p>Check your connection and try again.</p>
          <button className="ad-retry" onClick={onRetry}>Retry</button>
        </div>
      ) : waiters.length === 0 ? (
        <div className="ad-state">
          <div className="ad-state-icon">
            <FaUserTie />
          </div>
          <p>No staff activity today.</p>
        </div>
      ) : (
        <div className="ad-wa-scroll">
          <table className="ad-wa-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th className="num">Orders</th>
                <th className="num">Items</th>
                <th className="num">Bills</th>
                <th className="num">Sales</th>
                <th>Last Order</th>
              </tr>
            </thead>
            <tbody>
              {waiters.map((w) => {
                const isTop = top && top.id === w.id;
                return (
                  <tr key={w.id}>
                    <td>
                      <span className="ad-wa-name">{w.full_name}</span>
                      {isTop && <span className="ad-wa-top">Top today</span>}
                    </td>
                    <td><span className="ad-wa-role">{roleLabel(w.role)}</span></td>
                    <td className="num">{Number(w.orders || 0)}</td>
                    <td className="num">
                      {Number(w.items || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                    </td>
                    <td className="num">{Number(w.bills || 0)}</td>
                    <td className="num">{money(w.sales)}</td>
                    <td>{timeOf(w.last_order_at)}</td>
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

export default WaiterActivity;