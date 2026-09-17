require('dotenv').config({ path: './backend/.env' });
const db = require('./backend/config/db').promise();
async function run() {
    const [rows1] = await db.query(`SELECT IFNULL(SUM(grand_total),0) as val FROM orders WHERE restaurant_id=1 AND DATE(created_at)=CURDATE() AND payment_status='Paid'`);
    const [rows2] = await db.query(`SELECT IFNULL(SUM(grand_total),0) as val FROM orders WHERE restaurant_id=1 AND YEARWEEK(created_at, 1)=YEARWEEK(CURDATE(), 1) AND payment_status='Paid'`);
    const [rows3] = await db.query(`SELECT IFNULL(SUM(grand_total),0) as val FROM orders WHERE restaurant_id=1 AND MONTH(created_at)=MONTH(CURDATE()) AND YEAR(created_at)=YEAR(CURDATE()) AND payment_status='Paid'`);
    console.log("Today:", rows1[0].val);
    console.log("Week:", rows2[0].val);
    console.log("Month:", rows3[0].val);
    process.exit();
}
run();
