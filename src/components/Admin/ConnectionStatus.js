import React from "react";
import { FaWifi, FaServer, FaDatabase, FaClock } from "react-icons/fa";
import "../../styles/Admin/ConnectionStatus.css";

// Real cloud-sync freshness: green under 2 min, amber under 15, red beyond.
// null = no local node has ever synced (pure cloud deployment) -> neutral "—".
const freshnessOf = (syncAt) => {
  if (!syncAt) return { text: "—", ok: true, neutral: true };
  const mins = Math.floor((Date.now() - new Date(syncAt).getTime()) / 60000);
  let text;
  if (mins < 1) text = "just now";
  else if (mins < 60) text = `${mins}m ago`;
  else if (mins < 1440) text = `${Math.floor(mins / 60)}h ago`;
  else text = `${Math.floor(mins / 1440)}d ago`;
  return { text, ok: mins < 15, neutral: false };
};

function ConnectionStatus({ health = null, loading = false, syncAt = null, onRetry }) {

  const online = typeof navigator !== "undefined" ? navigator.onLine : true;
  const backend = Boolean(health);
  const db = Boolean(health && health.db);
  const sync = freshnessOf(syncAt);

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
      icon: <FaClock />,
      label: "Last Sync",
      state: sync.text,
      ok: sync.ok,
      neutral: sync.neutral
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
                <span className={`ad-status-light ${r.neutral ? "" : r.ok ? "ok" : "down"}`} />
                <span className="ad-conn-label">{r.label}</span>
              </div>
              <span className={`ad-conn-state ${r.neutral ? "" : r.ok ? "ok" : "down"}`}>
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