import AppRoutes from "./routes/AppRoutes";
import NetworkGate from "./components/NetworkGate";
import ServerConfig from "./components/ServerConfig";
import { isNativeApp, getStoredServer } from "./services/serverConfig";

//import { ToastContainer } from "react-toastify";

//import "react-toastify/dist/ReactToastify.css";

function App() {

    // The server-address setup and the "same WiFi" gate are LAN/APK concerns.
    // The cloud + cashier run in a browser against a reachable backend, so they
    // render the app directly — no setup, no gate (a false block there would
    // lock the admin out for nothing).
    if (isNativeApp()) {

        // First launch: ask for the server address, then reload into the gate.
        if (!getStoredServer()) {
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
