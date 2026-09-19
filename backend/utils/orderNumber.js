const db = require("../config/db");
const { RESET_MODES, resetKeyFor, formatOrderNumber, previewNextOrderNumber, nextSequence, normalizeDigits, sanitizePrefix } = require("./orderNumberFormat");

/*
 * Generates the next order number for a restaurant from its saved
 * "Order Number Format" (Admin → Settings → Order Number Format):
 *
 *   ORD-0001, ORD-0002, ORD-0003, …
 *
 * The string is `${prefix}-${sequence}` with the sequence zero-padded to the
 * configured width. The sequence advances per restaurant and per sequence
 * bucket: it never resets ("never"), restarts each calendar day ("daily"), or
 * restarts each month ("monthly"). Restarting on the same bucket is impossible;
 * the number is unique within the bucket because of the lock below.
 *
 * Uses a DEDICATED connection from the pool with SELECT ... FOR UPDATE on the
 * restaurant's order_number_settings row, so two cashiers/waiters/POS terminals
 * placing orders at the same instant serialize on that row and cannot be handed
 * the same number. (On the old shared connection, two simultaneous transactions
 * interleaved and corrupted the sequence; a dedicated connection keeps each
 * transaction isolated.) The connection is released on every path — commit,
 * rollback, or error.
 *
 * Existing orders keep the number they were created with; only NEW orders use
 * the current configuration. The internal orders.id is untouched.
 */
const generateOrderNumber = (restaurantId, callback) => {

    db.getConnection((connErr, conn) => {

        if (connErr) {
            return callback(connErr);
        }

        const fail = (err) => conn.rollback(() => {
            conn.release();
            callback(err);
        });

        const finish = (orderNumber) => {
            conn.commit((commitErr) => {
                if (commitErr) return fail(commitErr);
                conn.release();
                callback(null, orderNumber);
            });
        };

        conn.beginTransaction((txErr) => {

            if (txErr) {
                conn.release();
                return callback(txErr);
            }

            // Lock the restaurant's format row for the whole transaction. Any
            // other order being issued at this instant waits here, reads the
            // updated current_sequence, and gets the next number.
            const lockSql = `
                SELECT prefix, starting_number, digits, reset_mode,
                       current_sequence, sequence_reset_key
                FROM order_number_settings
                WHERE restaurant_id = ?
                FOR UPDATE
            `;

            conn.query(lockSql, [restaurantId], (selErr, rows) => {

                if (selErr) return fail(selErr);

                // Never configured yet: insert the defaults (ORD / 1 / 4 /
                // never), marking the starting number as already issued so the
                // next order correctly continues at ORD-0002. The settings
                // screen reads the same row back.
                if (rows.length === 0) {
                    conn.query(
                        `INSERT INTO order_number_settings
                            (restaurant_id, prefix, starting_number, digits,
                             reset_mode, current_sequence, sequence_reset_key)
                         VALUES (?, 'ORD', 1, 4, 'never', 1, '')`,
                        [restaurantId],
                        (insErr) => {
                            if (insErr) return fail(insErr);
                            finish(formatOrderNumber({ prefix: "ORD", sequence: 1, digits: 4 }));
                        }
                    );
                    return;
                }

                const cfg = rows[0];
                const mode = RESET_MODES.includes(cfg.reset_mode) ? cfg.reset_mode : "never";
                const start = Math.max(1, Number(cfg.starting_number) || 1);
                const digits = normalizeDigits(cfg.digits);

                // "never" never restarts, so it doesn't need the business day.
                if (mode === "never") {
                    const sequence = nextSequence(cfg, mode, start);
                    return conn.query(
                        `UPDATE order_number_settings
                         SET current_sequence = ?, sequence_reset_key = ?
                         WHERE restaurant_id = ?`,
                        [sequence, resetKeyFor(mode), restaurantId],
                        (updErr) => {
                            if (updErr) return fail(updErr);
                            finish(formatOrderNumber({ prefix: sanitizePrefix(cfg.prefix), sequence, digits }));
                        }
                    );
                }

                // daily / monthly: restart the sequence when a NEW BUSINESS DAY
                // is opened at the counter, not at calendar midnight. So the
                // bucket key is the open day's business_date (its month for
                // "monthly"). A shop that keeps billing past midnight stays on
                // one day — and one continuous run of numbers — until it closes
                // and opens the next day, when numbering restarts at the start.
                // If somehow no day is open, fall back to the calendar bucket.
                conn.query(
                    `SELECT DATE_FORMAT(business_date, '%Y-%m-%d') AS bd
                     FROM day_closures
                     WHERE restaurant_id = ? AND status = 'open' AND deleted_at IS NULL
                     ORDER BY opened_at ASC, id ASC
                     LIMIT 1`,
                    [restaurantId],
                    (dayErr, dayRows) => {
                        if (dayErr) return fail(dayErr);

                        const bd = dayRows.length ? String(dayRows[0].bd) : null;
                        const bucketKey = bd
                            ? (mode === "monthly" ? bd.slice(0, 7) : bd)
                            : resetKeyFor(mode);

                        const sequence = nextSequence(cfg, mode, start, bucketKey);

                        conn.query(
                            `UPDATE order_number_settings
                             SET current_sequence = ?, sequence_reset_key = ?
                             WHERE restaurant_id = ?`,
                            [sequence, bucketKey, restaurantId],
                            (updErr) => {
                                if (updErr) return fail(updErr);
                                finish(formatOrderNumber({ prefix: sanitizePrefix(cfg.prefix), sequence, digits }));
                            }
                        );
                    }
                );

            });

        });

    });

};

generateOrderNumber.formatOrderNumber = formatOrderNumber;
generateOrderNumber.previewNextOrderNumber = previewNextOrderNumber;
generateOrderNumber.RESET_MODES = RESET_MODES;

module.exports = generateOrderNumber;