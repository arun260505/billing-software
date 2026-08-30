const db = require("../config/db");

/*
 * Generates the next per-restaurant, per-day order number, e.g. ORD-20260830-0001.
 *
 * Uses a DEDICATED connection from the pool for the SELECT ... FOR UPDATE
 * transaction. On the old single shared connection, two orders placed at the
 * same time interleaved their transactions and corrupted the sequence; a
 * dedicated connection keeps each transaction isolated. The connection is
 * released on every path (commit, rollback, error).
 */
const generateOrderNumber = (restaurantId, callback) => {

    const orderDate = new Date().toISOString().split("T")[0];
    const dateKey = orderDate.replace(/-/g, "");

    db.getConnection((connErr, conn) => {

        if (connErr) {
            return callback(connErr);
        }

        const fail = (err) => conn.rollback(() => {
            conn.release();
            callback(err);
        });

        const finish = (sequence) => {
            conn.commit((commitErr) => {
                if (commitErr) return fail(commitErr);
                conn.release();
                callback(null, `ORD-${dateKey}-${String(sequence).padStart(4, "0")}`);
            });
        };

        conn.beginTransaction((txErr) => {

            if (txErr) {
                conn.release();
                return callback(txErr);
            }

            const selectSql = `
                SELECT id, last_sequence
                FROM order_sequences
                WHERE restaurant_id = ?
                  AND order_date = ?
                FOR UPDATE
            `;

            conn.query(selectSql, [restaurantId, orderDate], (selErr, rows) => {

                if (selErr) return fail(selErr);

                if (rows.length === 0) {
                    const insertSql = `
                        INSERT INTO order_sequences (restaurant_id, order_date, last_sequence)
                        VALUES (?, ?, 1)
                    `;
                    conn.query(insertSql, [restaurantId, orderDate], (insErr) => {
                        if (insErr) return fail(insErr);
                        finish(1);
                    });
                } else {
                    const sequence = rows[0].last_sequence + 1;
                    const updateSql = `UPDATE order_sequences SET last_sequence = ? WHERE id = ?`;
                    conn.query(updateSql, [sequence, rows[0].id], (updErr) => {
                        if (updErr) return fail(updErr);
                        finish(sequence);
                    });
                }

            });

        });

    });

};

module.exports = generateOrderNumber;
