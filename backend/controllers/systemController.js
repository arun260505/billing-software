const systemModel = require("../models/systemModel");

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