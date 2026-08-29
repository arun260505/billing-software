import React from "react";
import { FaPrint } from "react-icons/fa";
import "../../styles/Admin/PrinterStatus.css";

// There is no printer registry in the backend today, so these statuses are the
// same values the previous dashboard showed — kept so existing printing
// behaviour is untouched until a printer-management source exists.
const PRINTERS = [
  { name: "Billing Printer", status: "Connected" },
  { name: "Kitchen Printer", status: "Connected" },
  { name: "Receipt Printer", status: "Disconnected" }
];

function PrinterStatus() {
  return (
    <div className="ad-card ad-printer">
      <div className="ad-card-head">
        <div>
          <h3>Printer Status</h3>
          <span className="ad-card-sub">Device connectivity</span>
        </div>
        <span className="ad-printer-icon"><FaPrint /></span>
      </div>

      <div className="ad-printer-list">
        {PRINTERS.map((p) => {
          const connected = p.status === "Connected";
          return (
            <div className="ad-printer-row" key={p.name}>
              <div className="ad-printer-left">
                <span
                  className={`ad-status-light ${connected ? "ok" : "down"}`}
                />
                <span className="ad-printer-name">{p.name}</span>
              </div>
              <span className={`ad-printer-state ${connected ? "ok" : "down"}`}>
                {p.status}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PrinterStatus;