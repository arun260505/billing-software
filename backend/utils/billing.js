// The one place bill money is calculated.
//
// Before this existed the same bill was worked out three different ways — the
// backend charged per-item GST, the cashier receipt charged a flat 5% plus a 2%
// service charge, and the bill-edit paths charged 5% with no service charge. The
// customer paid one number and the database stored another. Everything that
// totals a bill now goes through here.

const GST_PERCENT = 5;
const SERVICE_PERCENT = 2;

// Round to paise, avoiding the usual float drift (0.1 + 0.2 === 0.30000000000000004).
const money = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Total a bill from its subtotal.
 * @param   {number} subtotal
 * @returns {{subtotal: number, tax: number, service_charge: number, grand_total: number}}
 */
const totalsFromSubtotal = (subtotal) => {

    const sub = money(subtotal);
    const tax = money((sub * GST_PERCENT) / 100);
    const service = money((sub * SERVICE_PERCENT) / 100);

    return {
        subtotal: sub,
        tax,
        service_charge: service,
        grand_total: money(sub + tax + service)
    };

};

/**
 * Total a bill from its line items.
 * @param {Array<{price: number, quantity: number}>} items
 */
const totalsFromItems = (items = []) =>
    totalsFromSubtotal(
        items.reduce((sum, it) => sum + Number(it.price) * Number(it.quantity), 0)
    );

module.exports = {
    GST_PERCENT,
    SERVICE_PERCENT,
    money,
    totalsFromSubtotal,
    totalsFromItems
};
