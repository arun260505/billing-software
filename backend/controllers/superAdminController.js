const db = require("../config/db");
const bcrypt = require("bcryptjs");
const { ensureActivationRecord } = require("../utils/activationKeys");

// Creating an admin also creates that admin's restaurant and links them, so
// the admin is a proper tenant and can manage employees/menu/tables/etc.
const createAdmin = async (req, res) => {

    try {

        const {
            fullName,
            username,
            password,
            restaurantName,
            mobile
        } = req.body;

        if (!fullName || !username || !password || !restaurantName || !mobile) {

            return res.status(400).json({
                success: false,
                message: "All fields are required (full name, username, password, restaurant name, mobile)."
            });

        }

        // Server-side checks, because the form's validation only stops honest
        // mistakes — the endpoint accepted a one-character password and a mobile
        // number made of letters when called directly. This account owns a whole
        // restaurant.
        if (String(password).length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 8 characters."
            });
        }

        if (!/^[A-Za-z][A-Za-z .'-]*$/.test(String(fullName).trim())) {
            return res.status(400).json({
                success: false,
                message: "Owner name cannot contain numbers or symbols."
            });
        }

        if (!/^[0-9]{10}$/.test(String(mobile).trim())) {
            return res.status(400).json({
                success: false,
                message: "Mobile number must be exactly 10 digits."
            });
        }

        db.query(

            "SELECT id FROM users WHERE username=? AND deleted_at IS NULL",

            [username],

            (err, result) => {

                if (err) {
                    return res.status(500).json({ success: false, message: err.message });
                }

                if (result.length > 0) {
                    return res.status(400).json({ success: false, message: "Username already exists." });
                }

                // 1) Create the restaurant for this admin.
                db.query(

                    `INSERT INTO restaurants
                    (restaurant_name, owner_name, mobile, status)
                    VALUES (?, ?, ?, 'Active')`,

                    [restaurantName, fullName, mobile],

                    async (err, restResult) => {

                        if (err) {
                            return res.status(500).json({ success: false, message: err.message });
                        }

                        const restaurantId = restResult.insertId;

                        try {

                            const hashedPassword = await bcrypt.hash(password, 10);

                            // 2) Create the admin, linked to that restaurant.
                            // created_by is left NULL (super-admin route is not
                            // authenticated, and hardcoding an id breaks the
                            // users.created_by foreign key on a fresh database).
                            db.query(

                                `INSERT INTO users
                                (restaurant_id, username, password, full_name, mobile, role, status)
                                VALUES (?, ?, ?, ?, ?, 'admin', 'Active')`,

                                [restaurantId, username, hashedPassword, fullName, mobile],

                                async (err) => {

                                    if (err) {
                                        return res.status(500).json({ success: false, message: err.message });
                                    }

                                    // Auto-issue an activation key for the new
                                    // restaurant so it can be installed on a PC.
                                    let activationKey = null;
                                    try {
                                        activationKey = await ensureActivationRecord(db.promise(), restaurantId);
                                    } catch (keyErr) {
                                        console.error("Activation key generation failed:", keyErr.message);
                                    }

                                    return res.json({
                                        success: true,
                                        message: "Admin & Restaurant created successfully.",
                                        activation_key: activationKey
                                    });

                                }

                            );

                        } catch (e) {
                            return res.status(500).json({ success: false, message: e.message });
                        }

                    }

                );

            }

        );

    }

    catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};

const getAdmins = (req, res) => {

    db.query(

        `SELECT
            id,
            username,
            full_name,
            status,
            created_at
        FROM users
        WHERE role='admin' AND deleted_at IS NULL
        ORDER BY id DESC`,

        (err, result) => {

            if (err) {

                return res.status(500).json({
                    success: false,
                    message: err.message
                });

            }

            res.json({
                success: true,
                admins: result
            });

        }

    );

};

const deleteAdmin = (req, res) => {

    const { id } = req.params;

    db.query(

        // Soft delete so the removal syncs to the cloud.
        "UPDATE users SET deleted_at = NOW() WHERE id=? AND deleted_at IS NULL",

        [id],

        (err) => {

            if (err) {

                return res.status(500).json({
                    success: false,
                    message: err.message
                });

            }

            res.json({
                success: true,
                message: "Admin Deleted Successfully"
            });

        }

    );

};

// The Edit button on the super admin panel had no endpoint behind it at all —
// it rendered, it was clickable, and nothing happened. This is that endpoint.
// Deliberately narrow: name, mobile and status only. Changing an admin's
// username would orphan their restaurant's per-restaurant logins, and passwords
// are reset, never edited.
const updateAdmin = (req, res) => {

    const { id } = req.params;
    const { full_name, mobile, status } = req.body;

    const name = typeof full_name === "string" ? full_name.trim() : "";
    if (!name) {
        return res.status(400).json({
            success: false,
            message: "Owner / admin name is required."
        });
    }
    // A name is a name. Letters, spaces and the punctuation real names carry.
    if (!/^[A-Za-z][A-Za-z .'-]*$/.test(name)) {
        return res.status(400).json({
            success: false,
            message: "Name cannot contain numbers or symbols."
        });
    }

    const phone = mobile == null ? "" : String(mobile).trim();
    if (phone && !/^[0-9]{10}$/.test(phone)) {
        return res.status(400).json({
            success: false,
            message: "Mobile number must be 10 digits."
        });
    }

    if (status && !["Active", "Inactive"].includes(status)) {
        return res.status(400).json({
            success: false,
            message: "Status must be Active or Inactive."
        });
    }

    db.query(
        `UPDATE users
            SET full_name = ?,
                mobile = ?,
                status = COALESCE(?, status)
          WHERE id = ? AND role = 'admin' AND deleted_at IS NULL`,
        [name, phone || null, status || null, id],
        (err, result) => {

            if (err) {
                return res.status(500).json({
                    success: false,
                    message: err.message
                });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Admin not found."
                });
            }

            res.json({
                success: true,
                message: "Admin updated successfully."
            });

        }
    );

};

module.exports = {
    createAdmin,
    getAdmins,
    updateAdmin,
    deleteAdmin
};