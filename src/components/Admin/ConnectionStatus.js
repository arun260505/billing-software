import React from "react";
import { FaWifi, FaServer, FaDatabase, FaSyncAlt, FaClock } from "react-icons/fa";
import "../../styles/Admin/ConnectionStatus.css";

const timeOf = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
};

function ConnectionStatus({ health = null, loading = false, lastSync = null, onRetry }) {

  const online = typeof navigator !== "undefined" ? navigator.onLine : true;
  const backend = Boolean(health);
  const db = Boolean(health && health.db);

  const rows = [
    {
      icon: <FaWifi />,
      label: "Internet",
      state: online ? "Online" : "Offline",
      ok: online
    },
    {
      icon: <FaServer />,
      label: "Backend",
      state: backend ? "Connected" : "Disconnected",
      ok: backend
    },
    {
      icon: <FaDatabase />,
      label: "Database",
      state: db ? "Connected" : "Disconnected",
      ok: db
    },
    {
      icon: <FaSyncAlt />,
      label: "Pending Sync",
      state: "0 Bills",
      ok: true
    },
    {
      icon: <FaClock />,
      label: "Last Sync",
      state: timeOf(lastSync),
      ok: true
    }
  ];

  return (
    <div className="ad-card ad-conn">
      <div className="ad-card-head">
        <div>
          <h3>Connection Status</h3>
          <span className="ad-card-sub">System connectivity</span>
        </div>
      </div>

      {loading && !health ? (
        <div className="ad-skel-lines">
          <span className="ad-skel ad-skel-line" />
          <span className="ad-skel ad-skel-line" />
          <span className="ad-skel ad-skel-line" />
          <span className="ad-skel ad-skel-line" />
        </div>
      ) : (
        <div className="ad-conn-list">
          {rows.map((r) => (
            <div className="ad-conn-row" key={r.label}>
              <div className="ad-conn-left">
                <span className={`ad-status-light ${r.ok ? "ok" : "down"}`} />
                <span className="ad-conn-label">{r.label}</span>
              </div>
              <span className={`ad-conn-state ${r.ok ? "ok" : "down"}`}>
                {r.state}
              </span>
            </div>
          ))}
        </div>
      )}

      {!loading && !backend && (
        <button className="ad-retry ad-conn-retry" onClick={onRetry}>
          Reconnect
        </button>
      )}
    </div>
  );
}

export default ConnectionStatus;