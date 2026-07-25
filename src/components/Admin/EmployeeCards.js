import React from "react";
import {
    FaUsers,
    FaUserCheck,
    FaCashRegister,
    FaConciergeBell,
    FaUtensils
} from "react-icons/fa";

function EmployeeCards({ summary }) {

    const cards = [

        {
            title: "Total Employees",
            value: summary.total || 0,
            icon: <FaUsers />,
            color: "#2563EB"
        },

        {
            title: "Active Employees",
            value: summary.active || 0,
            icon: <FaUserCheck />,
            color: "#16A34A"
        },

        {
            title: "Cashiers",
            value: summary.cashiers || 0,
            icon: <FaCashRegister />,
            color: "#F59E0B"
        },

        {
            title: "Waiters",
            value: summary.waiters || 0,
            icon: <FaConciergeBell />,
            color: "#8B5CF6"
        },

        {
            title: "Kitchen Staff",
            value: summary.kitchen_staff || 0,
            icon: <FaUtensils />,
            color: "#EF4444"
        }

    ];

    return (

        <div className="employee-cards">

            {

                cards.map((card, index) => (

                    <div
                        key={index}
                        className="employee-card"
                        style={{
                            borderLeft: `5px solid ${card.color}`
                        }}
                    >

                        <div className="employee-card-top">

                            <div>

                                <p>{card.title}</p>

                                <h2>{card.value}</h2>

                            </div>

                            <div
                                className="employee-icon"
                                style={{
                                    background: card.color
                                }}
                            >

                                {card.icon}

                            </div>

                        </div>

                    </div>

                ))

            }

        </div>

    );

}

export default EmployeeCards;