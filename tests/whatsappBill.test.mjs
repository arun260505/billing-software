/**
 * The WhatsApp bill message (src/utils/whatsappBill.js), run by npm run test:logic.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
    whatsappNumber,
    groupItems,
    billFromPrintedOrder,
    billFromSaved,
    buildBillMessage,
    renderTemplate,
    whatsappUrl,
    normalizeBillDelivery,
    SAMPLE_BILL,
    WHATSAPP_TAGS
} from "../src/utils/whatsappBill.js";

test("mobile numbers get the country code, junk gets nothing", () => {
    assert.equal(whatsappNumber("9876543210"), "919876543210");
    assert.equal(whatsappNumber("98765 43210"), "919876543210");
    assert.equal(whatsappNumber("09876543210"), "919876543210");
    assert.equal(whatsappNumber("+91 98765-43210"), "919876543210");
    assert.equal(whatsappNumber("12345"), null);
    assert.equal(whatsappNumber(""), null);
    assert.equal(whatsappNumber(null), null);
});

test("the same service stored as several rows is one line", () => {
    assert.deepEqual(
        groupItems([
            { item_name: "Haircut", price: "300.00", quantity: 1 },
            { item_name: "Haircut", price: "300.00", quantity: 1 },
            { item_name: "Hair Spa", price: 900, quantity: 1 },
            { item_name: "Gone", price: 50, quantity: 0 }
        ]),
        [
            { item_name: "Haircut", price: 300, quantity: 2 },
            { item_name: "Hair Spa", price: 900, quantity: 1 }
        ]
    );
});

const printed = {
    order_number: "0042",
    customer_name: "Anita",
    stylist_name: "Meena",
    date: "13 Sep 2026",
    time: "04:35 pm",
    items: [{ item_name: "Haircut", price: 300, quantity: 2 }],
    subtotal: 600,
    discount: 60,
    discount_label: "Discount (10%)",
    taxLines: [{ charge_name: "GST 18%", amount: 97.2 }],
    charges: [{ charge_name: "Home visit", amount: 50 }, { charge_name: "Zero", amount: 0 }],
    grand_total: 687.2,
    payment_method: "UPI"
};
const shop = { restaurant_name: "Glow Salon", address: "12 MG Road, Kochi", mobile: "9000000001" };

test("the default message carries the whole bill and the shop number", () => {
    const text = buildBillMessage(billFromPrintedOrder(printed), shop);
    assert.equal(text, [
        "*Glow Salon*",
        "Hi Anita, thank you for visiting us!",
        "",
        "Bill No: *0042*",
        "Date: 13 Sep 2026, 04:35 pm",
        "Stylist: Meena",
        "",
        "Haircut x2 - ₹600.00",
        "",
        "Subtotal: ₹600.00",
        "Discount (10%): -₹60.00",
        "GST 18%: ₹97.20",
        "Home visit: ₹50.00",
        "*Total: ₹687.20*",
        "Paid via: UPI",
        "",
        "12 MG Road, Kochi",
        "Ph: 9000000001",
        "",
        "See you again soon!"
    ].join("\n"));
});

test("no discount, no charges, no shop details: those lines are left out", () => {
    const text = buildBillMessage(billFromPrintedOrder({ ...printed, discount: 0, taxLines: [], charges: [], grand_total: 600 }), {});
    assert.ok(!text.includes("Discount"));
    assert.ok(!text.includes("GST"));
    assert.ok(!text.includes("Ph:"));
    assert.ok(!text.includes("\n\n\n"));
    assert.ok(text.startsWith("Hi Anita"));
    assert.ok(text.includes("*Total: ₹600.00*"));
});

test("the owner's own template is used, with every tag filled", () => {
    const tpl = "Dear {customer_name},\nYour bill {bill_no} at {salon_name} is {total} ({payment_method}).\n{services}\nStylist {stylist} on {date}\nCall us: {salon_phone} {salon_address}\nOffer: 20% off next visit!";
    const text = buildBillMessage(billFromPrintedOrder(printed), shop, tpl);
    assert.equal(text, [
        "Dear Anita,",
        "Your bill 0042 at Glow Salon is ₹687.20 (UPI).",
        "Haircut x2 - ₹600.00",
        "Stylist Meena on 13 Sep 2026, 04:35 pm",
        "Call us: 9000000001 12 MG Road, Kochi",
        "Offer: 20% off next visit!"
    ].join("\n"));
});

test("a blank template falls back to the default", () => {
    const bill = billFromPrintedOrder(printed);
    assert.equal(buildBillMessage(bill, shop, "   "), buildBillMessage(bill, shop));
});

test("template rules: empty-tag lines dropped, unknown tags kept, blank runs collapsed", () => {
    assert.equal(
        renderTemplate("A {x}\nStylist: {y}\n\n\n\nB {unknown}\r\nC", { x: "1", y: "" }),
        "A 1\n\nB {unknown}\nC"
    );
    assert.equal(renderTemplate("Just text", {}), "Just text");
});

test("every tag offered in Settings is filled by the message builder", () => {
    const tpl = WHATSAPP_TAGS.map((t) => t.tag).join("\n");
    const text = buildBillMessage(SAMPLE_BILL, shop, tpl);
    assert.ok(!/\{[a-z_]+\}/.test(text), text);
});

test("a saved bill reads its totals by bucket", () => {
    const bill = billFromSaved(
        {
            order_number: "0042", customer_name: "Anita", stylist_name: "Meena",
            created_at: "2026-09-13T11:05:00.000Z",
            subtotal: "900.00", discount: "90.00", discount_percent: "10.00",
            tax: "145.80", service_charge: "0.00", charges_total: "0.00",
            grand_total: "955.80", payment_method: "Cash"
        },
        [{ item_name: "Haircut", price: "300.00", quantity: 3 }]
    );
    assert.equal(bill.discount_label, "Discount (10%)");
    assert.deepEqual(bill.lines, [{ name: "GST", amount: 145.8 }]);
    assert.ok(bill.date.includes("2026"));
    const text = buildBillMessage(bill, shop);
    assert.ok(text.includes("Haircut x3 - ₹900.00"));
    assert.ok(text.includes("Discount (10%): -₹90.00"));
    assert.ok(text.includes("*Total: ₹955.80*"));
    assert.ok(text.includes("Paid via: Cash"));
});

test("a flat discount on a saved bill is just 'Discount'", () => {
    assert.equal(billFromSaved({ discount: "100.00", discount_percent: null }, []).discount_label, "Discount");
});

test("bill delivery: anything but no_printer means printer optional", () => {
    assert.equal(normalizeBillDelivery("no_printer"), "no_printer");
    assert.equal(normalizeBillDelivery("printer_optional"), "printer_optional");
    assert.equal(normalizeBillDelivery(undefined), "printer_optional");
    assert.equal(normalizeBillDelivery("junk"), "printer_optional");
});

test("urls: WhatsApp Web by default, the desktop app on request, text fully encoded", () => {
    const text = "*Glow*\nTotal: ₹10.00 & more";
    const web = whatsappUrl("919876543210", text);
    assert.ok(web.startsWith("https://web.whatsapp.com/send?phone=919876543210&text="));
    assert.equal(decodeURIComponent(web.split("&text=")[1]), text);
    assert.ok(!web.includes("\n") && !web.includes(" "));
    assert.ok(whatsappUrl("919876543210", text, "app").startsWith("whatsapp://send?phone=919876543210&text="));
});
