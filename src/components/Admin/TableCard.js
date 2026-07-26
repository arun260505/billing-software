import React from "react";
import "../../styles/Admin/Table.css";

const statusColors = {
    Available: "#22c55e",
    Occupied: "#ef4444",
    Reserved: "#f59e0b",
    Billing: "#3b82f6",
    Cleaning: "#6b7280"
};

const TableCard = ({ table }) => {

    return (
        <div
            className="table-card"
            style={{
                borderColor: statusColors[table.status] || "#ddd"
            }}
        >
            <div className="table-card-header">
                <h3>{table.table_name}</h3>

                <span
                    className="status-badge"
                    style={{
                        background: statusColors[table.status] || "#ddd"
                    }}
                >
                    {table.status}
                </span>
            </div>

            <div className="table-info">

                <p>
                    <strong>Seats :</strong> {table.capacity}
                </p>

                <p>
                    <strong>Location :</strong> {table.location}
                </p>

                {table.current_bill > 0 && (
                    <p>
                        <strong>Bill :</strong> ₹{table.current_bill}
                    </p>
                )}

                {table.reservation_time && (
                    <p>
                        <strong>Reserved :</strong>{" "}
                        {new Date(table.reservation_time).toLocaleTimeString()}
                    </p>
                )}

            </div>

        </div>
    );
};

export default TableCard;