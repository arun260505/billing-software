import React from "react";
import "../../styles/Admin/NotificationPanel.css";

function NotificationPanel() {
  const notifications = [
    {
      id: 1,
      type: "order",
      message: "New Order #105 received",
      time: "2 min ago"
    },
    {
      id: 2,
      type: "stock",
      message: "Paneer stock is running low",
      time: "10 min ago"
    },
    {
      id: 3,
      type: "subscription",
      message: "Subscription expires in 5 days",
      time: "Today"
    }
  ];

  return (
    <div className="notification-card">
      <div className="notification-header">
        <h3>Notifications</h3>
        <span>{notifications.length}</span>
      </div>

      {notifications.map((item) => (
        <div key={item.id} className="notification-item">
          <div className={`notification-dot ${item.type}`}></div>

          <div className="notification-content">
            <p>{item.message}</p>
            <small>{item.time}</small>
          </div>
        </div>
      ))}
    </div>
  );
}

export default NotificationPanel;