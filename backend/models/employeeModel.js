const db = require("../config/db");


exports.getEmployees = (restaurantId, callback) => {

    const sql = `
        SELECT
            id,
            full_name,
            username,
            role,
            status,
            created_at
        FROM users
        WHERE restaurant_id = ?
          AND role <> 'super_admin'
        ORDER BY id DESC
    `;

    db.query(sql, [restaurantId], callback);

};
  exports.getSummary = (restaurantId, callback) => {

    const sql = `
        SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN status='Active' THEN 1 ELSE 0 END) AS active,
            SUM(CASE WHEN role='cashier' THEN 1 ELSE 0 END) AS cashiers,
            SUM(CASE WHEN role='waiter' THEN 1 ELSE 0 END) AS waiters,
            SUM(CASE WHEN role='kitchen' THEN 1 ELSE 0 END) AS kitchen_staff
        FROM users
        WHERE restaurant_id = ?
          AND role <> 'super_admin'
    `;

    db.query(sql, [restaurantId], (err, results) => {

        if (err) return callback(err);

        callback(null, results[0]);

    });

};

const bcrypt = require("bcrypt");


exports.addEmployee = (data, callback) => {

    const restaurant = "inwallz";

    const name = data.full_name
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "");

    const baseUsername = `${name}_${data.role}@${restaurant}`;

    // Check if username already exists
    db.query(
        "SELECT COUNT(*) AS total FROM users WHERE username = ?",
        [baseUsername],
        (err, result) => {

            if (err) {
                return callback(err);
            }

            let username = baseUsername;

            if (result[0].total > 0) {
                username = `${name}_${data.role}${result[0].total + 1}@${restaurant}`;
            }

            // Generate Random Password
            const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

            let plainPassword = "";

            for (let i = 0; i < 8; i++) {

                plainPassword += chars.charAt(
                    Math.floor(Math.random() * chars.length)
                );

            }

            bcrypt.hash(plainPassword, 10, (err, hash) => {

                if (err) {
                    return callback(err);
                }

                const sql = `
                    INSERT INTO users
(
    restaurant_id,
    full_name,
    username,
    password,
    mobile,
    email,
    role,
    status,
    created_by
)
VALUES
(?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;

                db.query(
                    sql,
                    [
                        data.restaurant_id,
                        data.full_name,
                        username,
                        hash,
                        data.mobile,
                        data.email,
                        data.role,
                        data.status,
                        data.created_by
                    ],
                    (err, result) => {

                        if (err) {
                            return callback(err);
                        }

                        callback(null, {
                            result,
                            username,
                            password: plainPassword
                        });

                    }
                );

            });

        }
    );

};
