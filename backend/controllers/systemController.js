const os = require("os");
const { execFile } = require("child_process");
const db = require("../config/db");
const systemModel = require("../models/systemModel");
const syncConfig = require("../sync/syncConfig");

// Strip the IPv6-mapped-IPv4 prefix Node adds (::ffff:192.168.1.5 -> 192.168.1.5).
function normalizeIp(ip) {
    if (!ip) return "";
    let out = String(ip).trim();
    if (out.startsWith("::ffff:")) out = out.slice(7);
    return out;
}

// Two addresses count as "same network" if identical, or (for IPv6, where each
// device has its own global address but shares a /64) if the /64 prefix matches.
function sameNetwork(a, b) {
    a = normalizeIp(a);
    b = normalizeIp(b);
    if (!a || !b) return false;
    if (a === b) return true;
    if (a.includes(":") && b.includes(":")) {
        const pa = a.split(":").slice(0, 4).join(":");
        const pb = b.split(":").slice(0, 4).join(":");
        return Boolean(pa) && pa === pb;
    }
    return false;
}

// Called by the CASHIER browser (on the restaurant WiFi) to record the
// restaurant's current public/WAN IP as "the allowed network".
exports.registerNetwork = (req, res) => {
    const rid = req.user && req.user.restaurant_id;
    if (!rid) {
        return res.status(400).json({ success: false, message: "No restaurant context." });
    }
    const ip = normalizeIp(req.ip);
    db.query(
        `INSERT INTO restaurant_networks (restaurant_id, wan_ip)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE wan_ip = VALUES(wan_ip), updated_at = CURRENT_TIMESTAMP`,
        [rid, ip],
        (err) => {
            if (err) return res.status(500).json({ success: false, message: err.message });
            res.json({ success: true, ip });
        }
    );
};

// Called by the WAITER app to check it is on the same network as the cashier.
// match: true = same network, false = different (block), null = no reference yet.
exports.networkStatus = (req, res) => {
    const rid = req.user && req.user.restaurant_id;
    const yourIp = normalizeIp(req.ip);
    if (!rid) {
        return res.json({ success: true, match: null, yourIp, restaurantIp: null });
    }
    db.query(
        `SELECT wan_ip FROM restaurant_networks WHERE restaurant_id = ?`,
        [rid],
        (err, rows) => {
            if (err) return res.status(500).json({ success: false, message: err.message });
            const restaurantIp = rows.length ? rows[0].wan_ip : null;
            const match = restaurantIp ? sameNetwork(yourIp, restaurantIp) : null;
            res.json({ success: true, match, yourIp, restaurantIp });
        }
    );
};

// Report the server PC's LAN IPv4 address(es) so the cashier can read off the
// address to enter into the waiter phones. Unauthenticated on purpose — it
// leaks nothing sensitive and is handy during setup before anyone logs in.
exports.getServerIp = (req, res) => {

    const nets = os.networkInterfaces();
    const addresses = [];

    for (const iface of Object.keys(nets)) {
        for (const net of nets[iface] || []) {
            if (net.family === "IPv4" && !net.internal) {
                addresses.push({ iface, address: net.address });
            }
        }
    }

    // Prefer real private-LAN addresses; push virtual adapters (VMware, WSL,
    // Hyper-V, Tailscale, VirtualBox) to the bottom so "best" is the WiFi/LAN.
    const isPrivate = (a) =>
        /^192\.168\./.test(a) ||
        /^10\./.test(a) ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(a);
    const isVirtual = (n) =>
        /vmware|virtualbox|vethernet|wsl|hyper-?v|tailscale|loopback|docker/i.test(n);

    const score = (e) =>
        (isPrivate(e.address) ? 2 : 0) + (isVirtual(e.iface) ? -2 : 1);
    addresses.sort((a, b) => score(b) - score(a));

    res.json({
        success: true,
        port: Number(process.env.PORT) || 5000,
        best: addresses.length ? addresses[0].address : null,
        addresses
    });

};

// List the printers installed on the machine this backend runs on, so the
// cashier's Printer page can offer the real ones instead of a free-text guess.
//
// This is only the till's own printer list when the backend runs ON the till —
// the exe/local node. A cloud node (Linux EC2) reports detectable:false and the
// page falls back to typing the name in by hand.
exports.getPrinters = (req, res) => {

    const meta = {
        // "local" = this node runs on the restaurant's own PC (see sync/syncConfig.js).
        server_role: syncConfig.ROLE,
        server_platform: process.platform
    };

    if (process.platform !== "win32") {
        return res.json({
            success: true,
            detectable: false,
            reason: "The server this page talks to is not a Windows PC, so it cannot see the till's printers.",
            printers: [],
            ...meta
        });
    }

    // Fixed command, no request data interpolated. `@(...)` forces an array so a
    // single installed printer still comes back as a list. PrinterStatus is an
    // enum — cast it to a string so it survives ConvertTo-Json readably.
    const script =
        "@(Get-Printer | Select-Object Name, " +
        "@{n='Status';e={[string]$_.PrinterStatus}}, " +
        "@{n='Offline';e={[bool]$_.WorkOffline}}, " +
        "@{n='Driver';e={[string]$_.DriverName}}) | ConvertTo-Json -Compress";

    execFile(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
        { timeout: 8000, windowsHide: true, maxBuffer: 1024 * 1024 },
        (err, stdout) => {
            if (err) {
                return res.json({
                    success: true,
                    detectable: false,
                    reason: "Could not read the printer list from Windows.",
                    printers: [],
                    ...meta
                });
            }

            let parsed;
            try {
                parsed = JSON.parse(String(stdout).trim() || "[]");
            } catch (parseErr) {
                return res.json({
                    success: true,
                    detectable: false,
                    reason: "Windows returned a printer list that could not be read.",
                    printers: [],
                    ...meta
                });
            }

            const list = Array.isArray(parsed) ? parsed : [parsed];
            const printers = list
                .filter((p) => p && p.Name)
                .map((p) => ({
                    name: String(p.Name),
                    status: String(p.Status || "Unknown"),
                    offline: Boolean(p.Offline),
                    driver: p.Driver ? String(p.Driver) : ""
                }));

            res.json({ success: true, detectable: true, reason: "", printers, ...meta });
        }
    );
};

// Get Settings
exports.getSettings = (req, res) => {

    const restaurantId = req.params.restaurantId;

    systemModel.getSettings(restaurantId, (err, results) => {

        if (err) {
            return res.status(500).json({
                success: false,
                message: err.message
            });
        }

        res.json({
            success: true,
            data: results.length ? results[0] : null
        });

    });

};

// Create Settings
exports.createSettings = (req, res) => {

    // The tenant comes from the token, never the body — otherwise any staff
    // login could create settings rows against another restaurant's id.
    const payload = { ...req.body, restaurant_id: req.user.restaurant_id };

    systemModel.createSettings(payload, (err, result) => {

        if (err) {
            return res.status(500).json({
                success: false,
                message: err.message
            });
        }

        res.status(201).json({
            success: true,
            message: "Settings created successfully",
            id: result.insertId
        });

    });

};
// Get Roles
exports.getRoles = (req, res) => {

    systemModel.getRoles(req.params.restaurantId, (err, results) => {

        if (err)
            return res.status(500).json({
                success:false,
                message:err.message
            });

        res.json({
            success:true,
            data:results
        });

    });

};

// Create Role
exports.createRole = (req, res) => {

    const payload = { ...req.body, restaurant_id: req.user.restaurant_id };

    systemModel.createRole(payload, (err, result) => {

        if (err)
            return res.status(500).json({
                success:false,
                message:err.message
            });

        res.status(201).json({
            success:true,
            message:"Role created successfully",
            id:result.insertId
        });

    });

};

// Get Permissions
exports.getPermissions = (req, res) => {

    systemModel.getPermissions((err, results) => {

        if (err)
            return res.status(500).json({
                success:false,
                message:err.message
            });

        res.json({
            success:true,
            data:results
        });

    });

};

// Assign Permissions
exports.assignPermissions = (req, res) => {

    systemModel.assignPermissions(
        req.params.roleId,
        req.user.restaurant_id,
        req.body.permissions,
        (err) => {

            if (err)
                return res.status(500).json({
                    success:false,
                    message:err.message
                });

            res.json({
                success:true,
                message:"Permissions updated successfully"
            });

        }
    );

};
// Save Activity Log
exports.createActivityLog = (req, res) => {

    // Both the restaurant and the actor are taken from the token, so an audit
    // entry cannot be forged against someone else's name or restaurant.
    const payload = {
        ...req.body,
        restaurant_id: req.user.restaurant_id,
        user_id: req.user.id
    };

    systemModel.createActivityLog(payload, (err, result) => {

        if (err) {
            return res.status(500).json({
                success: false,
                message: err.message
            });
        }

        res.status(201).json({
            success: true,
            message: "Activity log created successfully",
            id: result.insertId
        });

    });

};

// Get Activity Logs
exports.getActivityLogs = (req, res) => {

    systemModel.getActivityLogs(req.params.restaurantId, (err, results) => {

        if (err) {
            return res.status(500).json({
                success: false,
                message: err.message
            });
        }

        res.json({
            success: true,
            data: results
        });

    });

};

// Update Settings
exports.updateSettings = (req, res) => {

    const restaurantId = req.params.restaurantId;

    systemModel.updateSettings(restaurantId, req.body, (err) => {

        if (err) {
            return res.status(500).json({
                success: false,
                message: err.message
            });
        }

        res.json({
            success: true,
            message: "Settings updated successfully"
        });

    });

};