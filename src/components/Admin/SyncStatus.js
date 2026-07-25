import React from "react";
import "../../styles/Admin/SyncStatus.css";

function SyncStatus() {
  return (
    <div className="sync-card">

      <h3>Connection Status</h3>

      <div className="sync-row">
        <span>Internet</span>
        <span className="online">Online</span>
      </div>

      <div className="sync-row">
        <span>Pending Sync</span>
        <span className="warning">3 Bills</span>
      </div>

      <div className="sync-row">
        <span>Last Sync</span>
        <span>11:42 AM</span>
      </div>

    </div>
  );
}

export default SyncStatus;