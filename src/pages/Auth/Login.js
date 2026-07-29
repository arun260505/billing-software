import React, { useState } from "react";
import "../../styles/pages/Auth/Login.css";
import { FaUserAlt, FaLock, FaEye, FaEyeSlash } from "react-icons/fa";
import authService from "../../services/authService";

function Login() {

    const [showPassword, setShowPassword] = useState(false);

    const [loginData, setLoginData] = useState({
        username: "",
        password: ""
    });

    const [loading, setLoading] = useState(false);

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