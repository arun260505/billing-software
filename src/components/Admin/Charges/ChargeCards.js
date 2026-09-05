import React from "react";
import { FaReceipt, FaCheckCircle, FaLandmark, FaConciergeBell } from "react-icons/fa";

function ChargeCards({ summary }) {

    // GST and the service charge are charge rows now, so whether this restaurant
    // charges either is answerable at a glance — a zero here means bills go out
    // without that line, which is a legitimate setup and no longer an accident
    // waiting to happen.
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
            title: "Tax / GST Charges",
            value: summary.tax_count || 0,
            icon: <FaLandmark />,
            color: "#F59E0B"
        },
        {
            title: "Service Charges",
            value: summary.service_count || 0,
            icon: <FaConciergeBell />,
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
