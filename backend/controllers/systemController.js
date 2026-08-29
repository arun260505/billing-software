const os = require("os");
const systemModel = require("../models/systemModel");

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