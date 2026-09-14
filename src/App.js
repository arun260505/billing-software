import AppRoutes from "./routes/AppRoutes";
import NetworkGate from "./components/NetworkGate";
import WifiGuard from "./components/WifiGuard";
import ServerConfig from "./components/ServerConfig";
import AppNotify, { installAlertBridge } from "./components/AppNotify";
import OwnerApp from "./ownerApp/OwnerApp";
import { isNativeApp, getStoredServer, hasBakedApiUrl, isManualMode, isOwnerApp } from "./services/serverConfig";

// Every window.alert() in the app now shows as a tidy in-app popup (AppNotify)
// instead of the browser's "localhost:5050 says …" box. Installed once, here.
installAlertBridge();

function App() {

    // The server-address setup and the "same WiFi" gate are LAN/APK concerns.
    // The cloud + cashier run in a browser against a reachable backend, so they
    // render the app directly — no setup, no gate (a false block there would
    // lock the admin out for nothing).
    let inner;
    if (isNativeApp() && isOwnerApp()) {

        // Salon-owner alerts app: cloud-connected, works on ANY network, so it
        // skips the LAN discovery and same-WiFi gates entirely. Self-contained
        // login + dashboard + alert polling.
        inner = <OwnerApp />;
    } else if (isNativeApp()) {

        // Cloud APK (URL baked in): connects to the cloud but must be on the
        // same WiFi as the cashier — WifiGuard enforces that and blocks on
        // mobile data.
        if (hasBakedApiUrl()) {
            inner = (
                <WifiGuard>
                    <AppRoutes />
                </WifiGuard>
            );
        // LAN APK: the NetworkGate auto-discovers the till on the WiFi, so there
        // is no IP to type — on the same network it just connects, on any other
        // network it shows "not on the restaurant network" and can close.
        // ServerConfig appears only if the user explicitly chose manual entry
        // (a rare network the scan could not reach) and hasn't set one yet.
        } else if (isManualMode() && !getStoredServer()) {
            inner = <ServerConfig />;
        } else {
            inner = (
                <NetworkGate>
                    <AppRoutes />
                </NetworkGate>
            );
        }
    } else {
        inner = <AppRoutes />;
    }

    return (
        <>
            {inner}
            <AppNotify />
        </>
    );

}

export default App;
