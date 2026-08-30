const mysql = require("mysql2");

/*
|--------------------------------------------------------------------------
| Connection Pool
|--------------------------------------------------------------------------
| A pool (not a single connection) so that:
|  - concurrent requests from the cashier, waiters and kitchen run in parallel
|    instead of serializing behind one connection;
|  - an idle connection dropped by MySQL's wait_timeout (overnight) is replaced
|    transparently on the next query, instead of leaving the app permanently
|    broken with no reconnect.
|
| The exported object still exposes .query(), so existing `db.query(...)` calls
| work unchanged. Transactions must use db.getConnection() (see orderNumber.js).
*/

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000
});

/*
| Boot-time connectivity check with retry.
|
| On a fresh service start — and especially after a power cut, when InnoDB is
| still doing crash recovery — MySQL can take several seconds to accept
| connections. Without a retry the backend would come up permanently unable to
| reach the database (the classic "dead till at 9am"). We retry with backoff
| until the first connection succeeds; after that the pool self-heals.
*/
function verifyConnection(attempt = 1) {
    pool.getConnection((err, conn) => {
        if (err) {
            const delay = Math.min(attempt * 2000, 20000);
            console.error(
                `MySQL not ready (attempt ${attempt}): ${err.message}. Retrying in ${delay / 1000}s…`
            );
            setTimeout(() => verifyConnection(attempt + 1), delay);
            return;
        }
        conn.release();
        console.log("✅ MySQL Connected Successfully (pool)");
    });
}

verifyConnection();

module.exports = pool;
