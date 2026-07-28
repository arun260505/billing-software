import React from "react";
import {
    FaListAlt,
    FaCheckCircle,
    FaTimesCircle,
    FaLayerGroup
} from "react-icons/fa";

function CategoryCards({ summary }) {

    const cards = [
        {
            title: "Total Categories",
            value: summary.total || 0,
            icon: <FaListAlt />,
            color: "#2563eb"
        },
        {
            title: "Active",
            value: summary.active || 0,
            icon: <FaCheckCircle />,
            color: "#16a34a"
        },
        {
            title: "Inactive",
            value: summary.inactive || 0,
            icon: <FaTimesCircle />,
            color: "#dc2626"
        },
        {
            title: "Display Order",
            value: summary.total || 0,
            icon: <FaLayerGroup />,
            color: "#7c3aed"
        }
    ];

    return (

        <div className="category-cards">

            {cards.map((card, index) => (

                <div
                    className="category-card"
                    key={index}
                >

                    <div
                        className="category-card-icon"
                        style={{ background: card.color }}
                    >
                        {card.icon}
                    </div>

                    <div className="category-card-info">

                        <h3>{card.value}</h3>

                        <p>{card.title}</p>

                    </div>

                </div>

            ))}

        </div>

    );

}

export default CategoryCards;