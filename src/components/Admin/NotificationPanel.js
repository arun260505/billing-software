import React from "react";
import {
  FaReceipt,
  FaClipboardList,
  FaFire,
  FaBell,
  FaChair
} from "react-icons/fa";
import "../../styles/Admin/NotificationPanel.css";

const timeAgo = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Today";
  const mins = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
};

const iconFor = (type) => {
  switch (type) {
    case "order":
      return <FaClipboardList />;
    case "bill":
      return <FaReceipt />;
    case "kitchen":
      return <FaFire />;
    case "tables":
      return <FaChair />;
    default:
      return <FaBell />;
  }
};

function NotificationPanel({ recentOrders = [], summary = {}, loading = false }) {

  const buildNotifications = () => {
    const list = [];

    // Real events straight from the live order stream.
    const fresh = (recentOrders || [])
      .filter((o) => ["Pending", "Preparing", "Ready"].includes(o.order_status))
      .slice(0, 3);

    fresh.forEach((o) => {
      list.push({
        id: `order-${o.id}`,
        type: "order",
        severity: "info",
        message: `New order #${o.id} received`,
        time: timeAgo(o.created_at)
      });
    });

    const pendingBills = Number(summary.pending_bills || 0);
    if (pendingBills > 0) {
      list.push({
        id: "bills",
        type: "bill",
        severity: "warning",
        message: `${pendingBills} pending bill${pendingBills === 1 ? "" : "s"} awaiting payment`,
        time: "Now"
      });
    }

    const kitchen = Number(summary.kitchen_orders || 0);
    if (kitchen > 0) {
      list.push({
        id: "kitchen",
        type: "kitchen",
        severity: "warning",
        message: `${kitchen} active order${kitchen === 1 ? "" : "s"} in the kitchen`,
        time: "Now"
      });
    }

    const occupied = Number(summary.occupied_tables || 0);
    const total = Number(summary.total_tables || 0);
    if (total > 0 && occupied / total >= 0.8) {
      list.push({
        id: "tables",
        type: "tables",
        severity: "danger",
        message: `${occupied} of ${total} tables occupied`,
        time: "Now"
      });
    }

    return list.slice(0, 6);
  };

  const notifications = loading ? [] : buildNotifications();

  if (loading) {
    return (
      <div className="ad-card ad-notif">
        <div className="ad-card-head">
          <h3>Notifications</h3>
          <span className="ad-notif-count">{notifications.length}</span>
        </div>
        <div className="ad-skel-lines">
          <span className="ad-skel ad-skel-line" />
          <span className="ad-skel ad-skel-line" />
          <span className="ad-skel ad-skel-line" />
        </div>
      </div>
    );
  }

  return (
    <div className="ad-card ad-notif">
      <div className="ad-card-head">
        <div>
          <h3>Notifications</h3>
          <span className="ad-card-sub">Live alerts and events</span>
        </div>
        {notifications.length > 0 && (
          <span className="ad-notif-count">{notifications.length}</span>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="ad-state">
          <div className="ad-state-icon"><FaBell /></div>
          <p>All caught up! No notifications right now.</p>
        </div>
      ) : (
        <div className="ad-notif-list">
          {notifications.map((n) => (
            <div className={`ad-notif-item sev-${n.severity}`} key={n.id}>
              <span className="ad-notif-icon">{iconFor(n.type)}</span>
              <div className="ad-notif-body">
                <p>{n.message}</p>
                <small>{n.time}</small>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default NotificationPanel;