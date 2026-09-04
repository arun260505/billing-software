// Zero-config discovery of the restaurant till on the local WiFi.
//
// Goal: the waiter never types an IP. On the same WiFi as the till the app
// finds it automatically; on any other network (mobile data, home WiFi) it
// finds nothing and the NetworkGate shows "not on the restaurant network".
//
// How: probe every host on the phone's /24 for GET /api/health returning the
// till's signature { service: "inwallz-billing" }. The phone's own subnet is
// learned via a WebRTC candidate when the WebView exposes it; when it does not
// (mDNS-obfuscated), we fall back to the common private ranges.

import axios from "axios";
import { setStoredServer } from "./serverConfig";

// The till serves on 5050 by default (installer), but older installs used 5000,
// so probe both. First match wins.
const TILL_PORTS = [5050, 5000];
const TILL_SIGNATURE = "inwallz-billing";

// Per-host probe budget. Absent hosts on a LAN never answer, so they burn the
// full timeout — keep it short and lean on concurrency for total speed.
const PROBE_TIMEOUT_MS = 700;
const CONCURRENCY = 60;

const probe = axios.create({ timeout: PROBE_TIMEOUT_MS, validateStatus: () => true });

// Common private /24 prefixes seen on Indian home/restaurant routers and phone
// hotspots. Scanned only when WebRTC could not reveal the real subnet.
const FALLBACK_PREFIXES = [
    "192.168.1", "192.168.0", "192.168.29", "192.168.31",
    "192.168.2", "192.168.43", "10.0.0", "172.20.10"
];

// Ask a single host whether it is the till. Returns the port it answered on
// (checking 5050 then 5000), or null.
async function tillPortAt(ip) {
    for (const port of TILL_PORTS) {
        try {
            const res = await probe.get(`http://${ip}:${port}/api/health`);
            if (res?.data?.service === TILL_SIGNATURE) return port;
        } catch {
            /* try next port / host */
        }
    }
    return null;
}

// Scan one "a.b.c" prefix across .1–.254, in bounded-concurrency batches, and
// return { ip, port } of the first host that identifies as the till (or null).
async function scanPrefix(prefix) {
    const hosts = [];
    for (let i = 1; i <= 254; i += 1) hosts.push(`${prefix}.${i}`);

    for (let start = 0; start < hosts.length; start += CONCURRENCY) {
        const batch = hosts.slice(start, start + CONCURRENCY);
        const hits = await Promise.all(
            batch.map(async (ip) => {
                const port = await tillPortAt(ip);
                return port ? { ip, port } : null;
            })
        );
        const found = hits.find(Boolean);
        if (found) return found;
    }
    return null;
}

// Best-effort read of the phone's own private IPv4 via a WebRTC candidate.
// Returns [] on WebViews that hide it behind an mDNS ".local" candidate.
function getLocalIps(timeout = 1500) {
    return new Promise((resolve) => {
        const ips = new Set();
        let pc;
        try {
            pc = new RTCPeerConnection({ iceServers: [] });
        } catch {
            resolve([]);
            return;
        }
        try {
            pc.createDataChannel("d");
        } catch {
            /* ignore */
        }
        pc.onicecandidate = (e) => {
            if (!e || !e.candidate) return;
            const m = /(\d{1,3}(?:\.\d{1,3}){3})/.exec(e.candidate.candidate || "");
            if (!m) return;
            const ip = m[1];
            if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip)) ips.add(ip);
        };
        pc.createOffer().then((o) => pc.setLocalDescription(o)).catch(() => {});
        setTimeout(() => {
            try { pc.close(); } catch { /* ignore */ }
            resolve([...ips]);
        }, timeout);
    });
}

/**
 * Find the till on the current WiFi. Returns its authority ("192.168.1.14:5050")
 * or null if none answered. Scans the phone's own /24 first (fast, exact),
 * then the common fallback prefixes.
 */
export async function discoverTill() {
    const localIps = await getLocalIps();

    const prefixes = [];
    localIps.forEach((ip) => {
        const prefix = ip.split(".").slice(0, 3).join(".");
        if (!prefixes.includes(prefix)) prefixes.push(prefix);
    });
    FALLBACK_PREFIXES.forEach((p) => {
        if (!prefixes.includes(p)) prefixes.push(p);
    });

    for (const prefix of prefixes) {
        const hit = await scanPrefix(prefix);
        if (hit) return `${hit.ip}:${hit.port}`;   // keep the port that answered
    }
    return null;
}

/**
 * Discover the till and remember it for next launch. Returns true on success.
 */
export async function discoverAndStoreTill() {
    const authority = await discoverTill();
    if (!authority) return false;
    setStoredServer(authority);   // "ip:port" so the right port is used
    return true;
}
