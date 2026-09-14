/*
|--------------------------------------------------------------------------
| Seed: Crystal Cuts salon service menu
|--------------------------------------------------------------------------
| Loads the full salon price list (transcribed from the studio's printed
| album) into the salon tenant, replacing the old placeholder services.
|
| WHERE TO RUN THIS
|   categories + menu_items are DOWN-sync tables (cloud -> till), so the CLOUD
|   is the source of truth. Run this on the cloud server (its .env points at the
|   cloud DB); the new menu then syncs down to every till on the next pull.
|   Running it against a till's local DB is pointless — the next pull overwrites
|   it with the cloud's copy.
|
| WHAT IT DOES (in one transaction)
|   1. Finds the salon tenant (by uuid, else the single business_type='salon').
|   2. Soft-deletes the salon's existing SERVICE menu items and the categories
|      they sat in. Sellable-inventory PRODUCT mirrors (menu_items with a non-null
|      inventory_item_id) and the categories those products use are left alone, so
|      stock selling keeps working.
|   3. Inserts the new categories (men first, then women, then the rest — the
|      order the owner asked for) and every service under them. Hair services
|      priced by hair length become two items each: "… (M)" and "… (L)".
|
| Idempotent: re-running soft-deletes the previous run's services and re-inserts
| a fresh copy, so there are never duplicate live services.
|
| Usage:  node backend/seed/crystalCutsMenu.js
|         node backend/seed/crystalCutsMenu.js --dry     (report only, no writes)
*/

require("dotenv").config();
const mysql = require("mysql2/promise");

// The salon's global identity (same value on the cloud and every till, because
// `restaurants` syncs down by uuid). Used first; falls back to business_type.
const SALON_UUID = "9ed93a4b-af7b-11f1-a779-005056c00001";

const DRY = process.argv.includes("--dry");

// Target a specific restaurant by id (--rid=N or SEED_RESTAURANT_ID). Needed once
// there is more than one salon (e.g. Crystal Cuts alongside the demo salon), so
// the script doesn't have to guess which one. Falls back to the uuid/business_type
// lookup below when not given.
const ARG_RID = (() => {
    const a = process.argv.find((x) => x.startsWith("--rid="));
    const v = a ? a.slice(6) : process.env.SEED_RESTAURANT_ID;
    return v ? Number(v) : null;
})();

/*
| The menu. One object per category, in the exact display order the owner wants:
|   Men (haircut, oil massage, hair spa, coloring) → Women (the same, by length)
|   → the shared beauty sections → bridal.
| Each item is [name, price]. Length-priced services are pre-split into (M)/(L).
*/
const MENU = [
    // ---- MEN ----
    { category: "Haircut (Men)", items: [
        ["Basic Hair Cut", 150],
        ["Shaving", 50],
        ["Change Of Hair Style", 350],
        ["Beard Trim", 100],
        ["Beard Design", 250],
    ]},
    { category: "Oil Massage (Men)", items: [
        ["Almond / Olive / Coconut Oil", 400],
        ["Mint Oil", 450],
        ["Essential Oil", 500],
    ]},
    { category: "Hair Spa (Men)", items: [
        ["Classic Spa", 600],
        ["Moisturizing Hair Spa", 700],
        ["Anti Hair Fall", 800],
        ["Anti Dandruff", 1000],
    ]},
    { category: "Hair Coloring (Men)", items: [
        ["Grey Coverage", 1200],
        ["Global Fashion Color", 1500],
        ["Cap Highlights", 1300],
        ["Global Highlights", 2000],
    ]},

    // ---- WOMEN ----
    { category: "Haircut (Women)", items: [
        ["Bangs & French", 150],
        ["Straight & U Cut", 400],
        ["Layer Cut", 1200],
        ["Multi Layer", 1200],
        ["Butterfly Layer", 1200],
        ["Creative Layer", 1500],
    ]},
    { category: "Hair Wash (Women)", items: [
        ["Hair Wash Blast Dry", 300],
        ["Hair Wash Blow Dry", 500],
        ["Ironing or Tong", 1000],
    ]},
    { category: "Oil Massage (Women)", items: [
        ["Almond / Olive / Coconut Oil (M)", 500],
        ["Almond / Olive / Coconut Oil (L)", 600],
        ["Mint Oil (M)", 600],
        ["Mint Oil (L)", 700],
        ["Essential Oil (M)", 700],
        ["Essential Oil (L)", 800],
    ]},
    { category: "Hair Spa (Women)", items: [
        ["Classic Spa (M)", 700],
        ["Classic Spa (L)", 800],
        ["Moisturizing Hair Spa (M)", 800],
        ["Moisturizing Hair Spa (L)", 1000],
        ["Color Save Spa (M)", 1000],
        ["Color Save Spa (L)", 1200],
        ["Frizz Control Spa (M)", 1000],
        ["Frizz Control Spa (L)", 1200],
        ["Repair & Rejuvenate (M)", 1300],
        ["Repair & Rejuvenate (L)", 1500],
        ["Chemically Treated Spa (M)", 1500],
        ["Chemically Treated Spa (L)", 1700],
        ["Luxury Spa (M)", 2000],
        ["Luxury Spa (L)", 2500],
    ]},
    { category: "Scalp Treatment (Women)", items: [
        ["Anti Dandruff Spa (M)", 1700],
        ["Anti Dandruff Spa (L)", 1900],
        ["Anti Hair Fall Spa (M)", 1700],
        ["Anti Hair Fall Spa (L)", 1900],
    ]},
    { category: "Hair Coloring (Women)", items: [
        ["Root Touch Up", 1200],
        ["Global Grey Coverage (M)", 1800],
        ["Global Grey Coverage (L)", 2000],
        ["Global Fashion Color (M)", 2200],
        ["Global Fashion Color (L)", 2500],
        ["Full Highlights (M)", 2500],
        ["Full Highlights (L)", 3000],
        ["Global Highlights (M)", 3000],
        ["Global Highlights (L)", 3300],
        ["Minimum 6 Highlights (M)", 1000],
        ["Minimum 6 Highlights (L)", 1200],
    ]},
    { category: "Hair Treatment (Women)", items: [
        ["Smoothening (M)", 5000],
        ["Smoothening (L)", 6000],
        ["Straightening (M)", 7000],
        ["Straightening (L)", 8000],
        ["Rebounding (M)", 3000],
        ["Rebounding (L)", 4000],
        ["Keratin Treatment (M)", 6000],
        ["Keratin Treatment (L)", 7000],
        ["Botox Treatment (M)", 7000],
        ["Botox Treatment (L)", 8000],
        ["Perming Treatment (M)", 10000],
        ["Perming Treatment (L)", 12000],
    ]},

    // ---- SHARED BEAUTY SECTIONS ----
    { category: "Threading", items: [
        ["Eyebrow", 50],
        ["Upper Lip", 30],
        ["Forehead", 30],
        ["Chin", 30],
        ["Side", 50],
        ["Full Face", 150],
    ]},
    { category: "Waxing", items: [
        ["Full Arms", 400],
        ["Half Arms", 200],
        ["Full Legs", 600],
        ["Half Legs", 400],
        ["Full Body", 2500],
    ]},
    { category: "Peel Off Waxing", items: [
        ["Upper Lip", 50],
        ["Chin", 50],
        ["Side", 50],
        ["Under Arms", 200],
        ["Face", 200],
    ]},
    { category: "Bleach", items: [
        ["Face", 300],
    ]},
    { category: "De-Tan", items: [
        ["Face / Neck", 400],
        ["Face / Neck / Blouseline", 500],
        ["Under Arms", 200],
        ["Half Arms / Legs", 200],
        ["Full Arms", 300],
        ["Feet", 200],
    ]},
    { category: "Peel Off Mask", items: [
        ["Whitening Mask", 700],
        ["Gold Mask", 800],
        ["Bridal Glow Mask", 1000],
    ]},
    { category: "Under Eye Treatment", items: [
        ["Regular Mask Treatment", 600],
        ["Premium Peel Off Mask Treatment", 800],
        ["Premium Red Lamp Treatment", 1000],
    ]},
    { category: "Clean Up", items: [
        ["Basic Clean Up", 600],
        ["Acne Clean Up", 700],
    ]},
    { category: "Basic Facial", items: [
        ["Puravitals (Oily & Combination Skin)", 1000],
        ["Hydravitals (Dry Skin)", 1200],
        ["Radiant Diamond (All Skin)", 1500],
    ]},
    { category: "Advance Facial", items: [
        ["Gold Facial", 1700],
        ["Whitening Facial", 1850],
        ["Brightening Facial", 1900],
        ["Bridal Glow Facial", 2800],
        ["Korean Glass Skin Facial", 3000],
        ["Hydra Facial", 4500],
    ]},
    { category: "Manicure", items: [
        ["Basic Manicure", 500],
        ["Coco Butter Manicure", 600],
        ["Candle Manicure", 750],
        ["Crystal Spa Manicure", 800],
        ["Ice Cream Manicure", 1000],
    ]},
    { category: "Pedicure", items: [
        ["Basic Pedicure", 600],
        ["Coco Butter Pedicure", 800],
        ["Candle Pedicure", 1500],
        ["Crystal Spa Pedicure", 1800],
        ["Ice Cream Pedicure", 2300],
    ]},
    { category: "Foot Care", items: [
        ["Paraffin Treatment", 500],
        ["Heel Peel Treatment", 1500],
    ]},
    { category: "Nail Polish", items: [
        ["Change Of Nail Colour", 100],
        ["Cut & File / Polish", 200],
        ["Gel Polish Removal", 500],
    ]},
    { category: "Nail Art", items: [
        ["Temporary Extension", 1000],
        ["Ply Gel Extension", 1500],
        ["Acrylic Extension", 2000],
        ["Gel Polish", 600],
        ["French Nail", 800],
        ["Stamp Designs", 900],
        ["Jelly Nail", 1000],
        ["Metallic Mirror", 1000],
        ["Cat Eye", 1000],
        ["Extension Removal", 1500],
    ]},
    { category: "Bridal Package", items: [
        ["Party Makeup (Events / Bride Maids)", 5000],
        ["Engagement Makeup", 9000],
        ["Basic Bridal Makeup", 10000],
        ["Reception Makeup", 12000],
        ["Sangeet Makeup (Long-Lasting)", 12000],
        ["High-Definition Makeup", 17000],
        ["Dewy Glam Look Makeup", 18000],
        ["Airbrush Makeup (Flawless Finish)", 25000],
        ["Saree Draping (Traditional)", 500],
        ["Saree Draping (Modern)", 1000],
        ["Bridal Hair Styling (Curls / Buns)", 1000],
        ["Bridal Hair Styling (Premium)", 1500],
        ["Trial Makeup & Consultation", 1000],
        ["Trial Makeup & Consultation (Premium)", 2000],
        ["Groom Makeup (Basic Look)", 5000],
        ["Groom HD Makeup (Hair Fiber / Lenses)", 10000],
    ]},
];

async function columnExists(conn, table, column) {
    const [rows] = await conn.query(
        `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
        [table, column]
    );
    return rows.length > 0;
}

async function main() {
    const totalItems = MENU.reduce((n, c) => n + c.items.length, 0);
    console.log(`Crystal Cuts menu: ${MENU.length} categories, ${totalItems} services.${DRY ? "  (DRY RUN)" : ""}`);

    const conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT,
        multipleStatements: false,
    });

    try {
        // 1) Locate the target tenant. An explicit --rid wins; otherwise fall
        //    back to the salon uuid, then the single business_type='salon'.
        let salon;
        if (ARG_RID) {
            salon = (await conn.query(
                "SELECT id, restaurant_name, business_type FROM restaurants WHERE id = ? AND deleted_at IS NULL",
                [ARG_RID]
            ))[0];
            if (salon.length === 0) throw new Error(`No restaurant with id ${ARG_RID}.`);
        } else {
            salon = (await conn.query(
                "SELECT id, restaurant_name, business_type FROM restaurants WHERE uuid = ? AND deleted_at IS NULL",
                [SALON_UUID]
            ))[0];
            if (salon.length === 0) {
                salon = (await conn.query(
                    "SELECT id, restaurant_name, business_type FROM restaurants WHERE business_type = 'salon' AND deleted_at IS NULL"
                ))[0];
            }
            if (salon.length === 0) throw new Error("No salon tenant found (uuid or business_type='salon').");
            if (salon.length > 1) {
                throw new Error(
                    "Multiple salon tenants found; refusing to guess. Pass --rid=<id>:\n" +
                    salon.map((s) => `  id=${s.id} ${s.restaurant_name}`).join("\n")
                );
            }
        }
        const rid = salon[0].id;
        console.log(`Salon: id=${rid} "${salon[0].restaurant_name}" (${salon[0].business_type})`);

        const hasInvLink = await columnExists(conn, "menu_items", "inventory_item_id");
        // Services only — never touch sellable-product mirror rows.
        const serviceOnly = hasInvLink ? "AND inventory_item_id IS NULL" : "";

        // Count what we're about to remove / keep.
        const [[svc]] = await conn.query(
            `SELECT COUNT(*) n FROM menu_items WHERE restaurant_id = ? AND deleted_at IS NULL ${serviceOnly}`,
            [rid]
        );
        const [[prod]] = await conn.query(
            hasInvLink
                ? `SELECT COUNT(*) n FROM menu_items WHERE restaurant_id = ? AND deleted_at IS NULL AND inventory_item_id IS NOT NULL`
                : `SELECT 0 n`,
            hasInvLink ? [rid] : []
        );
        console.log(`Existing: ${svc.n} service item(s) to remove, ${prod.n} product mirror(s) to keep.`);

        if (DRY) {
            console.log("Dry run — no changes written.");
            MENU.forEach((c, i) =>
                console.log(`  ${String(i + 1).padStart(2)}. ${c.category}  (${c.items.length})`)
            );
            return;
        }

        await conn.beginTransaction();

        // 2) Soft-delete old services, then the categories they used that no
        //    surviving (kept) product still needs.
        await conn.query(
            `UPDATE menu_items SET deleted_at = NOW()
             WHERE restaurant_id = ? AND deleted_at IS NULL ${serviceOnly}`,
            [rid]
        );

        // Categories still referenced by a live menu_item (i.e. a kept product) stay.
        await conn.query(
            `UPDATE categories c
             SET c.deleted_at = NOW()
             WHERE c.restaurant_id = ? AND c.deleted_at IS NULL
               AND NOT EXISTS (
                   SELECT 1 FROM menu_items m
                   WHERE m.category_id = c.id AND m.deleted_at IS NULL
               )`,
            [rid]
        );

        // 3) Insert the new categories + services.
        let displayOrder = 1;
        let itemCount = 0;
        for (const block of MENU) {
            const [catRes] = await conn.query(
                `INSERT INTO categories (restaurant_id, category_name, description, display_order, status)
                 VALUES (?, ?, NULL, ?, 'Active')`,
                [rid, block.category, displayOrder]
            );
            const categoryId = catRes.insertId;

            let itemOrder = 1;
            for (const [name, price] of block.items) {
                await conn.query(
                    `INSERT INTO menu_items
                        (restaurant_id, category_id, item_name, price, gst,
                         kitchen_section, food_type, available, display_order)
                     VALUES (?, ?, ?, ?, NULL, 'Kitchen', 'Veg', 1, ?)`,
                    [rid, categoryId, name, price, itemOrder]
                );
                itemOrder++;
                itemCount++;
            }
            displayOrder++;
        }

        await conn.commit();
        console.log(`Done. Inserted ${MENU.length} categories and ${itemCount} services for salon id=${rid}.`);
        console.log("These are down-sync tables — they will reach each till on its next cloud pull.");
    } catch (err) {
        try { await conn.rollback(); } catch (_) {}
        throw err;
    } finally {
        await conn.end();
    }
}

main().catch((e) => {
    console.error("Seed failed:", e.message);
    process.exit(1);
});
