#!/usr/bin/env node
/*
|--------------------------------------------------------------------------
| One-off: move historical per-bill charges onto the order
|--------------------------------------------------------------------------
| Before the charges change, per-bill charges (packing, delivery, AC …) were
| paid BEYOND the stored order total and recorded as a separate payment row
| tagged "Additional charges (per-bill) by employee N". The order itself kept
| grand_total = goods + tax + service, with no record that a charge existed.
|
| That leaves historical orders inconsistent with the new model, where
| grand_total is the whole amount owed:
|
|   old:  payments.sum  =  grand_total + surplus
|   new:  payments.sum  =  grand_total            (charges are inside it)
|
| So any report summing grand_total under-reports takings for every bill that
| carried a charge, and a reprint of one shows a total its own lines don't
| reach.
|
| This finds those surplus payments by their remark — an exact marker, not a
| re-derived guess — and for each affected order:
|
|   1. sets  orders.charges_total = the surplus
|   2. adds  the surplus to orders.grand_total
|   3. inserts one order_charges row so a reprint shows a line that accounts
|      for the money. The original per-charge breakdown (which names, which
|      amounts) was never stored, so it cannot be recovered — the row is
|      labelled honestly rather than invented.
|
| DRY RUN BY DEFAULT. Nothing is written without --apply.
|
|   node scripts/backfill-order-charges.js              # report only
|   node scripts/backfill-order-charges.js --apply      # write the changes
|   node scripts/backfill-order-charges.js --apply --restaurant 3
|
| Take a mysqldump first. This rewrites recorded financial history — it is
| correcting it, but it is still a rewrite, and it is not reversible in place.
*/

require("dotenv").config();
const db = require("../config/db").promise();

const SURPLUS_REMARK = "Additional charges (per-bill)%";
const BACKFILL_LABEL = "Per-bill charges (historical)";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const ridArg = args.indexOf("--restaurant");
const ONLY_RESTAURANT = ridArg !== -1 ? Number(args[ridArg + 1]) : null;

const money = (n) => Math.round((Number(n) || 0) * 100) / 100;
const rupees = (n) => Number(n).toFixed(2).padStart(10);

(async () => {

    const params = [];
    let scope = "";
    if (ONLY_RESTAURANT) {
        scope = " AND o.restaurant_id = ?";
        params.push(ONLY_RESTAURANT);
    }

    // Orders carrying a legacy surplus payment. Grouped because a single order
    // could in principle have collected more than one.
    const [rows] = await db.query(
        `SELECT o.id,
                o.restaurant_id,
                o.order_number,
                o.subtotal,
                o.tax,
                o.service_charge,
                o.charges_total,
                o.grand_total,
                -- Formatted in SQL: mysql2 hands back a JS Date, whose default
                -- string form is 40 characters of timezone noise in the report.
                DATE_FORMAT(o.created_at, '%Y-%m-%d') AS created_on,
                SUM(p.amount)             AS surplus,
                COUNT(*)                  AS surplus_rows
         FROM orders o
         JOIN payments p ON p.order_id = o.id
         WHERE p.payment_status = 'Success'
           AND p.remarks LIKE ?
           ${scope}
         GROUP BY o.id
         ORDER BY o.id`,
        [SURPLUS_REMARK, ...params]
    );

    if (!rows.length) {
        console.log("No historical surplus-charge payments found. Nothing to backfill.");
        console.log("(This is the expected result on a database that never billed a per-bill charge.)");
        process.exit(0);
    }

    // An order already carrying charges_total was settled under the new model —
    // adding the surplus again would double-count it.
    const todo = rows.filter((r) => Number(r.charges_total) === 0);
    const skipped = rows.filter((r) => Number(r.charges_total) !== 0);

    console.log(`${APPLY ? "APPLYING" : "DRY RUN"} — historical per-bill charges\n`);
    console.log("order        date        subtotal    charges   grand_total ->  corrected");
    console.log("-".repeat(78));

    let total = 0;
    for (const r of todo) {
        const surplus = money(r.surplus);
        const corrected = money(Number(r.grand_total) + surplus);
        total += surplus;
        console.log(
            `${String(r.order_number || r.id).padEnd(12)} ${String(r.created_on).padEnd(11)}` +
            `${rupees(r.subtotal)} ${rupees(surplus)} ${rupees(r.grand_total)} -> ${rupees(corrected)}`
        );
    }

    console.log("-".repeat(78));
    console.log(`${todo.length} order(s), ${money(total).toFixed(2)} in charges to move onto grand_total.`);
    if (skipped.length) {
        console.log(`${skipped.length} order(s) skipped — already have charges_total set (settled under the new model).`);
    }

    if (!APPLY) {
        console.log("\nDry run — nothing written. Re-run with --apply to make these changes.");
        console.log("Take a mysqldump first.");
        process.exit(0);
    }

    if (!todo.length) {
        console.log("\nNothing to apply.");
        process.exit(0);
    }

    // One transaction: either history is consistent afterwards or it is
    // untouched. A half-applied backfill would be worse than none.
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        for (const r of todo) {
            const surplus = money(r.surplus);

            await conn.query(
                `UPDATE orders
                 SET charges_total = ?, grand_total = ?
                 WHERE id = ? AND charges_total = 0`,
                [surplus, money(Number(r.grand_total) + surplus), r.id]
            );

            await conn.query(
                `INSERT INTO order_charges (order_id, charge_name, amount) VALUES (?, ?, ?)`,
                [r.id, BACKFILL_LABEL, surplus]
            );
        }

        await conn.commit();
        console.log(`\nApplied to ${todo.length} order(s).`);
    } catch (e) {
        await conn.rollback();
        console.error("\nFAILED — rolled back, nothing was written:", e.message);
        process.exitCode = 1;
    } finally {
        conn.release();
    }

    // Show the invariant the whole exercise exists to restore.
    const [[check]] = await db.query(
        `SELECT
            SUM(ABS(o.grand_total - COALESCE(p.paid, 0)) > 0.02) AS mismatched,
            COUNT(*) AS checked
         FROM orders o
         LEFT JOIN (
            SELECT order_id, SUM(amount) AS paid
            FROM payments WHERE payment_status = 'Success'
            GROUP BY order_id
         ) p ON p.order_id = o.id
         WHERE o.payment_status = 'Paid' AND o.order_status <> 'Cancelled'`
    );
    console.log(
        `\nReconciliation: ${check.mismatched || 0} of ${check.checked} paid orders ` +
        `still differ from their payments by more than a paisa.`
    );

    process.exit(0);

})().catch((e) => {
    console.error("Backfill failed:", e.message);
    process.exit(1);
});
