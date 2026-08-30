/*
|--------------------------------------------------------------------------
| Sync engine — the FK-uuid translation + uuid-keyed upsert
|--------------------------------------------------------------------------
| Rows move between two independent databases that keep their own INT PKs.
| Identity is the `uuid`. On the way out we attach each foreign key's PARENT
| uuid (`<col>__uuid`); on the way in we resolve that back to the receiver's
| local INT id. A row whose parent hasn't arrived yet is skipped and retried
| next cycle (tables are processed parents-first, so this is rare).
|
| Every function takes a promise-wrapped mysql2 connection/pool (`dbp`) so the
| same code serves both the local backend and the cloud.
*/

// Columns never copied verbatim between databases.
const SKIP_COLS = new Set(["id", "synced_at"]);

// mysql2 returns DATETIME/TIMESTAMP as JS Date objects; JSON would turn those
// into ISO strings ("…T…Z") that MySQL rejects on insert. Convert to MySQL's
// "YYYY-MM-DD HH:MM:SS" in the same wall-clock the driver read, so the value
// round-trips unchanged.
function toMysqlDate(d) {
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
           `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function normalizeValue(v) {
    return v instanceof Date ? toMysqlDate(v) : v;
}

async function serializeRows(dbp, def, rows) {
    // Resolve each FK int id -> parent uuid, in one query per FK column.
    const parentUuidByCol = {};
    for (const [fkCol, parentTable] of Object.entries(def.fks)) {
        parentUuidByCol[fkCol] = {};
        const ids = [...new Set(rows.map((r) => r[fkCol]).filter((v) => v != null))];
        if (ids.length) {
            const [prows] = await dbp.query(
                `SELECT id, uuid FROM \`${parentTable}\` WHERE id IN (?)`,
                [ids]
            );
            for (const p of prows) parentUuidByCol[fkCol][p.id] = p.uuid;
        }
    }

    return rows.map((row) => {
        const out = {};
        for (const [k, v] of Object.entries(row)) {
            if (!SKIP_COLS.has(k)) out[k] = normalizeValue(v);
        }
        for (const fkCol of Object.keys(def.fks)) {
            out[`${fkCol}__uuid`] =
                row[fkCol] != null ? (parentUuidByCol[fkCol][row[fkCol]] ?? null) : null;
        }
        return out;
    });
}

async function applyRows(dbp, def, rows) {
    let applied = 0;
    let deferred = 0;

    for (const incoming of rows) {
        const data = { ...incoming };
        let missingParent = false;

        for (const [fkCol, parentTable] of Object.entries(def.fks)) {
            const parentUuid = data[`${fkCol}__uuid`];
            delete data[`${fkCol}__uuid`];
            if (parentUuid == null) {
                data[fkCol] = null;
                continue;
            }
            const [prows] = await dbp.query(
                `SELECT id FROM \`${parentTable}\` WHERE uuid = ? LIMIT 1`,
                [parentUuid]
            );
            if (!prows.length) {
                missingParent = true;
                break;
            }
            data[fkCol] = prows[0].id;
        }

        if (missingParent) {
            deferred++;
            continue; // parent not synced yet — retried next cycle
        }

        for (const c of SKIP_COLS) delete data[c];

        const cols = Object.keys(data);
        const placeholders = cols.map(() => "?").join(", ");
        const updates = cols
            .filter((c) => c !== "uuid")
            .map((c) => `\`${c}\` = VALUES(\`${c}\`)`)
            .join(", ");

        // Upsert keyed on the uuid UNIQUE index.
        const sql =
            `INSERT INTO \`${def.table}\` (${cols.map((c) => `\`${c}\``).join(", ")}) ` +
            `VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updates}`;

        await dbp.query(sql, cols.map((c) => data[c]));
        applied++;
    }

    return { applied, deferred };
}

// UP: rows changed locally but not yet pushed (or changed since last push).
async function getUnsyncedUp(dbp, def) {
    const [rows] = await dbp.query(
        `SELECT * FROM \`${def.table}\`
         WHERE synced_at IS NULL OR updated_at > synced_at`
    );
    return rows;
}

async function markSynced(dbp, table, uuids) {
    if (!uuids.length) return;
    await dbp.query(
        `UPDATE \`${table}\` SET synced_at = NOW() WHERE uuid IN (?)`,
        [uuids]
    );
}

// DOWN / pull: rows changed on the source since the receiver's high-water mark,
// scoped to one restaurant (the cloud holds many; a node pulls only its own).
async function getChangedSince(dbp, def, since, scope = {}) {
    const cutoff = since || "1970-01-01 00:00:00";
    let sql = `SELECT * FROM \`${def.table}\` WHERE updated_at > ?`;
    const params = [cutoff];

    if (def.table === "restaurants" && scope.restaurantUuid) {
        sql += ` AND uuid = ?`;
        params.push(scope.restaurantUuid);
    } else if (scope.restaurantId != null) {
        sql += ` AND restaurant_id = ?`;
        params.push(scope.restaurantId);
    }

    const [rows] = await dbp.query(sql, params);
    return rows;
}

module.exports = {
    serializeRows,
    applyRows,
    getUnsyncedUp,
    markSynced,
    getChangedSince
};
