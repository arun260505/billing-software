import axios from "axios";

// On a phone "localhost" is the phone itself, so the mobile build sets
// REACT_APP_API_URL to the server PC's LAN IP (see .env). Browser dev keeps
// working off the localhost fallback.
const api = axios.create({
    baseURL: process.env.REACT_APP_API_URL || "http://localhost:5000/api",
    headers: {
        "Content-Type": "application/json"
    }
});

api.interceptors.request.use(
    (config) => {

        const token = localStorage.getItem("token");

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        return config;

    },
    (error) => Promise.reject(error)
);

export default api;