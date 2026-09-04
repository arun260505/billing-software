const test = require("node:test");
const assert = require("node:assert");

const { applyRows, serializeRows } = require("../sync/syncEngine");

/*
| The sync engine moves rows between two independent databases over a channel
| authenticated by a machine key. Rows arriving there are attacker-shaped input:
| the column list used to come straight from the pushed JSON's keys, and a node
| holding one restaurant's key could write rows into another. These tests pin
| both behaviours.
|
| syncEngine takes its connection as an argument, so a fake stands in for MySQL.
*/

// Minimal mysql2-promise stand-in. Answers the INFORMATION_SCHEMA column probe
// and the FK parent lookups, and records every INSERT it is asked to run.
function fakeDb({ columns, parents = {} }) {
    const inserts = [];
    return {
        inserts,
        async query(sql, params) {
            if (sql.includes("INFORMATION_SCHEMA.COLUMNS")) {
                return [columns.map((c) => ({ COLUMN_NAME: c }))];
            }
            if (/^SELECT id FROM/.test(sql.trim())) {
                const uuid = params[0];
                return [parents[uuid] ? [{ id: parents[uuid] }] : []];
            }
            if (/^SELECT id, uuid FROM/.test(sql.trim())) {
                return [[]];
            }
            inserts.push({ sql, params });
            return [{ affectedRows: 1 }];
        }
    };
}

const ORDERS = {
    table: "orders",
    direction: "up",
    fks: { restaurant_id: "restaurants" }
};

const ORDER_ITEMS = {
    table: "order_items",
    direction: "up",
    fks: { order_id: "orders" }
};

test("columns not present on the table are dropped, not inserted", async () => {
    const db = fakeDb({
        columns: ["id", "uuid", "restaurant_id", "grand_total"],
        parents: { "rest-uuid": 7 }
    });

    const res = await applyRows(db, ORDERS, [{
        uuid: "o1",
        restaurant_id__uuid: "rest-uuid",
        grand_total: 100,
        bogus_column: "nope"
    }]);

    assert.strictEqual(res.applied, 1);
    const { sql } = db.inserts[0];
    assert.ok(sql.includes("grand_total"), "real column should survive");
    assert.ok(!sql.includes("bogus_column"), "unknown column must be dropped");
});

test("a column name carrying a backtick cannot escape the quoting", async () => {
    const db = fakeDb({
        columns: ["id", "uuid", "restaurant_id", "grand_total"],
        parents: { "rest-uuid": 7 }
    });

    await applyRows(db, ORDERS, [{
        uuid: "o1",
        restaurant_id__uuid: "rest-uuid",
        grand_total: 100,
        "grand_total`, (SELECT 1)) -- ": "injected"
    }]);

    const { sql } = db.inserts[0];
    assert.ok(!sql.includes("--"), "injected fragment must never reach the SQL");
    assert.ok(!sql.includes("SELECT 1"), "injected subquery must never reach the SQL");
});

test("pushed rows are pinned to the restaurant the sync key authorises", async () => {
    const db = fakeDb({
        columns: ["id", "uuid", "restaurant_id", "grand_total"],
        parents: { "rest-uuid": 7 }
    });

    // The row claims no restaurant; scope supplies it.
    const res = await applyRows(db, ORDERS, [{
        uuid: "o1",
        restaurant_id__uuid: "rest-uuid",
        grand_total: 100
    }], { restaurantId: 7 });

    assert.strictEqual(res.applied, 1);
    const { sql, params } = db.inserts[0];
    const idx = sql.slice(0, sql.indexOf("VALUES"))
        .split(",")
        .findIndex((c) => c.includes("restaurant_id"));
    assert.strictEqual(params[idx], 7);
});

test("a row pointing at another restaurant's uuid is rejected, not rewritten", async () => {
    // The real cross-tenant vector. Identity travels as the PARENT uuid, so a
    // node pushes a foreign restaurant_id__uuid, not a foreign int id.
    const db = fakeDb({
        columns: ["id", "uuid", "restaurant_id", "grand_total"],
        parents: { "rest-uuid": 7, "other-uuid": 99 }
    });

    const res = await applyRows(db, ORDERS, [{
        uuid: "o1",
        restaurant_id__uuid: "other-uuid",   // a restaurant this key does not speak for
        grand_total: 100
    }], { restaurantId: 7 });

    assert.strictEqual(res.applied, 0);
    assert.strictEqual(res.rejected, 1);
    assert.strictEqual(db.inserts.length, 0, "nothing may be written for a rejected row");
});

test("a raw restaurant_id in the payload never overrides the resolved uuid", async () => {
    // FK translation runs before the scope check, so the int id a sender puts
    // in the body is discarded — identity is the uuid it points at, and that is
    // what gets scope-checked.
    const db = fakeDb({
        columns: ["id", "uuid", "restaurant_id", "grand_total"],
        parents: { "rest-uuid": 7 }
    });

    const res = await applyRows(db, ORDERS, [{
        uuid: "o1",
        restaurant_id: 99,                   // ignored
        restaurant_id__uuid: "rest-uuid",    // authoritative
        grand_total: 100
    }], { restaurantId: 7 });

    assert.strictEqual(res.applied, 1);
    const { sql, params } = db.inserts[0];
    const idx = sql.slice(0, sql.indexOf("VALUES"))
        .split(",")
        .findIndex((c) => c.includes("restaurant_id"));
    assert.strictEqual(params[idx], 7, "resolved id must win over the body's 99");
});

test("tables without a restaurant_id column still sync under scope", async () => {
    // order_items hangs off orders and has no restaurant_id of its own; scoping
    // must not accidentally invent one or drop the row.
    const db = fakeDb({
        columns: ["id", "uuid", "order_id", "quantity"],
        parents: { "order-uuid": 42 }
    });

    const res = await applyRows(db, ORDER_ITEMS, [{
        uuid: "oi1",
        order_id__uuid: "order-uuid",
        quantity: 2
    }], { restaurantId: 7 });

    assert.strictEqual(res.applied, 1);
    assert.ok(!db.inserts[0].sql.includes("restaurant_id"));
});

test("a row whose parent has not arrived yet is deferred, not dropped", async () => {
    const db = fakeDb({
        columns: ["id", "uuid", "order_id", "quantity"],
        parents: {}                       // parent order not synced yet
    });

    const res = await applyRows(db, ORDER_ITEMS, [{
        uuid: "oi1",
        order_id__uuid: "missing-order",
        quantity: 2
    }]);

    assert.strictEqual(res.applied, 0);
    assert.strictEqual(res.deferred, 1);
    assert.strictEqual(db.inserts.length, 0);
});

test("id and synced_at are never copied between databases", async () => {
    const db = fakeDb({
        columns: ["id", "uuid", "restaurant_id", "synced_at", "grand_total"],
        parents: { "rest-uuid": 7 }
    });

    await applyRows(db, ORDERS, [{
        id: 12345,
        uuid: "o1",
        synced_at: "2026-01-01 00:00:00",
        restaurant_id__uuid: "rest-uuid",
        grand_total: 100
    }]);

    const cols = db.inserts[0].sql.slice(0, db.inserts[0].sql.indexOf("VALUES"));
    assert.ok(!cols.includes("`id`"), "local INT id must not cross databases");
    assert.ok(!cols.includes("synced_at"), "synced_at is per-database bookkeeping");
});

test("serializeRows converts Dates to MySQL datetimes, not ISO strings", async () => {
    // JSON would render a Date as "…T…Z", which MySQL rejects on insert.
    const db = fakeDb({ columns: [] });
    const rows = [{ uuid: "o1", created_at: new Date(2026, 0, 15, 9, 5, 3) }];

    const [out] = await serializeRows(db, { table: "orders", fks: {} }, rows);

    assert.strictEqual(out.created_at, "2026-01-15 09:05:03");
});
