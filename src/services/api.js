import axios from "axios";
import { resolveApiBaseUrl } from "./serverConfig";

// Native APK: the per-device server address the user configured on first launch.
// Browser (cloud/cashier/dev): the build-time REACT_APP_API_URL, else localhost.
const api = axios.create({
    baseURL: resolveApiBaseUrl(),
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
