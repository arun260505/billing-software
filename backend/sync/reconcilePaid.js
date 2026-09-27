const db = require("../config/db").promise();

// Self-healing sweep for "paid but stuck Pending" orders.
//
// Paying a bill is two separate writes: (1) record the payment, then (2) mark the
// order Paid/Completed. They are NOT one atomic write, so a momentary DB hiccup
// between them — most likely at a busy counter or during a heavy sync — can leave
// the payment saved while the order stays Pending. That order's money then shows
// in the dashboard's Collection but not its Sales, opening a gap.
//
// This sweep repairs it automatically: any recent, non-cancelled order whose
// SUCCESSFUL payments already cover its bill is set to Paid + Completed. It runs on
// every node (cloud AND till), so the books stay matched without anyone fixing
// rows by hand. It only ever touches fully-paid orders, so it can't mark something
// paid that wasn't.
async function sweep() {
    const [rows] = await db.query(
        `SELECT o.id
         FROM orders o
         WHERE o.deleted_at IS NULL
           AND o.order_status <> 'Cancelled'
           AND (o.payment_status <> 'Paid' OR o.order_status <> 'Completed')
           AND o.grand_total > 0
           AND o.created_at >= (NOW() - INTERVAL 2 DAY)
           AND (
                SELECT IFNULL(SUM(p.amount), 0) FROM payments p
                WHERE p.order_id = o.id AND p.payment_status = 'Success' AND p.deleted_at IS NULL
           ) >= o.grand_total
         LIMIT 200`
    );
    if (!rows.length) return 0;
    const ids = rows.map((r) => r.id);
    await db.query(
        "UPDATE orders SET payment_status='Paid', order_status='Completed', updated_at=NOW() WHERE id IN (?)",
        [ids]
    );
    console.log(`↺ reconcilePaid: healed ${ids.length} paid-but-open order(s).`);
    return ids.length;
}

let timer = null;
function start(intervalMs = 60000) {
    if (timer) return;
    const run = () => sweep().catch((e) => console.error("reconcilePaid sweep:", e.message));
    run();                                  // once at boot
    timer = setInterval(run, intervalMs);   // then on a timer
    if (timer.unref) timer.unref();
}

module.exports = { start, sweep };
