const employeeModel = require("../models/employeeModel");
const { success, error } = require("../utils/response");

exports.getEmployees = (req, res) => {

    employeeModel.getEmployees(req.user.restaurant_id, (err, results) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Employees fetched.", results);

    });

};

exports.getSummary = (req, res) => {

    employeeModel.getSummary(req.user.restaurant_id, (err, summary) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Employee summary fetched.", summary);

    });

};

exports.addEmployee = (req, res) => {

    const employeeData = {
        ...req.body,
        restaurant_id: req.user.restaurant_id,
        created_by: req.user.id
    };

    employeeModel.addEmployee(employeeData, (err, result) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Employee created successfully.", {
            username: result.username,
            password: result.password
        }, 201);

    });

};

// Edit a staff member (tenant-scoped via the JWT).
exports.updateEmployee = (req, res) => {

    const name = typeof req.body.full_name === "string" ? req.body.full_name.trim() : "";

    if (!name) {
        return res.status(400).json({
            success: false,
            message: "Employee name is required."
        });
    }
    if (!/^[A-Za-z][A-Za-z .'-]*$/.test(name)) {
        return res.status(400).json({
            success: false,
            message: "Name cannot contain numbers or symbols."
        });
    }

    const mobile = req.body.mobile == null ? "" : String(req.body.mobile).trim();
    if (mobile && !/^[0-9]{10}$/.test(mobile)) {
        return res.status(400).json({
            success: false,
            message: "Mobile number must be 10 digits."
        });
    }

    const ROLES = ["admin", "cashier", "waiter", "kitchen"];
    if (req.body.role && !ROLES.includes(req.body.role)) {
        return res.status(400).json({
            success: false,
            message: "Unknown role."
        });
    }

    if (req.body.status && !["Active", "Inactive"].includes(req.body.status)) {
        return res.status(400).json({
            success: false,
            message: "Status must be Active or Inactive."
        });
    }

    employeeModel.updateEmployee(
        req.params.id,
        req.user.restaurant_id,
        { ...req.body, full_name: name, mobile },
        (err, result) => {

            if (err) {
                return res.status(500).json({ success: false, message: err.message });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({ success: false, message: "Employee not found." });
            }

            res.json({ success: true, message: "Employee updated successfully." });

        }
    );

};

// Remove a staff member (soft delete, tenant-scoped).
exports.deleteEmployee = (req, res) => {

    // An admin removing their own account would lock the restaurant out of its
    // own back office.
    if (Number(req.params.id) === Number(req.user.id)) {
        return res.status(400).json({
            success: false,
            message: "You cannot delete your own account."
        });
    }

    employeeModel.deleteEmployee(
        req.params.id,
        req.user.restaurant_id,
        (err, result) => {

            if (err) {
                return res.status(500).json({ success: false, message: err.message });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({ success: false, message: "Employee not found." });
            }

            res.json({ success: true, message: "Employee removed successfully." });

        }
    );

};
