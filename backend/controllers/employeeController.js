const employeeModel = require("../models/employeeModel");
const { success, error } = require("../utils/response");
const { isSalon } = require("../utils/businessType");

// The roles each kind of business actually has. A salon is run by its owner
// (the admin) with receptionists at the counter; a receptionist is stored as
// `cashier` so the till login, billing permissions and sync all work unchanged.
// Stylists are named on bills but never sign in, so they get no credentials.
const RESTAURANT_ROLES = ["admin", "cashier", "waiter", "kitchen"];
const SALON_NEW_STAFF_ROLES = ["cashier", "stylist"];

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

    const salon = isSalon(req.user);

    const name = typeof req.body.full_name === "string" ? req.body.full_name.trim() : "";
    if (!name) {
        return error(res, "Employee name is required.", 400);
    }

    // The role went into the users table unchecked, so an admin could mint a
    // `super_admin` (or any made-up role) through this form's endpoint.
    const allowed = salon ? SALON_NEW_STAFF_ROLES : RESTAURANT_ROLES;
    if (!allowed.includes(req.body.role)) {
        return error(res, salon ? "A salon can only add receptionists and stylists." : "Unknown role.", 400);
    }

    const stylist = req.body.role === "stylist";

    const employeeData = {
        ...req.body,
        full_name: name,
        restaurant_id: req.user.restaurant_id,
        created_by: req.user.id,
        // What the login name says: "priya_receptionist@glowsalon", not
        // "priya_cashier@…", for a salon's front desk.
        username_role: salon && !stylist ? "receptionist" : req.body.role,
        // A stylist gets an unguessable password nobody is shown, and
        // authModel refuses the role anyway.
        no_login: stylist
    };

    employeeModel.addEmployee(employeeData, (err, result) => {

        if (err) return error(res, err.message, 500);

        // password is null for a stylist: there are no credentials to hand over.
        return success(res, stylist ? "Stylist added." : "Employee created successfully.", {
            username: stylist ? null : result.username,
            password: result.password
        }, 201);

    });

};

// GET /api/employees/stylists — the salon's active stylists, for the billing
// screen's stylist picker (admin and receptionist).
exports.getStylists = (req, res) => {

    employeeModel.getStylists(req.user.restaurant_id, (err, results) => {

        if (err) return error(res, err.message, 500);

        return success(res, "Stylists fetched.", results);

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

    // In a salon a role is fixed once added: turning a stylist into a login
    // would hand out an account nobody set a password for, and an edit must not
    // take the owner's or a receptionist's login away. So a salon edit never
    // changes the role.
    const salon = isSalon(req.user);
    if (!salon && req.body.role && !RESTAURANT_ROLES.includes(req.body.role)) {
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
        { ...req.body, full_name: name, mobile, role: salon ? null : req.body.role },
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
