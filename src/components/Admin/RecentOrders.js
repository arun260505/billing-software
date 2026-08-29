import React from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowRight, FaClipboardList } from "react-icons/fa";
import "../../styles/Admin/Table.css";

const money = (v) => `₹${Number(v || 0).toLocaleString("en-IN")}`;

const STATUS_LABELS = {
  Pending: "New",
  Confirmed: "Confirmed",
  Preparing: "Preparing",
  Ready: "Ready",
  Served: "Served",
  Completed: "Completed",
  Cancelled: "Cancelled"
};

const TYPE_ICONS = {
  "Dine-In": "🍽",
  Takeaway: "📦",
  Delivery: "🛵"
};

function RecentOrders({ orders = [], loading = false, onRetry }) {
  const navigate = useNavigate();

  const goToOrders = () => navigate("/admin/orders");

  return (
    <div className="ad-card ad-recent">
      <div className="ad-card-head">
        <div>
          <h3>Recent Orders</h3>
          <span className="ad-card-sub">Latest activity across the restaurant</span>
        </div>
        <button className="ad-view-all" onClick={goToOrders}>
          View All <FaArrowRight />
        </button>
      </div>

      {loading ? (
        <div className="ad-recent-loading">
          {[0, 1, 2, 3, 4].map((i) => (
            <div className="ad-skel-row" key={i}>
              <span className="ad-skel ad-skel-line" />
              <span className="ad-skel ad-skel-line" />
              <span className="ad-skel ad-skel-line" />
              <span className="ad-skel ad-skel-line" />
            </div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="ad-state">
          <div className="ad-state-icon"><FaClipboardList /></div>
          <p>No orders yet.</p>
          <button className="ad-retry" onClick={onRetry}>Refresh</button>
        </div>
      ) : (
        <div className="ad-recent-scroll">
          <table className="ad-recent-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Time</th>
                <th>Type</th>
                <th className="num">Items</th>
                <th>Amount</th>
                <th>Payment</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const status = order.order_status || "";
                const type = order.order_type || "—";
                return (
                  <tr key={order.id} onClick={goToOrders} title="Open Orders">
                    <td className="ad-recent-id">#{order.id}</td>
                    <td>
                      {new Date(order.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </td>
                    <td>
                      <span className="ad-recent-type">
                        {TYPE_ICONS[type] && (
                          <span className="ad-recent-type-icon">{TYPE_ICONS[type]}</span>
                        )}
                        {type}
                      </span>
                    </td>
                    <td className="num">{Number(order.total_items || 0)}</td>
                    <td className="ad-recent-amt">{money(order.grand_total)}</td>
                    <td>
                      {order.payment_method ? (
                        <span className={`ad-pay-chip ad-pay-${String(order.payment_method).toLowerCase().replace(/\s+/g, "-")}`}>
                          {order.payment_method}
                        </span>
                      ) : (
                        <span className="ad-pay-chip ad-pay-none">—</span>
                      )}
                    </td>
                    <td>
                      <span className={`ad-status ad-st-${String(status).toLowerCase()}`}>
                        {STATUS_LABELS[status] || status}
                      </span>
                    </td>
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

export default RecentOrders;