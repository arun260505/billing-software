require('dotenv').config({ path: './backend/.env' });
const db = require('./backend/config/db').promise();
async function run() {
    const [rows] = await db.query(`SELECT (SELECT COUNT(*) > 0 FROM day_closures WHERE restaurant_id = ? AND status = 'open' AND deleted_at IS NULL) AS day_is_open`, [1]);
    console.log("SQL says:", rows);
    process.exit();
}
run();
