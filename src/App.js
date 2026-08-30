import AppRoutes from "./routes/AppRoutes";
import NetworkGate from "./components/NetworkGate";
import WifiGuard from "./components/WifiGuard";
import ServerConfig from "./components/ServerConfig";
import { isNativeApp, getStoredServer, hasBakedApiUrl, isManualMode } from "./services/serverConfig";

//import { ToastContainer } from "react-toastify";

//import "react-toastify/dist/ReactToastify.css";

function App() {

    // The server-address setup and the "same WiFi" gate are LAN/APK concerns.
    // The cloud + cashier run in a browser against a reachable backend, so they
    // render the app directly — no setup, no gate (a false block there would
    // lock the admin out for nothing).
    if (isNativeApp()) {

        // Cloud APK (URL baked in): connects to the cloud but must be on the
        // same WiFi as the cashier — WifiGuard enforces that and blocks on
        // mobile data.
        if (hasBakedApiUrl()) {
            return (
                <WifiGuard>
                    <AppRoutes />
                </WifiGuard>
            );
        }

        // LAN APK: the NetworkGate auto-discovers the till on the WiFi, so there
        // is no IP to type — on the same network it just connects, on any other
        // network it shows "not on the restaurant network" and can close.
        // ServerConfig appears only if the user explicitly chose manual entry
        // (a rare network the scan could not reach) and hasn't set one yet.
        if (isManualMode() && !getStoredServer()) {
            return <ServerConfig />;
        }

        return (
            <NetworkGate>
                <AppRoutes />
            </NetworkGate>
        );

    }

    return <AppRoutes />;

}

export default App;
