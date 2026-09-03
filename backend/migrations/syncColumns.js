const db = require("../config/db").promise();

/*
|--------------------------------------------------------------------------
| Sync schema columns (Option 2: keep INT PKs, add a uuid for cross-DB identity)
|--------------------------------------------------------------------------
| Adds, idempotently, the columns the offline/online sync engine needs:
|   uuid       — global identity so two restaurants' rows never collide
|   deleted_at — soft delete, so deletions can sync (NULL = live)
|   synced_at  — UP tables only: NULL = not yet pushed to the cloud
|   updated_at — added where missing, for change detection
|
| Runs on boot after the inline table migrations. Safe to run repeatedly.
| A table that does not exist yet is skipped (a fresh DB gets these columns
| baked into the schema dump used by the installer).
*/

// up: true  = restaurant-owned, syncs UP to the cloud (gets synced_at)
// up: false = admin-owned, syncs DOWN to the restaurant
const SYNC_TABLES = {
    orders:          { up: true },
    order_items:     { up: true },
    payments:        { up: true },
    dining_tables:   { up: true },
    customers:       { up: true },
    restaurants:     { up: false },
    categories:      { up: false },
    menu_items:      { up: false },
    charges:         { up: false },
    bill_formats:    { up: false },
    kitchen_formats: { up: false },
    printer_settings: { up: false },
    users:           { up: false },
    roles:           { up: false },
    settings:        { up: false }
};

async function tableExists(table) {
    const [rows] = await db.query(
        `SELECT 1 FROM INFORMATION_SCHEMA.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1`,
        [table]
    );
    return rows.length > 0;
}

async function columnExists(table, column) {
    const [rows] = await db.query(
        `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
        [table, column]
    );
    return rows.length > 0;
}

async function indexExists(table, indexName) {
    const [rows] = await db.query(
        `SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1`,
        [table, indexName]
    );
    return rows.length > 0;
}

async function ensureColumn(table, column, definition) {
    if (!(await columnExists(table, column))) {
        await db.query(`ALTER TABLE \`${table}\` ADD COLUMN ${column} ${definition}`);
    }
}

async function ensureUuid(table) {
    // 1) add nullable, 2) backfill each existing row with a distinct UUID,
    // 3) make NOT NULL with an expression default so future inserts auto-fill,
    // 4) add a UNIQUE index.
    if (!(await columnExists(table, "uuid"))) {
        await db.query(`ALTER TABLE \`${table}\` ADD COLUMN uuid CHAR(36) NULL`);
    }
    await db.query(`UPDATE \`${table}\` SET uuid = (UUID()) WHERE uuid IS NULL`);
    await db.query(`ALTER TABLE \`${table}\` MODIFY COLUMN uuid CHAR(36) NOT NULL DEFAULT (UUID())`);
    const idx = `uq_${table}_uuid`;
    if (!(await indexExists(table, idx))) {
        await db.query(`ALTER TABLE \`${table}\` ADD UNIQUE INDEX \`${idx}\` (uuid)`);
    }
}

async function runSyncSchema() {
    for (const [table, cfg] of Object.entries(SYNC_TABLES)) {
        if (!(await tableExists(table))) continue;

        await ensureUuid(table);
        await ensureColumn(table, "deleted_at", "TIMESTAMP NULL DEFAULT NULL");

        if (cfg.up) {
            await ensureColumn(table, "synced_at", "TIMESTAMP NULL DEFAULT NULL");
        }

        if (!(await columnExists(table, "updated_at"))) {
            await ensureColumn(
                table,
                "updated_at",
                "TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
            );
        }
    }

    // Feature columns from later migrations (002 served, 003 service_charge).
    // A DB set up before those migrations is missing them, which breaks order
    // creation / billing with "Unknown column '...'". Add them idempotently so
    // any older database self-heals on boot.
    if (await tableExists("orders")) {
        await ensureColumn("orders", "service_charge", "DECIMAL(10,2) NOT NULL DEFAULT 0.00");
    }
    if (await tableExists("order_items")) {
        await ensureColumn("order_items", "served", "TINYINT(1) NOT NULL DEFAULT 0");
    }
    // 007: the printer devices the cashier till prints to.
    if (await tableExists("printer_settings")) {
        await ensureColumn("printer_settings", "cashier_printer", "VARCHAR(150) DEFAULT NULL");
        await ensureColumn("printer_settings", "kitchen_printer", "VARCHAR(150) DEFAULT NULL");
    }

    console.log("Sync schema columns ready.");
}

module.exports = { runSyncSchema, SYNC_TABLES };
