const os = require("os");
const db = require("../config/db");
const systemModel = require("../models/systemModel");

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

    systemModel.createSettings(req.body, (err, result) => {

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

    systemModel.createRole(req.body, (err, result) => {

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

    systemModel.createActivityLog(req.body, (err, result) => {

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