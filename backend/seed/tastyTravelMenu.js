/*
|--------------------------------------------------------------------------
| Seed: Tasty Travel restaurant menu
|--------------------------------------------------------------------------
| Loads the full à-la-carte menu (transcribed from the printed menu book)
| into the Tasty Travel tenant, replacing any placeholder items.
|
| WHERE TO RUN THIS
|   categories + menu_items are DOWN-sync tables (cloud -> till), so the CLOUD
|   is the source of truth. Run this on the cloud server; the menu then syncs
|   down to the till on the next pull. Running it against a till's local DB is
|   pointless — the next pull overwrites it with the cloud's copy.
|
| WHAT IT DOES (in one transaction)
|   1. Finds the target restaurant (--rid=N or SEED_RESTAURANT_ID).
|   2. Soft-deletes its existing SERVICE menu items and the now-empty categories.
|      Sellable-inventory PRODUCT mirrors (menu_items with a non-null
|      inventory_item_id) and their categories are left alone.
|   3. Inserts the categories + every item in menu order. Items priced by a
|      variant (Normal/Schezwan, Plain/Butter, Quarter/Half/Full, Veg/Non-Veg,
|      Bone/Boneless, Dry/Gravy) are split into one billable item per variant.
|
| Idempotent: re-running soft-deletes the previous run's items and re-inserts
| a fresh copy, so there are never duplicate live items.
|
| Usage:  node backend/seed/tastyTravelMenu.js --rid=20
|         node backend/seed/tastyTravelMenu.js --rid=20 --dry   (report only)
*/

require("dotenv").config();
const mysql = require("mysql2/promise");

const DRY = process.argv.includes("--dry");

const ARG_RID = (() => {
    const a = process.argv.find((x) => x.startsWith("--rid="));
    const v = a ? a.slice(6) : process.env.SEED_RESTAURANT_ID;
    return v ? Number(v) : null;
})();

const V = "Veg", E = "Egg", N = "NonVeg";

/*
| The menu. One object per category, in printed menu order. `food` is the
| category's default food_type; each item is [name, price] or [name, price,
| food_type] to override. Prices are whole rupees.
*/
const MENU = [
    { category: "Soups", food: N, items: [
        ["Hot & Sour Soup (Veg)", 90, V],
        ["Hot & Sour Soup (Non-Veg)", 130, N],
        ["Manchow Soup (Veg)", 110, V],
        ["Manchow Soup (Non-Veg)", 130, N],
        ["South Indian Chicken Soup", 110, N],
        ["South Indian Mutton Soup", 140, N],
        ["South Indian Crab Soup", 160, N],
    ]},
    { category: "Lunch", food: V, items: [
        ["Veg Lunch (Meals)", 130, V],
        ["Non-Veg Lunch (Meals)", 170, N],
    ]},
    { category: "Biryani", food: N, items: [
        ["Mutton Biryani", 280],
        ["Mutton Egg Biryani", 130],
        ["Mutton Plain Biryani", 110],
        ["Chicken Biryani", 150],
        ["Chicken 65 Biryani", 170],
        ["Chicken Egg Biryani", 110],
        ["Chicken Plain Biryani", 100],
        ["Kaadai Biryani", 210],
        ["Prawn Biryani", 260],
        ["Fish Biryani", 260],
        ["Tandoori Biryani", 210],
    ]},
    { category: "Veg Biryani", food: V, items: [
        ["Veg Biryani", 110],
        ["Mushroom Biryani", 150],
        ["Paneer Biryani", 160],
        ["Gobi Biryani", 150],
    ]},
    { category: "Indian Starters (Veg)", food: V, items: [
        ["Paneer Burji", 170],
        ["Paneer 65", 170],
        ["Mushroom Pepper Fry", 160],
        ["Mushroom 65", 160],
        ["Gobi 65", 150],
        ["Aloo Jeera", 150],
        ["Mushroom Salt & Pepper", 160],
        ["Baby Corn Salt & Pepper", 160],
    ]},
    { category: "Indian Starters (Non-Veg)", food: N, items: [
        ["Chicken Pepper Fry", 170],
        ["Chettinad Chicken Fry", 170],
        ["Chicken Keema Boneless", 210],
        ["Chicken Karivepulai Varuval", 170],
        ["Chicken Chukka Boneless", 190],
        ["Chicken Ghee Roast", 230],
        ["Chicken 65 (Bone)", 150],
        ["Chicken 65 (Boneless)", 170],
        ["Pallipalayam Chicken", 190],
        ["Chinthamani Chicken", 210],
        ["Mutton Pepper Fry", 260],
        ["Mutton Chukka Braces", 270],
        ["Mutton Karivepulai Varuval", 260],
        ["Boti (Dry)", 160],
        ["Boti (Gravy)", 180],
        ["Mutton Nalli Fry", 260],
        ["Mutton Chops (3 Pieces)", 410],
    ]},
    { category: "Chinese Starters (Veg)", food: V, items: [
        ["Paneer Chilli", 170],
        ["Paneer Manchurian", 170],
        ["Dragon Paneer", 180],
        ["Chilli Mushroom", 160],
        ["Mushroom Manchurian", 160],
        ["Chilli Gobi", 150],
        ["Gobi Manchurian", 150],
        ["Baby Corn Manchurian", 160],
    ]},
    { category: "Chinese Starters (Non-Veg)", food: N, items: [
        ["Chilli Chicken", 150],
        ["Chicken Manchurian", 150],
        ["Chicken Salt & Pepper Fry", 160],
        ["Dragon Chicken", 210],
        ["Honey Chicken", 230],
        ["Chicken Lollipop (Dry)", 170],
        ["Chicken Lollipop (Saucy)", 190],
        ["Ginger Chicken", 230],
        ["Garlic Chicken", 210],
        ["Chilli Prawns", 260],
        ["Prawns Salt & Pepper", 260],
        ["Crispy Golden Prawns", 260],
        ["Chilli Fish", 230],
        ["Fish Manchurian", 230],
        ["Fish Salt and Pepper", 210],
        ["Ginger Fish", 230],
        ["Fish Fingers (6 Pieces)", 260],
        ["Crab Lollipop (6 Pieces)", 260],
    ]},
    { category: "Sea Foods", food: N, items: [
        ["Prawn Pepper Fry", 260],
        ["Prawn Ghee Roast", 290],
        ["Butter Garlic Prawns", 260],
        ["Prawn 65", 260],
        ["Squid 65", 260],
        ["Squid Pepper Fry", 260],
        ["Fish 65", 210],
        ["Vanjaram Fish Fry", 260],
        ["Butter Garlic Fish", 260],
        ["Nethili Fish Fry", 190],
        ["Nethili Thokku", 210],
        ["Crab Pepper Fry", 260],
    ]},
    { category: "Indian Rice Items", food: V, items: [
        ["Ghee Rice", 110],
        ["Jeera Rice", 110],
        ["Jeera Pulao", 110],
        ["Veg Pulao", 110],
        ["Kashmiri Pulao", 130],
    ]},
    { category: "Chinese Rice Items (Veg)", food: V, items: [
        ["Veg Fried Rice (Normal)", 120],
        ["Veg Fried Rice (Schezwan)", 130],
        ["Paneer Fried Rice (Normal)", 160],
        ["Paneer Fried Rice (Schezwan)", 170],
        ["Mushroom Fried Rice (Normal)", 140],
        ["Mushroom Fried Rice (Schezwan)", 150],
        ["Mix Veg Fried Rice (Normal)", 170],
        ["Mix Veg Fried Rice (Schezwan)", 180],
        ["Gobi Rice (Normal)", 140],
        ["Gobi Rice (Schezwan)", 150],
    ]},
    { category: "Chinese Rice Items (Non-Veg)", food: N, items: [
        ["Egg Fried Rice (Normal)", 130, E],
        ["Egg Fried Rice (Schezwan)", 140, E],
        ["Chicken Fried Rice (Normal)", 160],
        ["Chicken Fried Rice (Schezwan)", 170],
        ["Mixed Fried Rice (Normal)", 190],
        ["Mixed Fried Rice (Schezwan)", 200],
        ["Mutton Fried Rice (Normal)", 190],
        ["Mutton Fried Rice (Schezwan)", 200],
        ["Prawn Fried Rice (Normal)", 190],
        ["Prawn Fried Rice (Schezwan)", 200],
        ["Shanghai Fried Rice", 190],
        ["Chilli Garlic Chicken Fried Rice", 190],
    ]},
    { category: "Noodles (Veg)", food: V, items: [
        ["Veg Noodles (Normal)", 120],
        ["Veg Noodles (Schezwan)", 130],
        ["Paneer Noodles (Normal)", 160],
        ["Paneer Noodles (Schezwan)", 170],
        ["Mushroom Noodles (Normal)", 150],
        ["Mushroom Noodles (Schezwan)", 160],
        ["Mixed Veg Noodles (Normal)", 170],
        ["Mixed Veg Noodles (Schezwan)", 180],
        ["Hakka Noodles", 160],
        ["Gobi Noodles (Normal)", 140],
        ["Gobi Noodles (Schezwan)", 150],
    ]},
    { category: "Noodles (Non-Veg)", food: N, items: [
        ["Egg Noodles (Normal)", 120, E],
        ["Egg Noodles (Schezwan)", 130, E],
        ["Chicken Noodles (Normal)", 170],
        ["Chicken Noodles (Schezwan)", 180],
        ["Mixed Noodles (Normal)", 190],
        ["Mixed Noodles (Schezwan)", 200],
        ["Mutton Noodles (Normal)", 190],
        ["Mutton Noodles (Schezwan)", 200],
        ["Prawn Noodles (Normal)", 190],
        ["Prawn Noodles (Schezwan)", 200],
        ["Shanghai Noodles", 190],
    ]},
    { category: "Parotta", food: V, items: [
        ["Poricha Parotta", 70, V],
        ["Egg Veechu", 70, E],
        ["Egg Laba", 130, E],
        ["Chicken Laba", 170, N],
        ["Mutton Laba", 230, N],
        ["Egg Kothu", 130, E],
        ["Chicken Kothu", 160, N],
        ["Chilli Parotta", 160, V],
        ["Parotta (2)", 60, V],
        ["Chappathi (2)", 60, V],
        ["Kizhi Parotta", 260, N],
    ]},
    { category: "Dosa", food: V, items: [
        ["Plain Dosa", 50, V],
        ["Ghee Roast", 80, V],
        ["Podi Dosa", 80, V],
        ["Onion Dosa", 80, V],
        ["Egg Dosa", 80, E],
        ["Paneer Dosa", 150, V],
        ["Mushroom Dosa", 130, V],
        ["Gobi Dosa", 130, V],
        ["Chicken Kari Dosa", 170, N],
        ["Mutton Kari Dosa", 230, N],
        ["Mixed Kari Dosa", 260, N],
    ]},
    { category: "Tandoori Breads", food: V, items: [
        ["Naan (Plain)", 40],
        ["Naan (Butter)", 50],
        ["Roti (Plain)", 40],
        ["Roti (Butter)", 50],
        ["Garlic Naan", 80],
        ["Plain Kulcha", 60],
        ["Masala Kulcha", 80],
        ["Paneer Kulcha", 80],
        ["Tandoori Parotta", 70],
    ]},
    { category: "Indian Gravy (Veg)", food: V, items: [
        ["Shahi Paneer", 210],
        ["Paneer Butter Masala", 170],
        ["Paneer Pepper Masala", 170],
        ["Muttar Paneer", 180],
        ["Mushroom Pepper Masala", 160],
        ["Aloo Gobi Masala", 150],
        ["Aloo Mutter Masala", 150],
        ["Dal Fry", 120],
        ["Dal Tadka", 130],
        ["Mix Veg Gravy", 150],
        ["Kolhapuri Veg Gravy", 170],
    ]},
    { category: "Indian Gravy (Non-Veg)", food: N, items: [
        ["Chicken Pepper Masala", 170],
        ["Butter Chicken Masala", 230],
        ["Chettinad Chicken Masala", 170],
        ["Chicken Tikka Masala", 230],
        ["Chicken Keema Gravy", 210],
        ["Malabar Chicken Gravy", 210],
        ["Hyderabadi Chicken Gravy", 210],
        ["Chicken Maharani", 230],
        ["Pepper Mutton Masala", 230],
        ["Mutton Rogan Josh", 230],
        ["Chettinad Mutton Masala", 230],
        ["Mutton Nalli Kuzhambu", 260],
        ["Mutton Maharani", 230],
        ["Prawn Pepper Masala", 260],
        ["Chettinad Prawn Masala", 260],
        ["Fish Masala", 210],
        ["Malabar Fish Masala", 210],
        ["Nandu Masala", 260],
        ["Malabar Prawn Curry", 230],
        ["Nandu Thokku", 260],
        ["Squid Thokku", 260],
        ["Andhra Chicken Masala", 190],
        ["Andhra Mutton Masala", 260],
    ]},
    { category: "Tandoori & Barbeque (Non-Veg)", food: N, items: [
        ["Tandoori Chicken (Quarter)", 130],
        ["Tandoori Chicken (Half)", 230],
        ["Tandoori Chicken (Full)", 450],
        ["Grilled Chicken (Quarter)", 130],
        ["Grilled Chicken (Half)", 230],
        ["Grilled Chicken (Full)", 450],
        ["Pepper Barbeque (Half)", 260],
        ["Pepper Barbeque (Full)", 460],
        ["Chicken Tikka", 210],
        ["Fish Tikka", 310],
        ["Tiger Prawns", 410],
        ["Chicken Seekh Kebab", 200],
        ["Malai Tikka", 230],
        ["Hariyali Chicken", 230],
        ["Reshmi Kabab", 210],
    ]},
    { category: "Tandoori & Barbeque (Veg)", food: V, items: [
        ["Paneer Tikka", 260],
        ["Mushroom Tikka", 210],
    ]},
    { category: "Egg Items", food: E, items: [
        ["Boiled Egg", 20],
        ["Omlet (2 Egg)", 50],
        ["Kalakki (2 Egg)", 50],
        ["Podimas (2 Egg)", 60],
        ["Chicken Podimas", 90, N],
    ]},
    { category: "Drinks", food: V, items: [
        ["Water", 20],
        ["Goli Soda", 30],
        ["Cool Drinks (Small)", 20],
        ["Cool Drinks (Large)", 40],
        ["Beeda", 10],
    ]},
    { category: "Extra", food: V, items: [
        ["Mayonnaise", 20],
        ["Schezwan", 20],
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
    console.log(`Tasty Travel menu: ${MENU.length} categories, ${totalItems} items.${DRY ? "  (DRY RUN)" : ""}`);

    if (!ARG_RID) throw new Error("Pass the restaurant id: --rid=<id> (or SEED_RESTAURANT_ID).");

    const conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT,
        multipleStatements: false,
    });

    try {
        const [found] = await conn.query(
            "SELECT id, restaurant_name, business_type FROM restaurants WHERE id = ? AND deleted_at IS NULL",
            [ARG_RID]
        );
        if (found.length === 0) throw new Error(`No restaurant with id ${ARG_RID}.`);
        const rid = found[0].id;
        console.log(`Restaurant: id=${rid} "${found[0].restaurant_name}" (${found[0].business_type})`);

        const hasInvLink = await columnExists(conn, "menu_items", "inventory_item_id");
        const serviceOnly = hasInvLink ? "AND inventory_item_id IS NULL" : "";

        const [[svc]] = await conn.query(
            `SELECT COUNT(*) n FROM menu_items WHERE restaurant_id = ? AND deleted_at IS NULL ${serviceOnly}`,
            [rid]
        );
        console.log(`Existing: ${svc.n} item(s) to remove.`);

        if (DRY) {
            console.log("Dry run — no changes written.");
            MENU.forEach((c, i) =>
                console.log(`  ${String(i + 1).padStart(2)}. ${c.category}  (${c.items.length})`)
            );
            return;
        }

        await conn.beginTransaction();

        await conn.query(
            `UPDATE menu_items SET deleted_at = NOW()
             WHERE restaurant_id = ? AND deleted_at IS NULL ${serviceOnly}`,
            [rid]
        );
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
            for (const [name, price, food] of block.items) {
                await conn.query(
                    `INSERT INTO menu_items
                        (restaurant_id, category_id, item_name, price, gst,
                         kitchen_section, food_type, available, display_order)
                     VALUES (?, ?, ?, ?, NULL, 'Kitchen', ?, 1, ?)`,
                    [rid, categoryId, name, price, food || block.food || "Veg", itemOrder]
                );
                itemOrder++;
                itemCount++;
            }
            displayOrder++;
        }

        await conn.commit();
        console.log(`Done. Inserted ${MENU.length} categories and ${itemCount} items for restaurant id=${rid}.`);
        console.log("These are down-sync tables — they will reach the till on its next cloud pull.");
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
