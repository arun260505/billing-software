import React from "react";
import { FaEllipsisV } from "react-icons/fa";
import TableIllustration from "./TableIllustration";

import "../../../styles/Admin/Tables/TableCard.css";

const TableCard = ({ table }) => {

    const getStatusClass = (status) => {

        switch (status) {

            case "Available":
                return "available";

            case "Occupied":
                return "occupied";

            case "Reserved":
                return "reserved";

            case "Billing":
                return "billing";

            case "Cleaning":
                return "cleaning";

            default:
                return "";

        }

    };

    return (

    <div className={`table-card ${getStatusClass(table.status)}`}>

        <button className="menu-btn">
            <FaEllipsisV />
        </button>

        <TableIllustration
    capacity={table.capacity}
    status={table.status}
/>

        <h3 className="table-name">
            {table.table_name}
        </h3>

        <p className="table-seats">
            {table.capacity} Seats
        </p>

        <span className={`status-badge ${getStatusClass(table.status)}`}>
            {table.status}
        </span>

        {table.status === "Billing" && (

            <div className="table-bill">

                ${Number(table.current_bill).toFixed(2)}

            </div>

        )}

        {table.status === "Reserved" && table.reservation_time && (

            <div className="table-time">

                {new Date(table.reservation_time).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit"
                })}

            </div>

        )}

    </div>

);
};

export default TableCard;