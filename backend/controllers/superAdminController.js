const db = require("../config/db");
const bcrypt = require("bcryptjs");

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

                                (err) => {

                                    if (err) {
                                        return res.status(500).json({ success: false, message: err.message });
                                    }

                                    return res.json({
                                        success: true,
                                        message: "Admin & Restaurant created successfully."
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

module.exports = {
    createAdmin,
    getAdmins,
    deleteAdmin
};