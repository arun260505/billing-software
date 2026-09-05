import React, { useState } from "react";
import "../../styles/pages/Auth/Login.css";
import { FaUserAlt, FaLock, FaEye, FaEyeSlash } from "react-icons/fa";
import authService from "../../services/authService";
import { isNativeApp } from "../../services/serverConfig";

// The roles the Android waiter APK is allowed to sign in. Kitchen is included
// because a kitchen display on a spare tablet is a reasonable use of the same
// build; the cashier till and the admin/super-admin back office are not.
const APK_ROLES = ["waiter", "kitchen"];

function Login() {

    const [showPassword, setShowPassword] = useState(false);

    const [loginData, setLoginData] = useState({
        username: "",
        password: ""
    });

    const [loading, setLoading] = useState(false);

    // Set by the api 401 handler just before it redirects here, so an expired
    // shift token explains itself instead of looking like a random logout.
    const [sessionExpired] = useState(() => {
        try {
            const flag = sessionStorage.getItem("inwallz_session_expired") === "1";
            sessionStorage.removeItem("inwallz_session_expired");
            return flag;
        } catch {
            return false;
        }
    });

    const handleChange = (event) => {

        const { name, value } = event.target;

        setLoginData((prevData) => ({
            ...prevData,
            [name]: value
        }));

    };

    const handleLogin = async (event) => {

        event.preventDefault();

        setLoading(true);

        try {

            const response = await authService.login(loginData);

            if (response.success && response.data) {

                const { token, user } = response.data;

                // This APK is the waiter's floor app. The cashier till is a
                // desktop POS — a docked bill panel, printer setup, a settle
                // flow — none of which fits or belongs on a waiter's phone, and
                // signing the till in here would let anyone take money from a
                // handset. Refuse the login rather than store the session.
                if (isNativeApp() && !APK_ROLES.includes(user.role)) {
                    alert(
                        "This app is for waiters. Please use the cashier till on " +
                        "the counter PC to sign in as " + user.role + "."
                    );
                    return;
                }

                localStorage.setItem("token", token);

                localStorage.setItem(
                    "user",
                    JSON.stringify(user)
                );

                switch (user.role) {

                    case "super_admin":
                        window.location.href = "/super_admin";
                        break;

                    case "admin":
                        window.location.href = "/admin";
                        break;

                    case "cashier":
                        window.location.href = "/cashier";
                        break;

                    case "waiter":
                        window.location.href = "/waiter";
                        break;

                    case "kitchen":
                        window.location.href = "/kitchen";
                        break;

                    default:
                        alert("Unknown user role.");

                }

            }

        } catch (error) {

            alert(
                error.response?.data?.message ||
                error.friendlyMessage ||
                "Login Failed"
            );

        } finally {

            setLoading(false);

        }

    };

    return (

        <div className="login-page">

            <div className="login-card">

                <div className="login-header">

                    <h1>InWallz Billing</h1>

                    <p>Restaurant Billing & POS System</p>

                </div>

                {sessionExpired && (
                    <p className="login-notice">
                        Your session expired. Please sign in again.
                    </p>
                )}

                <form onSubmit={handleLogin}>

                    <div className="input-group">

                        <FaUserAlt className="input-icon" />

                        <input
                            type="text"
                            name="username"
                            placeholder="Username"
                            value={loginData.username}
                            onChange={handleChange}
                            required
                        />

                    </div>

                    <div className="input-group">

                        <FaLock className="input-icon" />

                        <input
                            type={showPassword ? "text" : "password"}
                            name="password"
                            placeholder="Password"
                            value={loginData.password}
                            onChange={handleChange}
                            required
                        />

                        <span
                            className="password-toggle"
                            onClick={() => setShowPassword(!showPassword)}
                        >
                            {showPassword ? <FaEyeSlash /> : <FaEye />}
                        </span>

                    </div>

                    <button
                        type="submit"
                        className="login-btn"
                        disabled={loading}
                    >

                        {loading ? "Logging In..." : "Login"}

                    </button>

                </form>

            </div>

        </div>

    );

}

export default Login;