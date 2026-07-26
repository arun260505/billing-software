import React from "react";
import {
    FaChair,
    FaCheckCircle,
    FaUtensils,
    FaCalendarAlt,
    FaReceipt,
    FaBroom
} from "react-icons/fa";

import "../../../styles/Admin/Tables/TableStats.css";

const TableStats = ({ stats }) => {

    const cards = [
        {
            title: "Total Tables",
            value: stats?.totalTables ?? 0,
            icon: <FaChair />,
            className: "blue"
        },
        {
            title: "Available",
            value: stats?.available ?? 0,
            icon: <FaCheckCircle />,
            className: "green"
        },
        {
            title: "Occupied",
            value: stats?.occupied ?? 0,
            icon: <FaUtensils />,
            className: "orange"
        },
        {
            title: "Reserved",
            value: stats?.reserved ?? 0,
            icon: <FaCalendarAlt />,
            className: "purple"
        },
        {
            title: "Billing",
            value: stats?.billing ?? 0,
            icon: <FaReceipt />,
            className: "red"
        },
        {
            title: "Cleaning",
            value: stats?.cleaning ?? 0,
            icon: <FaBroom />,
            className: "gray"
        }
    ];

    return (

        <div className="table-stats">

            {cards.map((card, index) => (

                <div
                    key={index}
                    className={`stat-card ${card.className}`}
                >

                    <div className="stat-icon">
                        {card.icon}
                    </div>

                    <div className="stat-details">
                        <h3>{card.value}</h3>
                        <span>{card.title}</span>
                    </div>

                </div>

            ))}

        </div>

    );

};

export default TableStats;