import React, { useEffect, useState } from "react";
import { FaSignOutAlt } from "react-icons/fa";
import { isSalon } from "../../utils/businessType";
import { DayStatus } from "../DayControl";
import "../../styles/Admin/Header.css";

function Header() {

    const salon = isSalon();

    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const timeString = now.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true
    });

    const dateString = now.toLocaleDateString("en-US", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
    });

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "/";
    };

    return (
        <header className="admin-header">
            <div className="header-left">
                <h2>{salon ? "Salon Dashboard" : "Admin Dashboard"}</h2>
                <p>Welcome back!</p>
            </div>

            <div className="header-clock">
                <span className="clock-time">{timeString}</span>
                <span className="clock-date">{dateString}</span>
            </div>

            <div className="header-right">
                <DayStatus />

                <button className="logout-btn" onClick={handleLogout}>
                    <FaSignOutAlt />
                    <span>Logout</span>
                </button>

                <div className="admin-profile">
                    <div className="profile-image">
                        {salon ? "O" : "A"}
                    </div>

                    <div className="profile-info">
                        <h4>{salon ? "Owner" : "Admin"}</h4>
                        <span>{salon ? "Salon Owner" : "Restaurant Admin"}</span>
                    </div>
                </div>
            </div>
        </header>
    );
}

export default Header;
