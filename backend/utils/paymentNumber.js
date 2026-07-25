const db = require("../config/db");

const generatePaymentNumber = (restaurantId, callback) => {

    const today = new Date();
    const paymentDate = today.toISOString().split("T")[0];
    const datePart = paymentDate.replace(/-/g, "");

    const sql = `
        SELECT payment_number
        FROM payments
        WHERE restaurant_id = ?
        AND payment_number LIKE ?
        ORDER BY payment_number DESC
        LIMIT 1
    `;

    db.query(
        sql,
        [restaurantId, `PAY-${datePart}-%`],
        (err, results) => {

            if (err) {
                return callback(err);
            }

            let sequence = 1;

            if (results.length > 0) {

                const lastNumber = results[0].payment_number;

                sequence =
                    parseInt(lastNumber.split("-")[2], 10) + 1;
            }

            const paymentNumber =
                `PAY-${datePart}-${String(sequence).padStart(4, "0")}`;

            callback(null, paymentNumber);

        }
    );
};

module.exports = generatePaymentNumber;