const db = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

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
            r.restaurant_name
        FROM users u
        LEFT JOIN restaurants r
            ON u.restaurant_id = r.id
        WHERE u.username = ?
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

            const token = jwt.sign(
                {
                    id: user.id,
                    restaurant_id: user.restaurant_id,
                    username: user.username,
                    role: user.role
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
                    full_name: user.full_name,
                    username: user.username,
                    role: user.role
                }
            });

        });

    });

};