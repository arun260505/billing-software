const db = require("../config/db");
const { totalsFromSubtotal, resolveCharges, money, ROLES } = require("../utils/billing");
const { getAutoCharges } = require("../utils/billingCharges");

/*
| Recomputing an order's totals needs three things: its remaining subtotal, the
| charges its restaurant applies to every bill of that order type (GST, service
| charge, a standing packing fee), and the per-bill charges the cashier already
| picked for it. This wraps that so every recompute path agrees — a bill must
| total the same whether it was just created, edited down to one item, or
| reprinted.
*/
const totalsForOrder = (orderId, restaurantId, subtotal, callback) => {

    db.query(
        "SELECT order_type FROM orders WHERE id = ? AND restaurant_id = ? LIMIT 1",
        [orderId, restaurantId],
        (err, orderRows) => {
            if (err) return callback(err);
            const orderType = (orderRows && orderRows[0] && orderRows[0].order_type) || "Dine-In";

            getAutoCharges(restaurantId, orderType, (err, autoCharges) => {
                // getAutoCharges never errors — it bills the goods rather than
                // failing a sale — but keep the guard honest.
                if (err) return callback(err);

                db.query(
                    "SELECT charge_name, amount FROM order_charges WHERE order_id = ?",
                    [orderId],
                    (err, chargeRows) => {
                        if (err) return callback(err);
                        // Stored charges are already resolved to rupees and carry
                        // no role, so they total as ordinary charges.
                        callback(null, totalsFromSubtotal(
                            subtotal,
                            [...autoCharges, ...(chargeRows || [])]
                        ));
                    }
                );
            });
        }
    );
};

// Get all orders (tenant-scoped)
const getAllOrders = (restaurantId, callback) => {

    const sql = `
        SELECT
            o.*,
            c.customer_name,
            dt.table_name,
            u.full_name AS employee_name
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        LEFT JOIN dining_tables dt ON o.table_id = dt.id
        LEFT JOIN users u ON o.employee_id = u.id
        WHERE o.restaurant_id = ? AND o.deleted_at IS NULL
        ORDER BY o.created_at DESC
    `;

    db.query(sql, [restaurantId], callback);
};

// Get order by ID (tenant-scoped)
const getOrderById = (id, restaurantId, callback) => {

    const sql = `
        SELECT *
        FROM orders
        WHERE id = ? AND restaurant_id = ? AND deleted_at IS NULL
    `;

    db.query(sql, [id, restaurantId], callback);
};

/*
| Look up the real menu price for a cart, scoped to the restaurant.
|
| The cart arrives from a browser or an APK, so the price it carries is a
| suggestion, not a fact — a tampered client could post price: 0 and the till
| would print (and bank) a free bill. addBillItem already priced its item from
| menu_items; this does the same for a whole cart so order creation agrees.
|
| Callback gets (err, pricedItems). An item whose menu_item_id does not belong
| to this restaurant is an error, not a silently-dropped line.
*/
const priceCartItems = (items, restaurantId, callback) => {

    const cart = Array.isArray(items) ? items : [];
    if (cart.length === 0) return callback(null, []);

    const ids = [...new Set(cart.map((it) => it.menu_item_id).filter((v) => v != null))];
    if (ids.length === 0) return callback(new Error("Order has no valid menu items."));

    db.query(
        "SELECT id, price FROM menu_items WHERE id IN (?) AND restaurant_id = ?",
        [ids, restaurantId],
        (err, rows) => {

            if (err) return callback(err);

            const priceById = new Map(rows.map((r) => [Number(r.id), Number(r.price)]));

            const priced = [];
            for (const it of cart) {
                const price = priceById.get(Number(it.menu_item_id));
                if (price === undefined) {
                    return callback(new Error("Menu item not found on this menu."));
                }
                const qty = Math.max(1, Number(it.quantity) || 1);
                priced.push({
                    menu_item_id: it.menu_item_id,
                    quantity: qty,
                    price,
                    total: money(price * qty),
                    notes: it.notes || null
                });
            }

            callback(null, priced);
        }
    );

};

// Create order (restaurant_id + employee_id set by controller from JWT)
const createOrder = (order, callback) => {

    const sql = `
        INSERT INTO orders
        (
            restaurant_id,
            customer_id,
            table_id,
            employee_id,
            order_number,
            order_type,
            order_status,
            subtotal,
            discount,
            tax,
            service_charge,
            grand_total,
            payment_status,
            notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(sql, [
        order.restaurant_id,
        order.customer_id,
        order.table_id,
        order.employee_id,
        order.order_number,
        order.order_type,
        order.order_status,
        order.subtotal,
        order.discount,
        order.tax,
        order.service_charge || 0,
        order.grand_total,
        order.payment_status,
        order.notes
    ], callback);
};

// Delete order (tenant-scoped)
const deleteOrder = (id, restaurantId, callback) => {

    // Soft delete so the removal syncs to the cloud.
    db.query(
        "UPDATE orders SET deleted_at = NOW() WHERE id=? AND restaurant_id=? AND deleted_at IS NULL",
        [id, restaurantId],
        callback
    );

};

// Invoice header (tenant-scoped)
const getInvoiceByOrderId = (orderId, restaurantId, callback) => {

    const sql = `
        SELECT
            o.id,
            o.order_number,
            o.order_type,
            o.order_status,
            o.payment_status,
            o.subtotal,
            o.tax,
            o.discount,
            o.grand_total,
            o.created_at,
            r.restaurant_name,
            r.address,
            r.mobile,
            c.customer_name,
            c.mobile AS customer_mobile,
            dt.table_name,
            u.full_name AS employee_name
        FROM orders o
        LEFT JOIN restaurants r ON o.restaurant_id = r.id
        LEFT JOIN customers c ON o.customer_id = c.id
        LEFT JOIN dining_tables dt ON o.table_id = dt.id
        LEFT JOIN users u ON o.employee_id = u.id
        WHERE o.id = ? AND o.restaurant_id = ?
    `;

    db.query(sql, [orderId, restaurantId], callback);

};

// Invoice line items (tenant-scoped via parent order)
const getInvoiceItems = (orderId, restaurantId, callback) => {

    const sql = `
        SELECT
            oi.quantity,
            oi.price,
            oi.total,
            mi.item_name
        FROM order_items oi
        INNER JOIN menu_items mi ON oi.menu_item_id = mi.id
        INNER JOIN orders o ON oi.order_id = o.id
        WHERE oi.order_id = ? AND o.restaurant_id = ?
    `;

    db.query(sql, [orderId, restaurantId], callback);

};

const createOrderItems = (items, orderId, callback) => {

    if (!items || items.length === 0) {
        return callback(null);
    }

    const values = items.map(item => [
        orderId,
        item.menu_item_id,
        item.quantity,
        item.price,
        item.total,
        item.notes || null
    ]);

    const sql = `
        INSERT INTO order_items
        (order_id, menu_item_id, quantity, price, total, notes)
        VALUES ?
    `;

    db.query(sql, [values], callback);

};

// Update a table's status (tenant-scoped)
const updateTableStatus = (tableId, restaurantId, status, callback) => {

    db.query(
        "UPDATE dining_tables SET status = ? WHERE id = ? AND restaurant_id = ?",
        [status, tableId, restaurantId],
        callback
    );

};

// ---------------------------------------------------------------------------
// Waiter ordering support (tenant-scoped)
// ---------------------------------------------------------------------------

// Active/running orders for the waiter board
const getRunningOrders = (restaurantId, employeeId, callback) => {

    // Waiters only see the orders they took in their running-orders notification;
    // cashiers/admins see every table's running orders so they can print bills.
    const waiterFilter = employeeId ? "AND o.employee_id = ?" : "";
    const params = employeeId ? [restaurantId, employeeId] : [restaurantId];

    const sql = `
        SELECT
            o.id,
            o.order_number,
            o.employee_id,
            o.table_id,
            dt.table_name,
            (SELECT COALESCE(SUM(oi.quantity), 0)
             FROM order_items oi
             WHERE oi.order_id = o.id) AS total_items,
            o.grand_total,
            o.order_status AS status,
            o.created_at
        FROM orders o
        LEFT JOIN dining_tables dt ON o.table_id = dt.id
        WHERE o.restaurant_id = ?
          AND o.order_status IN ('Pending','Preparing','Ready')
          ${waiterFilter}
        ORDER BY o.created_at DESC
    `;

    db.query(sql, params, callback);

};

// Line items for one order (tenant-scoped via parent order)
const getOrderDetails = (orderId, restaurantId, callback) => {

    const sql = `
        SELECT
            oi.id,
            oi.menu_item_id,
            mi.item_name,
            oi.quantity,
            oi.price,
            oi.total
        FROM order_items oi
        INNER JOIN menu_items mi ON oi.menu_item_id = mi.id
        INNER JOIN orders o ON oi.order_id = o.id
        WHERE oi.order_id = ? AND o.restaurant_id = ?
    `;

    db.query(sql, [orderId, restaurantId], callback);

};

// Update an order's totals (tenant-scoped)
const updateOrderTotals = (orderId, restaurantId, totals, callback) => {

    const sql = `
        UPDATE orders
        SET subtotal = ?, tax = ?, service_charge = ?, charges_total = ?, grand_total = ?
        WHERE id = ? AND restaurant_id = ?
    `;

    db.query(
        sql,
        [
            totals.subtotal,
            totals.tax,
            totals.service_charge || 0,
            totals.charges_total || 0,
            totals.grand_total,
            orderId,
            restaurantId
        ],
        callback
    );

};

// Replace an order's items: delete existing then re-insert (only if the order
// belongs to this tenant).
const deleteOrderItems = (orderId, restaurantId, callback) => {

    const sql = `
        DELETE oi FROM order_items oi
        INNER JOIN orders o ON oi.order_id = o.id
        WHERE oi.order_id = ? AND o.restaurant_id = ?
    `;

    db.query(sql, [orderId, restaurantId], callback);

};

// Soft-cancel an order (tenant-scoped)
const cancelOrder = (orderId, restaurantId, callback) => {

    db.query(
        "UPDATE orders SET order_status = 'Cancelled' WHERE id = ? AND restaurant_id = ?",
        [orderId, restaurantId],
        callback
    );

};

// A table's items across ALL its active (unpaid) orders — Pending..Served,
// excluding Completed/Cancelled. Merged by item for a read-only summary.
const getTableActiveItems = (tableId, restaurantId, callback) => {

    // Per order-item rows (each has its own served flag) so items can be
    // marked served individually.
    const sql = `
        SELECT
            oi.id,
            mi.item_name,
            oi.quantity,
            oi.price,
            oi.served
        FROM order_items oi
        INNER JOIN orders o ON oi.order_id = o.id
        INNER JOIN menu_items mi ON oi.menu_item_id = mi.id
        WHERE o.table_id = ? AND o.restaurant_id = ?
          AND o.order_status IN ('Pending','Preparing','Ready','Served')
        ORDER BY oi.id ASC
    `;

    db.query(sql, [tableId, restaurantId], callback);

};

// Mark one order Served (waiter delivered it) — leaves the kitchen display.
const markServed = (orderId, restaurantId, callback) => {

    // Marking a whole order served (from the waiter's notification) must ALSO flag
    // every line item as served — otherwise the cashier's "all items served" check
    // stays locked even though the waiter already delivered the food.
    db.query(
        `UPDATE order_items oi
         INNER JOIN orders o ON oi.order_id = o.id
         SET oi.served = 1
         WHERE o.id = ? AND o.restaurant_id = ?`,
        [orderId, restaurantId],
        (err) => {
            if (err) return callback(err);

            db.query(
                `UPDATE orders SET order_status='Served'
                 WHERE id=? AND restaurant_id=?
                   AND order_status IN ('Pending','Preparing','Ready')`,
                [orderId, restaurantId],
                callback
            );
        }
    );

};

// Mark a single order-item served; if all items in its order are then served,
// the order itself becomes Served (and drops off the kitchen display).
const markItemServed = (itemId, restaurantId, callback) => {

    db.query(
        `UPDATE order_items oi
         INNER JOIN orders o ON oi.order_id = o.id
         SET oi.served = 1
         WHERE oi.id = ? AND o.restaurant_id = ?`,
        [itemId, restaurantId],
        (err) => {
            if (err) return callback(err);

            db.query(
                `SELECT o.id AS orderId,
                        SUM(oi2.served = 0) AS unserved
                 FROM order_items oi
                 INNER JOIN orders o ON oi.order_id = o.id
                 INNER JOIN order_items oi2 ON oi2.order_id = o.id
                 WHERE oi.id = ? AND o.restaurant_id = ?
                 GROUP BY o.id`,
                [itemId, restaurantId],
                (err, rows) => {
                    if (err) return callback(err);
                    if (!rows.length) return callback(null);

                    if (Number(rows[0].unserved) === 0) {
                        db.query(
                            `UPDATE orders SET order_status='Served'
                             WHERE id=? AND restaurant_id=?
                               AND order_status IN ('Pending','Preparing','Ready')`,
                            [rows[0].orderId, restaurantId],
                            callback
                        );
                    } else {
                        callback(null);
                    }
                }
            );
        }
    );

};

// Mark all of a table's active orders Served (waiter delivered the table's food).
// Flags every line item served too, so the cashier's all-items-served billing
// check can pass after the waiter marks the table served.
const markTableServed = (tableId, restaurantId, callback) => {

    db.query(
        `UPDATE order_items oi
         INNER JOIN orders o ON oi.order_id = o.id
         SET oi.served = 1
         WHERE o.table_id=? AND o.restaurant_id=?
           AND o.order_status IN ('Pending','Preparing','Ready')`,
        [tableId, restaurantId],
        (err) => {
            if (err) return callback(err);

            db.query(
                `UPDATE orders SET order_status='Served'
                 WHERE table_id=? AND restaurant_id=?
                   AND order_status IN ('Pending','Preparing','Ready')`,
                [tableId, restaurantId],
                callback
            );
        }
    );

};

// Settle a table: mark all its active orders Completed/Paid, record a payment
// against each, and free the table.
//
// The payment row is what makes a settled bill auditable — before it existed the
// cashier picked Cash/Card/UPI, it was printed on the receipt and then thrown
// away, so dine-in revenue never reached the payments table at all.
// Settle a table: mark all its active orders Completed/Paid, record payment(s)
// against each, and free the table.
//
// `payments` is an array of { method, amount } supporting split payments. For a
// single payment, pass [{ method, amount: null }] and the full total is used.
//
// The payment row is what makes a settled bill auditable — before it existed the
// cashier picked Cash/Card/UPI, it was printed on the receipt and then thrown
// away, so dine-in revenue never reached the payments table at all.
/*
| Persist the per-bill charges the cashier picked at settle time.
|
| They are charges on the BILL, not on any one order, so they are stored
| against the table's first order and rolled into its grand_total. That keeps
| the invariant the rest of the system relies on: an order's grand_total is the
| whole amount owed for it, so payments reconcile and reports that sum
| grand_total no longer under-report what was taken.
|
| Percentage charges resolve against the table's combined goods subtotal, the
| same basis the cashier screen has always shown.
*/
const applyBillCharges = (orders, restaurantId, charges, callback) => {

    if (!orders.length) return callback(null);

    // Ordinary charges only. Tax and service rows are applied automatically from
    // the restaurant's charge list and already sit in orders.tax /
    // orders.service_charge — storing one here too would bill it twice.
    const resolved = resolveCharges(
        charges,
        orders.reduce((s, o) => s + Number(o.subtotal || 0), 0)
    ).filter((c) => c.charge_role === ROLES.CHARGE);

    const target = orders[0];

    // Always clear first: settling is the one moment charges are fixed, and a
    // retried settle must not stack a second copy of them onto the order.
    db.query("DELETE FROM order_charges WHERE order_id = ?", [target.id], (err) => {
        if (err) return callback(err);

        const finish = (chargesTotal) => {
            target.grand_total = money(
                Number(target.grand_total || 0) -
                Number(target.charges_total || 0) +
                chargesTotal
            );
            db.query(
                `UPDATE orders SET charges_total = ?, grand_total = ?
                 WHERE id = ? AND restaurant_id = ?`,
                [chargesTotal, target.grand_total, target.id, restaurantId],
                (err) => {
                    if (err) return callback(err);
                    target.charges_total = chargesTotal;
                    callback(null);
                }
            );
        };

        if (!resolved.length) return finish(0);

        db.query(
            "INSERT INTO order_charges (order_id, charge_name, amount) VALUES ?",
            [resolved.map((c) => [target.id, c.charge_name, c.amount])],
            (err) => {
                if (err) return callback(err);
                finish(money(resolved.reduce((s, c) => s + c.amount, 0)));
            }
        );
    });

};

const settleTable = (tableId, restaurantId, payments, employeeId, finalTotal, charges, callback) => {

    // Block settling if ANY item on the table's active orders is not yet served.
    db.query(
        `SELECT COUNT(*) AS unserved
         FROM order_items oi
         INNER JOIN orders o ON oi.order_id = o.id
         WHERE o.table_id=? AND o.restaurant_id=?
           AND o.order_status IN ('Pending','Preparing','Ready','Served')
           AND oi.served = 0`,
        [tableId, restaurantId],
        (err, rows) => {
            if (err) return callback(err);

            if (rows[0] && Number(rows[0].unserved) > 0) {
                return callback(new Error(
                    `Cannot generate the bill: ${Number(rows[0].unserved)} item(s) not yet served. ` +
                    `Mark all items as served before billing.`
                ));
            }

            // Grab the orders first — after the UPDATE they no longer match "active".
            db.query(
                `SELECT id, subtotal, charges_total, grand_total FROM orders
                 WHERE table_id=? AND restaurant_id=?
                   AND order_status IN ('Pending','Preparing','Ready','Served')`,
                [tableId, restaurantId],
                (err, orders) => {
                    if (err) return callback(err);

                    // Fix the per-bill charges onto the order before anything is
                    // totalled, so grand_total is the whole amount owed and the
                    // payment lines below reconcile against it exactly.
                    applyBillCharges(orders, restaurantId, charges, (err) => {
                    if (err) return callback(err);

                    const billTotal = money(
                        orders.reduce((s, o) => s + Number(o.grand_total || 0), 0)
                    );

                    // finalTotal is what the cashier saw on screen. It should now
                    // equal billTotal, since charges are part of grand_total.
                    //
                    // A table with several orders is taxed per order, while the
                    // screen taxes the combined subtotal once, so the two can
                    // legitimately land a paisa apart. Refusing a sale over that
                    // would be far worse than the discrepancy, so small drift is
                    // tolerated and the stored total wins. A real disagreement
                    // (items changed under the cashier) still stops the settle.
                    const ROUNDING_TOLERANCE = 1;
                    if (finalTotal != null &&
                        Math.abs(money(Number(finalTotal)) - billTotal) > ROUNDING_TOLERANCE) {
                        return callback(new Error(
                            `The bill on screen (${money(Number(finalTotal)).toFixed(2)}) does not match ` +
                            `the recorded total (${billTotal.toFixed(2)}). Reopen the bill and try again.`
                        ));
                    }
                    const payTotal = billTotal;

                    // Build the list of payment lines, validating split amounts.
                    const lines = payments.map((p) => ({
                        method: p.method || "Cash",
                        amount: p.amount == null ? null : money(Number(p.amount))
                    }));
                    const hasExplicitAmounts = lines.some((l) => l.amount != null);
                    const splitSum = money(lines.reduce((s, l) => s + (l.amount || 0), 0));

                    if (hasExplicitAmounts && money(splitSum) !== payTotal) {
                        return callback(new Error(
                            `Split payment amounts (${splitSum.toFixed(2)}) do not match the bill total (${payTotal.toFixed(2)}).`
                        ));
                    }

                    // A single line with no amount → pay the full total with it.
                    if (lines.length === 1 && lines[0].amount == null) {
                        lines[0].amount = payTotal;
                    }

                    db.query(
                        `UPDATE orders
                         SET order_status='Completed', payment_status='Paid'
                         WHERE table_id=? AND restaurant_id=?
                           AND order_status IN ('Pending','Preparing','Ready','Served')`,
                        [tableId, restaurantId],
                        (err) => {
                            if (err) return callback(err);

                            // Distribute the payment lines across the table's orders.
                            // Each order has a grand_total; a line can span multiple
                            // orders (and an order can be paid by multiple lines).
                            orders.forEach((o) => { o.remaining = money(o.grand_total); });

                            const recordOrders = (ordersDone) => {

                                // Ensure every order's grand_total got covered before
                                // freeing the table.
                                const anyUnpaid = orders.some((o) => money(o.remaining) !== 0);
                                if (anyUnpaid) {
                                    return callback(new Error(
                                        "Payment distribution did not cover all orders."
                                    ));
                                }

                                // Per-bill charges used to be paid BEYOND the stored
                                // grand_totals and recorded as a surplus payment line.
                                // They are now part of the order's grand_total (see
                                // applyBillCharges), so the ordinary distribution above
                                // already covers them and there is no surplus left.
                                return db.query(
                                    "UPDATE dining_tables SET status='Available', current_bill=0 WHERE id=? AND restaurant_id=?",
                                    [tableId, restaurantId],
                                    callback
                                );
                            };

                            // attrLine(msg, amountLeft, nextOrderIdx, allDone)
                            const attrLine = (line, amountLeft, orderIdx, allDone) => {
                                if (amountLeft <= 0) return allDone();   // this line fully placed

                                // Find the next order that still owes money.
                                let oi = orderIdx;
                                while (oi < orders.length && money(orders[oi].remaining) === 0) oi++;
                                if (oi >= orders.length) return allDone();   // no more orders to charge

                                const owed = money(orders[oi].remaining);
                                const take = money(Math.min(amountLeft, owed));
                                recordPayment(
                                    orders[oi].id,
                                    restaurantId,
                                    line.method,
                                    take,
                                    `Table settled by employee ${employeeId}`,
                                    (err) => {
                                        if (err) return callback(err);
                                        orders[oi].remaining = money(owed - take);
                                        // Move to that order's next line segment if money remains.
                                        attrLine(line, money(amountLeft - take), oi, allDone);
                                    }
                                );
                            };

                            const recordLines = (li, orderIdx, allDone) => {
                                if (li >= lines.length) return allDone();
                                attrLine(lines[li], money(lines[li].amount || 0), orderIdx, () => {
                                    recordLines(li + 1, orderIdx, allDone);
                                });
                            };

                            recordLines(0, 0, recordOrders);
                        }
                    );
                    });
                }
            );
        }
    );

};

// Insert a Success payment for an order, numbered PAY-<date>-NNNN.
const recordPayment = (orderId, restaurantId, method, amount, remarks, callback) => {

    const datePart = new Date().toISOString().split("T")[0].replace(/-/g, "");

    db.query(
        `SELECT payment_number FROM payments
         WHERE restaurant_id=? AND payment_number LIKE ?
         ORDER BY payment_number DESC LIMIT 1`,
        [restaurantId, `PAY-${datePart}-%`],
        (err, rows) => {
            if (err) return callback(err);

            const sequence = rows.length
                ? parseInt(rows[0].payment_number.split("-")[2], 10) + 1
                : 1;

            const paymentNumber = `PAY-${datePart}-${String(sequence).padStart(4, "0")}`;
            const allowed = ["Cash", "Card", "UPI", "Wallet", "Bank Transfer", "Split"];

            db.query(
                `INSERT INTO payments
                 (restaurant_id, order_id, payment_number, payment_method, amount, payment_status, remarks)
                 VALUES (?, ?, ?, ?, ?, 'Success', ?)`,
                [
                    restaurantId,
                    orderId,
                    paymentNumber,
                    allowed.includes(method) ? method : "Cash",
                    money(amount),
                    remarks || null
                ],
                callback
            );

        }
    );

};

// Cancel a single order-item before billing (waiter edits the bill). Deletes the
// item, recomputes its order's totals from the remaining items, and cancels the
// whole order if nothing is left. Tenant-scoped throughout.
const removeOrderItem = (itemId, restaurantId, callback) => {

    db.query(
        `SELECT o.id AS orderId
         FROM order_items oi
         INNER JOIN orders o ON oi.order_id = o.id
         WHERE oi.id = ? AND o.restaurant_id = ?`,
        [itemId, restaurantId],
        (err, rows) => {
            if (err) return callback(err);
            if (!rows.length) return callback(null, { affectedRows: 0 });
            const orderId = rows[0].orderId;

            db.query(
                `DELETE oi FROM order_items oi
                 INNER JOIN orders o ON oi.order_id = o.id
                 WHERE oi.id = ? AND o.restaurant_id = ?`,
                [itemId, restaurantId],
                (err) => {
                    if (err) return callback(err);

                    db.query(
                        `SELECT COALESCE(SUM(oi.total), 0) AS subtotal, COUNT(*) AS cnt
                         FROM order_items oi WHERE oi.order_id = ?`,
                        [orderId],
                        (err, sumRows) => {
                            if (err) return callback(err);
                            const cnt = Number(sumRows[0].cnt) || 0;

                            totalsForOrder(orderId, restaurantId, sumRows[0].subtotal, (err, t) => {
                                if (err) return callback(err);
                                const cancelClause = cnt === 0 ? ", order_status='Cancelled'" : "";

                                db.query(
                                    `UPDATE orders
                                     SET subtotal=?, tax=?, service_charge=?, charges_total=?, grand_total=?${cancelClause}
                                     WHERE id=? AND restaurant_id=?`,
                                    [t.subtotal, t.tax, t.service_charge, t.charges_total, t.grand_total, orderId, restaurantId],
                                    (err) => callback(err, { orderId, remaining: cnt })
                                );
                            });
                        }
                    );
                }
            );
        }
    );

};

// Recompute one order's subtotal/tax/grand_total from its remaining items.
const recomputeOrderTotals = (orderId, restaurantId, callback) => {
    db.query(
        `SELECT COALESCE(SUM(oi.total), 0) AS subtotal
         FROM order_items oi WHERE oi.order_id = ?`,
        [orderId],
        (err, rows) => {
            if (err) return callback(err);
            totalsForOrder(orderId, restaurantId, rows[0].subtotal, (err, t) => {
                if (err) return callback(err);
                db.query(
                    `UPDATE orders SET subtotal=?, tax=?, service_charge=?, charges_total=?, grand_total=?
                     WHERE id=? AND restaurant_id=?`,
                    [t.subtotal, t.tax, t.service_charge, t.charges_total, t.grand_total, orderId, restaurantId],
                    (err) => callback(err, { orderId, ...t })
                );
            });
        }
    );
};

// Add an item to a table's bill (item was served but not recorded). Inserted as
// already-served so it never hits the kitchen. Appends to the table's most
// recent active order, or creates a served order if none is open. Tenant-scoped.
const addBillItem = (tableId, restaurantId, menuItemId, quantity, employeeId, callback) => {

    const qty = Math.max(1, Number(quantity) || 1);

    db.query(
        "SELECT price FROM menu_items WHERE id=? AND restaurant_id=?",
        [menuItemId, restaurantId],
        (err, mrows) => {
            if (err) return callback(err);
            if (!mrows.length) return callback(new Error("Menu item not found."));
            const price = Number(mrows[0].price);
            const total = Math.round(price * qty * 100) / 100;

            const insertItem = (orderId) => {
                db.query(
                    `INSERT INTO order_items (order_id, menu_item_id, quantity, price, total, served)
                     VALUES (?, ?, ?, ?, ?, 1)`,
                    [orderId, menuItemId, qty, price, total],
                    (err) => {
                        if (err) return callback(err);
                        recomputeOrderTotals(orderId, restaurantId, callback);
                    }
                );
            };

            db.query(
                `SELECT id FROM orders
                 WHERE table_id=? AND restaurant_id=?
                   AND order_status IN ('Pending','Preparing','Ready','Served')
                 ORDER BY id DESC LIMIT 1`,
                [tableId, restaurantId],
                (err, orows) => {
                    if (err) return callback(err);
                    if (orows.length) return insertItem(orows[0].id);

                    // No open order — create a served one (won't reach the kitchen).
                    db.query(
                        `INSERT INTO orders
                         (restaurant_id, customer_id, table_id, employee_id, order_number,
                          order_type, order_status, subtotal, discount, tax, grand_total,
                          payment_status, notes)
                         VALUES (?, NULL, ?, ?, ?, 'Dine-In', 'Served', 0, 0, 0, 0, 'Pending', NULL)`,
                        [restaurantId, tableId, employeeId, `ORD-${Date.now()}`],
                        (err, res) => {
                            if (err) return callback(err);
                            insertItem(res.insertId);
                        }
                    );
                }
            );
        }
    );

};

// Set one order-item's quantity while editing the bill (does NOT touch order
// status, so it never creates a new kitchen ticket). Recomputes the order's
// totals. A quantity of 0 or less removes the item. Tenant-scoped.
const setItemQuantity = (itemId, restaurantId, quantity, callback) => {

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
        return removeOrderItem(itemId, restaurantId, callback);
    }

    db.query(
        `SELECT o.id AS orderId, oi.price
         FROM order_items oi
         INNER JOIN orders o ON oi.order_id = o.id
         WHERE oi.id = ? AND o.restaurant_id = ?`,
        [itemId, restaurantId],
        (err, rows) => {
            if (err) return callback(err);
            if (!rows.length) return callback(null, { affectedRows: 0 });
            const orderId = rows[0].orderId;
            const total = Math.round(Number(rows[0].price) * qty * 100) / 100;

            db.query(
                `UPDATE order_items oi
                 INNER JOIN orders o ON oi.order_id = o.id
                 SET oi.quantity = ?, oi.total = ?
                 WHERE oi.id = ? AND o.restaurant_id = ?`,
                [qty, total, itemId, restaurantId],
                (err) => {
                    if (err) return callback(err);

                    db.query(
                        `SELECT COALESCE(SUM(oi.total), 0) AS subtotal
                         FROM order_items oi WHERE oi.order_id = ?`,
                        [orderId],
                        (err, sumRows) => {
                            if (err) return callback(err);

                            totalsForOrder(orderId, restaurantId, sumRows[0].subtotal, (err, t) => {
                                if (err) return callback(err);

                                db.query(
                                    `UPDATE orders SET subtotal=?, tax=?, service_charge=?, charges_total=?, grand_total=?
                                     WHERE id=? AND restaurant_id=?`,
                                    [t.subtotal, t.tax, t.service_charge, t.charges_total, t.grand_total, orderId, restaurantId],
                                    (err) => callback(err, { orderId, quantity: qty })
                                );
                            });
                        }
                    );
                }
            );
        }
    );

};

// ---------------------------------------------------------------------------
// Bills history (cashier "Bills" screen) — settled bills that can be corrected
// and reprinted when an item was rung up twice or missed.
// ---------------------------------------------------------------------------

// Today's settled bills, newest first (tenant-scoped).
const getTodaysBills = (restaurantId, callback) => {

    const sql = `
        SELECT
            o.id,
            o.order_number,
            o.order_type,
            -- Cancelled bills are listed alongside settled ones. A cancelled
            -- number is never reused, so without showing it the sequence looks
            -- like it has lost a bill.
            o.order_status,
            o.table_id,
            o.subtotal,
            o.tax,
            o.service_charge,
            o.grand_total,
            o.created_at,
            o.updated_at,
            dt.table_name,
            u.full_name AS employee_name,
            (SELECT COALESCE(SUM(oi.quantity), 0)
             FROM order_items oi WHERE oi.order_id = o.id) AS item_count,
            (SELECT COALESCE(SUM(p.amount), 0)
             FROM payments p
             WHERE p.order_id = o.id AND p.payment_status = 'Success') AS paid_amount,
            (SELECT p.payment_method
             FROM payments p
             WHERE p.order_id = o.id AND p.payment_status = 'Success'
             ORDER BY p.id DESC LIMIT 1) AS payment_method,
            -- How many times this bill has been corrected, straight from the
            -- audit trail rather than guessed from timestamps.
            (SELECT COUNT(*)
             FROM activity_logs al
             WHERE al.restaurant_id = o.restaurant_id
               AND al.module = 'Billing'
               AND al.action = 'Bill Corrected'
               AND al.description LIKE CONCAT('Order #', o.id, ':%')) AS correction_count
        FROM orders o
        LEFT JOIN dining_tables dt ON o.table_id = dt.id
        LEFT JOIN users u ON o.employee_id = u.id
        WHERE o.restaurant_id = ?
          AND o.order_status IN ('Completed','Cancelled')
          AND DATE(o.created_at) = CURDATE()
        ORDER BY o.id DESC
    `;

    db.query(sql, [restaurantId], callback);

};

// One bill's header — everything the receipt needs (tenant-scoped).
const getBillById = (orderId, restaurantId, callback) => {

    const sql = `
        SELECT
            o.id,
            o.order_number,
            o.order_type,
            o.order_status,
            o.subtotal,
            o.tax,
            o.service_charge,
            o.charges_total,
            o.grand_total,
            o.created_at,
            dt.table_name,
            r.restaurant_name,
            u.full_name AS employee_name,
            (SELECT p.payment_method
             FROM payments p
             WHERE p.order_id = o.id AND p.payment_status = 'Success'
             ORDER BY p.id DESC LIMIT 1) AS payment_method
        FROM orders o
        LEFT JOIN dining_tables dt ON o.table_id = dt.id
        LEFT JOIN restaurants r ON o.restaurant_id = r.id
        LEFT JOIN users u ON o.employee_id = u.id
        WHERE o.id = ? AND o.restaurant_id = ?
    `;

    db.query(sql, [orderId, restaurantId], (err, rows) => {

        if (err) return callback(err);
        if (!rows.length) return callback(null, rows);

        // Charge lines by name, so a reprinted bill shows the same breakdown the
        // customer was originally handed. Without them the reprint would carry a
        // grand_total its own printed lines don't add up to.
        db.query(
            "SELECT charge_name, amount FROM order_charges WHERE order_id = ? ORDER BY id",
            [orderId],
            (err, chargeRows) => {
                if (err) return callback(err);
                rows[0].charges = chargeRows || [];
                callback(null, rows);
            }
        );

    });

};

// Add an item to ONE specific order, whatever its status.
//
// Distinct from addBillItem, which targets a *table's* most recent active order
// — that can't reach a settled bill or a counter order, which is exactly what
// the Bills screen has to correct. Inserted already-served so a corrected bill
// never sends a fresh ticket to the kitchen.
const addItemToOrder = (orderId, restaurantId, menuItemId, quantity, callback) => {

    const qty = Math.max(1, Number(quantity) || 1);

    db.query(
        `SELECT o.id FROM orders o WHERE o.id = ? AND o.restaurant_id = ?`,
        [orderId, restaurantId],
        (err, orows) => {
            if (err) return callback(err);
            if (!orows.length) return callback(new Error("Bill not found."));

            db.query(
                "SELECT price FROM menu_items WHERE id=? AND restaurant_id=?",
                [menuItemId, restaurantId],
                (err, mrows) => {
                    if (err) return callback(err);
                    if (!mrows.length) return callback(new Error("Menu item not found."));

                    const price = Number(mrows[0].price);

                    db.query(
                        `INSERT INTO order_items
                         (order_id, menu_item_id, quantity, price, total, served)
                         VALUES (?, ?, ?, ?, ?, 1)`,
                        [orderId, menuItemId, qty, price, money(price * qty)],
                        (err) => {
                            if (err) return callback(err);
                            recomputeOrderTotals(orderId, restaurantId, callback);
                        }
                    );
                }
            );
        }
    );

};

// Re-settle an edited bill: recompute its totals from the items that are now on
// it, then bring the recorded payment into line so the till matches the paper.
// Returns { before, after } so the caller can write a meaningful audit entry.
const rebillOrder = (orderId, restaurantId, paymentMethod, callback) => {

    // "What the customer was charged" is the recorded payment, not the order
    // row — by the time we get here the item edits have already rewritten the
    // order's totals, so comparing against it would always report no change.
    db.query(
        `SELECT p.id, p.payment_method, p.amount, o.grand_total
         FROM orders o
         LEFT JOIN payments p
           ON p.order_id = o.id AND p.restaurant_id = o.restaurant_id
          AND p.payment_status = 'Success'
         WHERE o.id = ? AND o.restaurant_id = ?
         ORDER BY p.id DESC LIMIT 1`,
        [orderId, restaurantId],
        (err, before) => {
            if (err) return callback(err);
            if (!before.length) return callback(new Error("Bill not found."));

            const paidRow = before[0].id ? before[0] : null;
            const previousTotal = Number(
                paidRow ? paidRow.amount : before[0].grand_total
            );

            recomputeOrderTotals(orderId, restaurantId, (err, totals) => {

                if (err) return callback(err);

                const method = paymentMethod || (paidRow ? paidRow.payment_method : "Cash");

                const done = () => callback(null, {
                    orderId,
                    previousTotal,
                    newTotal: totals.grand_total,
                    difference: money(totals.grand_total - previousTotal),
                    ...totals
                });

                // No payment on record (e.g. a bill settled before this feature
                // existed) — create one rather than lose the sale.
                if (!paidRow) {
                    return recordPayment(
                        orderId, restaurantId, method, totals.grand_total,
                        "Recorded on bill correction",
                        (err) => err ? callback(err) : done()
                    );
                }

                db.query(
                    `UPDATE payments SET amount=?, payment_method=?
                     WHERE id=? AND restaurant_id=?`,
                    [totals.grand_total, method, paidRow.id, restaurantId],
                    (err) => {
                        if (err) return callback(err);

                        db.query(
                            "UPDATE orders SET payment_status='Paid' WHERE id=? AND restaurant_id=?",
                            [orderId, restaurantId],
                            (err) => err ? callback(err) : done()
                        );
                    }
                );

            });
        }
    );

};

// Count of orders created today (tenant-scoped)
const getTodaysOrderCount = (restaurantId, callback) => {

    db.query(
        `SELECT COUNT(*) AS total
         FROM orders
         WHERE restaurant_id = ? AND DATE(created_at) = CURDATE()
           AND order_status != 'Cancelled'`,
        [restaurantId],
        callback
    );

};

module.exports = {
    getAllOrders,
    getOrderById,
    priceCartItems,
    createOrder,
    createOrderItems,
    deleteOrder,
    getInvoiceByOrderId,
    getInvoiceItems,
    updateTableStatus,
    getRunningOrders,
    getOrderDetails,
    updateOrderTotals,
    deleteOrderItems,
    cancelOrder,
    getTodaysOrderCount,
    getTableActiveItems,
    settleTable,
    markServed,
    markTableServed,
    markItemServed,
    removeOrderItem,
    setItemQuantity,
    addBillItem,
    recomputeOrderTotals,
    recordPayment,
    getTodaysBills,
    getBillById,
    addItemToOrder,
    rebillOrder
};
