import React, { useState, useEffect } from "react";
import { FaEllipsisV, FaEdit, FaTrash } from "react-icons/fa";
import TableIllustration from "./TableIllustration";

import "../../../styles/Admin/Tables/TableCard.css";

const TableCard = ({ table, onEdit, onDelete }) => {

    const [menuOpen, setMenuOpen] = useState(false);

    useEffect(() => {

        const handleClick = (e) => {

            if (!e.target.closest(".table-card-menu")) {

                setMenuOpen(false);

            }

        };

        document.addEventListener("mousedown", handleClick);

        return () => document.removeEventListener("mousedown", handleClick);

    }, []);

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

        <div className="table-card-menu">

            <button
                className="menu-btn"
                onClick={() => setMenuOpen(!menuOpen)}
            >
                <FaEllipsisV />
            </button>

            {menuOpen && (

                <div className="action-dropdown">

                    <button
                        onClick={() => {
                            setMenuOpen(false);
                            onEdit(table);
                        }}
                    >
                        <FaEdit /> Edit Table
                    </button>

                    <button
                        className="danger"
                        onClick={() => {
                            setMenuOpen(false);
                            onDelete(table);
                        }}
                    >
                        <FaTrash /> Delete Table
                    </button>

                </div>

            )}

        </div>

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