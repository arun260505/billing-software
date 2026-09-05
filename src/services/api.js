import axios from "axios";
import { resolveApiBaseUrl } from "./serverConfig";

// Native APK: the per-device server address the user configured on first launch.
// Browser (cloud/cashier/dev): the build-time REACT_APP_API_URL, else localhost.
// Without a timeout axios waits forever, so a till that has gone away mid-shift
// leaves the waiter staring at "Sending…" with no error and no way back — the
// order is neither placed nor refused. 20s is well past a slow LAN round trip
// and well short of a waiter giving up on the app.
const REQUEST_TIMEOUT_MS = 20000;

const api = axios.create({
    baseURL: resolveApiBaseUrl(),
    timeout: REQUEST_TIMEOUT_MS,
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

// Turn the two failures that used to surface as a dead screen into a message a
// waiter or cashier can act on.
api.interceptors.response.use(
    (response) => response,
    (error) => {

        // The 8h token expires mid-shift with no refresh. Without this, every
        // call 401s and the screen just says "failed" forever — on a phone there
        // is no F5 to press. Send them back to the login they can actually use.
        if (error.response?.status === 401) {

            const onLoginScreen = window.location.pathname === "/";

            localStorage.removeItem("token");
            localStorage.removeItem("user");

            // Don't bounce a failed login attempt — that screen shows its own
            // "wrong password" message and must stay put.
            if (!onLoginScreen) {
                try {
                    sessionStorage.setItem("inwallz_session_expired", "1");
                } catch {
                    /* private mode — the redirect still happens */
                }
                window.location.href = "/";
            }

        }

        // A timeout or a dead network reads as ECONNABORTED / no response at
        // all; give it wording that says which, so "the WiFi died here" is not
        // mistaken for "the server rejected my order" and retried into a
        // duplicate.
        if (!error.response) {
            error.friendlyMessage = error.code === "ECONNABORTED"
                ? "The restaurant server did not respond. Check the WiFi and try again — your order was NOT sent."
                : "Could not reach the restaurant server. Check the WiFi and try again — your order was NOT sent.";
        }

        return Promise.reject(error);

    }
);

export default api;
