const db = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

exports.login = (data, callback) => {

    const sql = `
        SELECT
            id,
            full_name,
            username,
            password,
            role,
            status
        FROM users
        WHERE username = ?
        LIMIT 1
    `;

    db.query(sql, [data.username], (err, results) => {

        if (err) {
            return callback(err);
        }

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

        bcrypt.compare(data.password, user.password, (err, match) => {

            if (err) {
                return callback(err);
            }

            if (!match) {
                return callback(null, {
                    success: false,
                    message: "Invalid username or password."
                });
            }

            const token = jwt.sign(
                {
                    id: user.id,
                    username: user.username,
                    role: user.role
                },
                process.env.JWT_SECRET,
                {
                    expiresIn: "8h"
                }
            );

            callback(null, {
                success: true,
                token,
                user: {
                    id: user.id,
                    full_name: user.full_name,
                    username: user.username,
                    role: user.role
                }
            });

        });

    });

};