import { useEffect } from "react";
import authService from "../services/authService";
import { initNotifications, pollOnce } from "./notifications";

// Runs inside the owner APK alongside the full admin panel: while the owner is
// signed in, it polls the cloud alerts feed and raises phone notifications for
// anything new (shop open/close, daily summary, low stock). Renders nothing —
// the owner uses the normal admin screens; this just delivers the alerts.
export default function OwnerNotificationDaemon() {
    useEffect(() => {
        let alive = true;
        let timer = null;
        let resumeHandle = null;

        const tick = async () => {
            if (!alive || !authService.getToken()) return;
            await pollOnce();
        };

        initNotifications();
        tick();
        timer = setInterval(tick, 30000);

        const appPlugin = window.Capacitor?.Plugins?.App;
        if (appPlugin?.addListener) {
            Promise.resolve(appPlugin.addListener("resume", tick))
                .then((h) => { resumeHandle = h; })
                .catch(() => {});
        }

        return () => {
            alive = false;
            if (timer) clearInterval(timer);
            if (resumeHandle?.remove) resumeHandle.remove();
        };
    }, []);

    return null;
}
