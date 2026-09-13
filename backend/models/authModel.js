const db = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { normalizeBusinessType } = require("../utils/businessType");

exports.login = (username, password, callback) => {

    const sql = `
        SELECT
            u.id,
            u.restaurant_id,
            u.full_name,
            u.username,
            u.password,
            u.role,
            u.status,
            r.restaurant_name,
            r.business_type
        FROM users u
        LEFT JOIN restaurants r
            ON u.restaurant_id = r.id
        WHERE u.username = ? AND u.deleted_at IS NULL
        LIMIT 1
    `;

    db.query(sql, [username], (err, results) => {

        if (err) return callback(err);

        if (results.length === 0) {
            return callback(null, {
                success: false,
                message: "Invalid username or password."
            });
        }

        const user = results[0];

        // A stylist is a name on a salon's bills, not an account: the owner
        // adds them without credentials. Answer exactly as for a wrong
        // password so the username can't be probed.
        if (user.role === "stylist") {
            return callback(null, {
                success: false,
                message: "Invalid username or password."
            });
        }

        if (user.status !== "Active") {
            return callback(null, {
                success: false,
                message: "Your account is inactive."
            });
        }

        bcrypt.compare(password, user.password, (err, match) => {

            if (err) return callback(err);

            if (!match) {
                return callback(null, {
                    success: false,
                    message: "Invalid username or password."
                });
            }

            // Restaurant or salon decides which panel the user gets and which
            // APIs they may call (middleware/businessTypeMiddleware.js). It is
            // read from the restaurants row here, never from the client.
            const businessType = normalizeBusinessType(user.business_type);

            const token = jwt.sign(
                {
                    id: user.id,
                    restaurant_id: user.restaurant_id,
                    username: user.username,
                    role: user.role,
                    business_type: businessType
                },
                process.env.JWT_SECRET,
                {
                    expiresIn: process.env.JWT_EXPIRES_IN || "8h"
                }
            );

            callback(null, {
                success: true,
                token,
                user: {
                    id: user.id,
                    restaurant_id: user.restaurant_id,
                    restaurant_name: user.restaurant_name,
                    business_type: businessType,
                    full_name: user.full_name,
                    username: user.username,
                    role: user.role
                }
            });

        });

    });

};