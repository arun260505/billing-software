const db = require("../config/db");

const generateOrderNumber = (restaurantId, callback) => {

    const today = new Date();

    const orderDate = today.toISOString().split("T")[0];

    db.beginTransaction((err) => {

        if (err) {
            return callback(err);
        }

        const selectSql = `
            SELECT *
            FROM order_sequences
            WHERE restaurant_id = ?
            AND order_date = ?
            FOR UPDATE
        `;

        db.query(
            selectSql,
            [restaurantId, orderDate],
            (err, rows) => {

                if (err) {
                    return db.rollback(() => callback(err));
                }

                if (rows.length === 0) {

                    const insertSql = `
                        INSERT INTO order_sequences
                        (
                            restaurant_id,
                            order_date,
                            last_sequence
                        )
                        VALUES (?, ?, 1)
                    `;

                    db.query(
                        insertSql,
                        [restaurantId, orderDate],
                        (err) => {

                            if (err) {
                                return db.rollback(() => callback(err));
                            }

                            db.commit((err) => {

                                if (err) {
                                    return db.rollback(() => callback(err));
                                }

                                const date =
                                    orderDate.replace(/-/g, "");

                                callback(
                                    null,
                                    `ORD-${date}-0001`
                                );

                            });

                        }
                    );

                } else {

                    const sequence =
                        rows[0].last_sequence + 1;

                    const updateSql = `
                        UPDATE order_sequences
                        SET last_sequence=?
                        WHERE id=?
                    `;

                    db.query(
                        updateSql,
                        [sequence, rows[0].id],
                        (err) => {

                            if (err) {
                                return db.rollback(() => callback(err));
                            }

                            db.commit((err) => {

                                if (err) {
                                    return db.rollback(() => callback(err));
                                }

                                const date =
                                    orderDate.replace(/-/g, "");

                                callback(
                                    null,
                                    `ORD-${date}-${String(sequence).padStart(4, "0")}`
                                );

                            });

                        }
                    );

                }

            }
        );

    });

};

module.exports = generateOrderNumber;