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
            if (!SKIP_COLS.has(k)) out[k] = v;
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

// DOWN / pull: rows changed on the source since the receiver's high-water mark.
async function getChangedSince(dbp, def, since) {
    const cutoff = since || "1970-01-01 00:00:00";
    const [rows] = await dbp.query(
        `SELECT * FROM \`${def.table}\` WHERE updated_at > ?`,
        [cutoff]
    );
    return rows;
}

module.exports = {
    serializeRows,
    applyRows,
    getUnsyncedUp,
    markSynced,
    getChangedSince
};
