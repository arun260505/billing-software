import React from "react";
import { FaReceipt, FaCheckCircle, FaUtensils, FaShoppingBag } from "react-icons/fa";

function ChargeCards({ summary }) {

    const cards = [
        {
            title: "Total Charges",
            value: summary.total || 0,
            icon: <FaReceipt />,
            color: "#2563EB"
        },
        {
            title: "Active Charges",
            value: summary.active || 0,
            icon: <FaCheckCircle />,
            color: "#16A34A"
        },
        {
            title: "Dine-in Charges",
            value: summary.dinein_count || 0,
            icon: <FaUtensils />,
            color: "#F59E0B"
        },
        {
            title: "Takeaway Charges",
            value: summary.takeaway_count || 0,
            icon: <FaShoppingBag />,
            color: "#8B5CF6"
        }
    ];

    return (
        <div className="charges-summary">
            {cards.map((card, i) => (
                <div className="charge-summary-card" key={i}>
                    <div className="card-icon" style={{ background: card.color }}>
                        {card.icon}
                    </div>
                    <div className="card-info">
                        <h3>{card.value}</h3>
                        <p>{card.title}</p>
                    </div>
                </div>
            ))}
        </div>
    );
}

export default ChargeCards;
