import React from "react";
import {
    FaUsers,
    FaMapMarkerAlt,
    FaMoneyBillWave,
    FaClock,
    FaEllipsisV
} from "react-icons/fa";

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

        <div className="table-card">

            <div className="table-card-header">

                <div>

                    <h3>{table.table_name}</h3>

                    <span className={`status-badge ${getStatusClass(table.status)}`}>
                        {table.status}
                    </span>

                </div>

                <button className="menu-btn">
                    <FaEllipsisV />
                </button>

            </div>

            <div className="table-info">

                <p>
                    <FaUsers />
                    <span>{table.capacity} Seats</span>
                </p>

                <p>
                    <FaMapMarkerAlt />
                    <span>{table.location}</span>
                </p>

                <p>
                    <FaMoneyBillWave />
                    <span>${Number(table.current_bill).toFixed(2)}</span>
                </p>

                {table.reservation_time && (

                    <p>

                        <FaClock />

                        <span>
                            {new Date(table.reservation_time).toLocaleString()}
                        </span>

                    </p>

                )}

            </div>

        </div>

    );

};

export default TableCard;