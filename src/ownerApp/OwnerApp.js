import { useState, useEffect, useCallback, useRef } from "react";
import api from "../services/api";
import authService from "../services/authService";
import logo from "../assets/inwallz-logo.png";
import { initNotifications, pollOnce } from "./notifications";
import "./OwnerApp.css";

const POLL_MS = 30000; // foreground refresh cadence

const rupee = (n) =>
    "₹" + (Math.round((Number(n) || 0) * 100) / 100).toLocaleString("en-IN");

const timeAgo = (iso) => {
    if (!iso) return "";
    const t = new Date(iso).getTime();
    if (isNaN(t)) return "";
    const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
    if (s < 60) return "just now";
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
};

const ICONS = {
    shop_open: "🟢",
    shop_close: "🔴",
    daily_summary: "🧾",
    low_stock: "📦",
    out_of_stock: "⛔",
};

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------
function OwnerLogin({ onLoggedIn }) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");

    const submit = async (e) => {
        e.preventDefault();
        setErr("");
        if (!username.trim() || !password) {
            setErr("Enter your username and password.");
            return;
        }
        setBusy(true);
        try {
            const res = await authService.login({ username: username.trim(), password });
            if (!res?.success || !res?.token) {
                setErr(res?.message || "Login failed.");
                setBusy(false);
                return;
            }
            const user = res.user || {};
            // This app is for the salon owner only.
            if (user.role !== "admin") {
                setErr("Use the owner login. This app is for the salon owner.");
                setBusy(false);
                return;
            }
            localStorage.setItem("token", res.token);
            localStorage.setItem("user", JSON.stringify(user));
            onLoggedIn(user);
        } catch (e2) {
            setErr(e2?.friendlyMessage || e2?.response?.data?.message || "Could not sign in. Check your connection.");
            setBusy(false);
        }
    };

    return (
        <div className="own-login">
            <div className="own-login-card">
                <img src={logo} alt="InWallz" className="own-logo" />
                <h1 className="own-brand">InWallz Billing</h1>
                <p className="own-sub">Owner alerts</p>
                <form onSubmit={submit}>
                    <label>Username</label>
                    <input
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        autoCapitalize="none"
                        autoCorrect="off"
                        placeholder="Owner username"
                    />
                    <label>Password</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
                    />
                    {err ? <div className="own-err">{err}</div> : null}
                    <button type="submit" disabled={busy}>
                        {busy ? "Signing in…" : "Sign in"}
                    </button>
                </form>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Home / dashboard
// ---------------------------------------------------------------------------
function OwnerHome({ user, onLogout }) {
    const [feed, setFeed] = useState([]);
    const [day, setDay] = useState(null);
    const [dayOpen, setDayOpen] = useState(false);
    const [low, setLow] = useState([]);
    const [invSummary, setInvSummary] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const [lastSync, setLastSync] = useState(null);
    const [offline, setOffline] = useState(false);
    const timer = useRef(null);

    const refresh = useCallback(async () => {
        setRefreshing(true);
        let ok = false;

        // Alerts feed (also raises phone notifications for anything new).
        const rows = await pollOnce();
        if (rows) { setFeed(rows); ok = true; }

        // Day status + today's takings.
        try {
            const r = await api.get("/day/summary");
            setDay(r.data?.data?.summary || null);
            setDayOpen(Boolean(r.data?.data?.is_open));
            ok = true;
        } catch { /* keep last */ }

        // Stock health.
        try {
            const [sumRes, listRes] = await Promise.all([
                api.get("/inventory/summary"),
                api.get("/inventory"),
            ]);
            setInvSummary(sumRes.data?.data || null);
            const items = listRes.data?.data || [];
            setLow(items.filter((i) => Number(i.is_low) === 1 || Number(i.is_out) === 1));
            ok = true;
        } catch { /* keep last */ }

        setOffline(!ok);
        if (ok) setLastSync(new Date());
        setRefreshing(false);
    }, []);

    // Poll on mount, on an interval, and whenever the app returns to foreground.
    useEffect(() => {
        let alive = true;
        initNotifications();
        refresh();

        timer.current = setInterval(() => { if (alive) refresh(); }, POLL_MS);

        const appPlugin = window.Capacitor?.Plugins?.App;
        let handle;
        if (appPlugin?.addListener) {
            const p = appPlugin.addListener("resume", () => refresh());
            // addListener returns a promise-like handle in Capacitor v8.
            Promise.resolve(p).then((h) => { handle = h; });
        }

        return () => {
            alive = false;
            if (timer.current) clearInterval(timer.current);
            if (handle?.remove) handle.remove();
        };
    }, [refresh]);

    const collected = day ? day.collected_total : 0;
    const bills = day ? day.bill_count : 0;

    return (
        <div className="own-home">
            <header className="own-header">
                <img src={logo} alt="" className="own-header-logo" />
                <div className="own-header-txt">
                    <div className="own-header-title">InWallz Billing</div>
                    <div className="own-header-sub">{user?.restaurant_name || "Salon"}</div>
                </div>
                <button className="own-logout" onClick={onLogout} aria-label="Log out">⎋</button>
            </header>

            <div className="own-scroll">
                <div className="own-status-row">
                    <span className={`own-pill ${dayOpen ? "open" : "closed"}`}>
                        {dayOpen ? "● Shop open" : "○ Shop closed"}
                    </span>
                    <button className="own-refresh" onClick={refresh} disabled={refreshing}>
                        {refreshing ? "…" : "↻"}
                    </button>
                </div>

                <div className="own-cards">
                    <div className="own-card accent">
                        <div className="own-card-label">{dayOpen ? "Collected today" : "Last day collected"}</div>
                        <div className="own-card-value">{rupee(collected)}</div>
                        <div className="own-card-foot">{bills} bill{bills === 1 ? "" : "s"}
                            {day && day.net_sales ? ` · net ${rupee(day.net_sales)}` : ""}</div>
                    </div>
                    <div className="own-card">
                        <div className="own-card-label">Stock alerts</div>
                        <div className={`own-card-value ${invSummary && (invSummary.low_stock + invSummary.out_of_stock) > 0 ? "warn" : ""}`}>
                            {invSummary ? invSummary.low_stock + invSummary.out_of_stock : 0}
                        </div>
                        <div className="own-card-foot">
                            {invSummary ? `${invSummary.out_of_stock} out · ${invSummary.low_stock} low` : "—"}
                        </div>
                    </div>
                </div>

                {low.length > 0 && (
                    <div className="own-section">
                        <div className="own-section-title">Needs reordering</div>
                        {low.map((i) => (
                            <div className="own-lowrow" key={i.id}>
                                <span className="own-lowname">{i.item_name}</span>
                                <span className={`own-lowqty ${Number(i.is_out) === 1 ? "out" : ""}`}>
                                    {Number(i.is_out) === 1 ? "Out of stock" : `${i.quantity} ${i.unit || ""} left`}
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                <div className="own-section">
                    <div className="own-section-title">Alerts</div>
                    {feed.length === 0 && (
                        <div className="own-empty">No alerts yet. You'll be notified when the shop opens or closes, at day summary, and when stock runs low.</div>
                    )}
                    {feed.map((n) => (
                        <div className="own-alert" key={n.id}>
                            <span className="own-alert-icon">{ICONS[n.type] || "🔔"}</span>
                            <div className="own-alert-body">
                                <div className="own-alert-title">{n.title}</div>
                                {n.body ? <div className="own-alert-text">{n.body}</div> : null}
                                <div className="own-alert-time">{timeAgo(n.created_at)}</div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="own-foot">
                    {offline ? "Offline — will retry" : lastSync ? `Updated ${timeAgo(lastSync.toISOString())}` : ""}
                </div>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------
export default function OwnerApp() {
    const [user, setUser] = useState(() => authService.getUser());

    // React to the api.js 401 handler clearing the token (rare with a 365d token).
    useEffect(() => {
        const onStorage = () => {
            if (!authService.getToken()) setUser(null);
        };
        window.addEventListener("storage", onStorage);
        return () => window.removeEventListener("storage", onStorage);
    }, []);

    const logout = () => {
        authService.logout();
        setUser(null);
    };

    if (!user || !authService.getToken()) {
        return <OwnerLogin onLoggedIn={setUser} />;
    }
    return <OwnerHome user={user} onLogout={logout} />;
}
