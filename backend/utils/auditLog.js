const db = require("../config/db");

/**
 * Append a row to activity_logs. Best-effort: an audit write must never fail the
 * user's action, so errors are logged to the console and swallowed.
 *
 * @param {object} user  req.user (needs id + restaurant_id)
 * @param {string} module_
 * @param {string} action
 * @param {string} description
 */
const log = (user, module_, action, description) => {

    if (!user || !user.restaurant_id || !user.id) return;

    db.query(
        `INSERT INTO activity_logs
         (restaurant_id, user_id, module, action, description)
         VALUES (?, ?, ?, ?, ?)`,
        [user.restaurant_id, user.id, module_, action, description],
        (err) => {
            if (err) console.error("activity_logs write failed:", err.message);
        }
    );

};

module.exports = { log };
