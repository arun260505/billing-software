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
    if (await tableExists("printer_settings")) {
        // Lets a waiter print + settle a bill directly (Admin toggle); off by
        // default so existing tills keep routing bills through the cashier.
        await ensureColumn("printer_settings", "waiter_can_print_bill", "TINYINT(1) NOT NULL DEFAULT 0");
    }
    // 007: the printer devices the cashier till prints to.
    if (await tableExists("printer_settings")) {
        await ensureColumn("printer_settings", "cashier_printer", "VARCHAR(150) DEFAULT NULL");
        await ensureColumn("printer_settings", "kitchen_printer", "VARCHAR(150) DEFAULT NULL");
    }

    // 010: GST and the service charge became charge rows.
    if (await tableExists("charges")) {
        // Whether charge_role is missing is what marks a database as not yet
        // migrated, so read it BEFORE adding the column.
        const firstRun = !(await columnExists("charges", "charge_role"));

        await ensureColumn("charges", "charge_role", "VARCHAR(10) NOT NULL DEFAULT 'Charge'");
        await ensureColumn("charges", "auto_apply", "TINYINT(1) NOT NULL DEFAULT 0");

        if (firstRun) await backfillTaxCharges();
    }

    console.log("Sync schema columns ready.");
}

/*
| One-time backfill for migration 010: turn each existing restaurant's effective
| GST / service rates into the charge rows that now carry them, so no till
| changes what it bills on upgrade. See migrations/010_charge_roles.sql.
|
| Runs only in the pass that first adds charge_role — deleting the seeded GST row
| must not bring it back on the next restart — and only on a node that owns the
| charges table. `charges` syncs cloud -> local, so a local node seeding its own
| rows would end up with two GST charges the moment the cloud's copy arrived.
*/
async function backfillTaxCharges() {

    if (require("../sync/syncConfig").isLocal) {
        console.log("Charge roles: local node, leaving the GST/service backfill to the cloud.");
        return;
    }

    try {
        if (!(await tableExists("restaurants"))) return;

        // The rate each restaurant was effectively billing at: its own if it set
        // one, otherwise the 5% / 2% the biller forced on everyone who left the
        // settings columns at 0.
        const hasSettings = await tableExists("settings");
        const [restaurants] = hasSettings
            ? await db.query(
                `SELECT r.id,
                        COALESCE(s.tax_percentage, 0) AS tax_percentage,
                        COALESCE(s.service_charge, 0) AS service_charge
                 FROM restaurants r
                 LEFT JOIN settings s ON s.restaurant_id = r.id`
            )
            : await db.query("SELECT id, 0 AS tax_percentage, 0 AS service_charge FROM restaurants");

        // Done as two statements rather than an INSERT ... SELECT with a NOT
        // EXISTS on `charges`: MySQL refuses to read the insert target inside
        // its own SELECT (error 1093).
        const [taken] = await db.query(
            "SELECT restaurant_id, charge_role FROM charges WHERE charge_role IN ('Tax', 'Service')"
        );
        const has = new Set(taken.map((t) => `${t.restaurant_id}:${t.charge_role}`));

        // Number() drops trailing zeros on its own, so a name reads "GST 5%" and
        // "GST 12.5%" rather than "GST 5.00%" on every bill.
        const rows = [];
        for (const r of restaurants) {
            const tax = Number(r.tax_percentage) > 0 ? Number(r.tax_percentage) : 5;
            const svc = Number(r.service_charge) > 0 ? Number(r.service_charge) : 2;

            if (!has.has(`${r.id}:Tax`)) {
                rows.push([
                    r.id, `GST ${tax}%`,
                    "Carried over from Settings when GST moved into Charges. Edit or delete it if this restaurant does not charge GST.",
                    "Percentage", "Tax", tax, 1, 1, 1, 1, 0, "Active"
                ]);
            }
            if (!has.has(`${r.id}:Service`)) {
                rows.push([
                    r.id, `Service Charge ${svc}%`,
                    "Carried over from Settings when the service charge moved into Charges. Edit or delete it if this restaurant does not levy one.",
                    // Dine-in only, which is where a service charge belongs and
                    // what the old hardcoded one effectively was.
                    "Percentage", "Service", svc, 1, 1, 0, 0, 0, "Active"
                ]);
            }
        }

        if (!rows.length) {
            console.log("Charge roles: nothing to backfill.");
            return;
        }

        await db.query(
            `INSERT INTO charges
                (restaurant_id, charge_name, description, charge_type, charge_role, amount,
                 auto_apply, applies_dinein, applies_takeaway, applies_delivery, apply_tax, status)
             VALUES ?`,
            [rows]
        );
        console.log(`Charge roles: seeded ${rows.length} GST / service-charge rows from Settings.`);
    } catch (err) {
        // A failed backfill must not stop the server booting — it leaves the
        // restaurant billing no tax, which is loud and correctable, rather than
        // taking the till down mid-service.
        console.error("Charge roles: GST/service backfill failed —", err.message);
    }
}

module.exports = { runSyncSchema, SYNC_TABLES };
