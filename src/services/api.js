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

        // Resolve the base URL on EVERY request, not just at module load. On the
        // native APK the till address is discovered a moment after this module
        // loads, so a load-time baseURL would be empty and every call (login
        // included) would go nowhere. Re-resolving here always uses the address
        // discovery has since stored.
        config.baseURL = resolveApiBaseUrl();

        const token = localStorage.getItem("token");

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        return config;

    },
    (error) => Promise.reject(error)
);

export default api;
