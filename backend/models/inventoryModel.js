const db = require("../config/db");

const dbp = db.promise();

/*
| Stock kept by the business (a salon's shampoo, colour, towels).
|
| The quantity on hand lives on inventory_items, and nothing changes it except
| adjustStock(), which writes a movement row in the same transaction. So the
| log always adds up to the number on the item, and the owner can see where
| stock went.
|
| Every query is scoped to the restaurant id from the JWT.
*/

const MOVEMENT_TYPES = ["In", "Out", "Adjust"];

const qty2 = (n) => Math.round(Number(n) * 100) / 100;

exports.MOVEMENT_TYPES = MOVEMENT_TYPES;

exports.list = async (restaurantId) => {
    const [rows] = await dbp.query(
        `SELECT i.*,
                (i.quantity <= 0)              AS is_out,
                (i.quantity <= i.min_quantity) AS is_low
         FROM inventory_items i
         WHERE i.restaurant_id = ? AND i.deleted_at IS NULL
         ORDER BY i.item_name ASC`,
        [restaurantId]
    );
    return rows;
};

exports.summary = async (restaurantId) => {
    const [[row]] = await dbp.query(
        `SELECT
            COUNT(*) AS total_items,
            COALESCE(SUM(status = 'Active' AND quantity > 0 AND quantity <= min_quantity), 0) AS low_stock,
            COALESCE(SUM(status = 'Active' AND quantity <= 0), 0) AS out_of_stock,
            COALESCE(SUM(quantity * cost_price), 0) AS stock_value
         FROM inventory_items
         WHERE restaurant_id = ? AND deleted_at IS NULL`,
        [restaurantId]
    );
    return {
        total_items: Number(row.total_items) || 0,
        low_stock: Number(row.low_stock) || 0,
        out_of_stock: Number(row.out_of_stock) || 0,
        stock_value: qty2(row.stock_value || 0)
    };
};

// Create an item. Opening stock is recorded as its first movement, so the log
// starts from the same number the item does.
exports.create = async (restaurantId, item, userId) => {
    const conn = await dbp.getConnection();
    try {
        await conn.beginTransaction();

        const [result] = await conn.query(
            `INSERT INTO inventory_items
                (restaurant_id, item_name, sku, category, unit, quantity, min_quantity, cost_price, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                restaurantId, item.item_name, item.sku, item.category, item.unit,
                item.quantity, item.min_quantity, item.cost_price, item.status
            ]
        );

        if (item.quantity > 0) {
            await conn.query(
                `INSERT INTO inventory_movements
                    (restaurant_id, inventory_item_id, movement_type, quantity, balance_after, note, created_by)
                 VALUES (?, ?, 'In', ?, ?, 'Opening stock', ?)`,
                [restaurantId, result.insertId, item.quantity, item.quantity, userId || null]
            );
        }

        await conn.commit();
        return result.insertId;
    } catch (e) {
        await conn.rollback();
        throw e;
    } finally {
        conn.release();
    }
};

// Edit an item's details. Quantity is deliberately not editable here — it only
// moves through adjustStock(), so every change is on the log.
exports.update = async (id, restaurantId, item) => {
    const [result] = await dbp.query(
        `UPDATE inventory_items
            SET item_name = ?, sku = ?, category = ?, unit = ?,
                min_quantity = ?, cost_price = ?, status = ?
          WHERE id = ? AND restaurant_id = ? AND deleted_at IS NULL`,
        [
            item.item_name, item.sku, item.category, item.unit,
            item.min_quantity, item.cost_price, item.status,
            id, restaurantId
        ]
    );
    return result.affectedRows;
};

// Soft delete so the removal syncs to the till.
exports.remove = async (id, restaurantId) => {
    const [result] = await dbp.query(
        "UPDATE inventory_items SET deleted_at = NOW() WHERE id = ? AND restaurant_id = ? AND deleted_at IS NULL",
        [id, restaurantId]
    );
    return result.affectedRows;
};

/*
| Move stock.
|   In     — `quantity` received, added on.
|   Out    — `quantity` used / sold / damaged, taken off.
|   Adjust — `quantity` is what was physically counted; the item is set to it.
|
| The row is locked for the read-modify-write, so two people moving the same
| item at once can't both start from the old number. Stock never goes below
| zero. Returns { item } on success, { notFound } or { problem } otherwise.
*/
exports.adjustStock = async (id, restaurantId, { movement_type, quantity, note }, userId) => {
    const conn = await dbp.getConnection();
    try {
        await conn.beginTransaction();

        const [[item]] = await conn.query(
            `SELECT id, item_name, unit, quantity
             FROM inventory_items
             WHERE id = ? AND restaurant_id = ? AND deleted_at IS NULL
             FOR UPDATE`,
            [id, restaurantId]
        );

        if (!item) {
            await conn.rollback();
            return { notFound: true };
        }

        const current = Number(item.quantity);
        const delta =
            movement_type === "In"  ? qty2(quantity) :
            movement_type === "Out" ? -qty2(quantity) :
            qty2(quantity - current);
        const next = qty2(current + delta);

        if (next < 0) {
            await conn.rollback();
            return { problem: `Only ${current} ${item.unit} of ${item.item_name} in stock.` };
        }

        if (delta === 0) {
            await conn.rollback();
            return { problem: "That doesn't change the stock." };
        }

        await conn.query(
            "UPDATE inventory_items SET quantity = ? WHERE id = ? AND restaurant_id = ?",
            [next, id, restaurantId]
        );

        await conn.query(
            `INSERT INTO inventory_movements
                (restaurant_id, inventory_item_id, movement_type, quantity, balance_after, note, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [restaurantId, id, movement_type, delta, next, note || null, userId || null]
        );

        await conn.commit();
        return { item: { id: item.id, quantity: next, change: delta } };
    } catch (e) {
        await conn.rollback();
        throw e;
    } finally {
        conn.release();
    }
};

// The movement log, newest first — for one item, or across all of them.
exports.movements = async (restaurantId, itemId = null, limit = 100) => {
    const params = [restaurantId];
    let where = "m.restaurant_id = ? AND m.deleted_at IS NULL";
    if (itemId) {
        where += " AND m.inventory_item_id = ?";
        params.push(itemId);
    }
    params.push(Math.min(Math.max(Number(limit) || 100, 1), 500));

    const [rows] = await dbp.query(
        `SELECT m.id, m.inventory_item_id, m.movement_type, m.quantity, m.balance_after,
                m.note, m.created_at,
                i.item_name, i.unit,
                u.full_name AS created_by_name
         FROM inventory_movements m
         JOIN inventory_items i ON i.id = m.inventory_item_id
         LEFT JOIN users u ON u.id = m.created_by
         WHERE ${where}
         ORDER BY m.created_at DESC, m.id DESC
         LIMIT ?`,
        params
    );
    return rows;
};
