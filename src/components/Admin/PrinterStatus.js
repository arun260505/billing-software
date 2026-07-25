import React from "react";
import "../../styles/Admin/PrinterStatus.css";

function PrinterStatus() {
  return (
    <div className="printer-card">
      <h3>Printer Status</h3>

      <div className="printer-row">
        <span>Billing Printer</span>
        <span className="connected">Connected</span>
      </div>

      <div className="printer-row">
        <span>Kitchen Printer</span>
        <span className="connected">Connected</span>
      </div>

      <div className="printer-row">
        <span>Receipt Printer</span>
        <span className="disconnected">Disconnected</span>
      </div>
    </div>
  );
}

export default PrinterStatus;