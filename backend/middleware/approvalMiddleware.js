const db = require("../config/db");

const COLUMN_MAP = {
    discount: "discount_approval",
    refund: "refund_approval",
    cancel_order: "cancel_order_approval",
    menu_price_change: "menu_price_change_approval"
};

/**
 * requireApproval(operation, conditionFn?) — Express middleware factory.
 * When the toggle is ON and the caller is not admin → 403.
 */
const requireApproval = (operation, conditionFn) => {
    const column = COLUMN_MAP[operation];
    if (!column) throw new Error(`requireApproval: unknown operation "${operation}"`);

    return (req, res, next) => {
        if (req.user.role === "admin") return next();
        if (conditionFn && !conditionFn(req)) return next();

        const restaurantId = req.user.restaurant_id;
        if (!restaurantId) return next();

        const sql = `SELECT ${column} FROM security_settings WHERE restaurant_id = ?`;
        db.query(sql, [restaurantId], (err, rows) => {
            if (err) return next();
            const enabled = rows && rows.length > 0 ? Boolean(rows[0][column]) : false;
            if (!enabled) return next();
            return res.status(403).json({
                success: false,
                message: "This action requires admin approval. Please ask an administrator to perform this operation."
            });
        });
    };
};

module.exports = { requireApproval };
