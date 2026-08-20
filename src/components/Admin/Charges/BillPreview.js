import React from "react";

function BillPreview() {

    return (
        <div className="bill-preview-section">
            <div className="section-header">
                <div>
                    <h3>Example Bill Calculation</h3>
                    <p>How charges are applied to a sample bill.</p>
                </div>
            </div>

            <div className="bill-preview-card">
                <h4>Sample Bill</h4>

                <div className="bill-line">
                    <span>Food Total</span>
                    <span>₹800.00</span>
                </div>
                <div className="bill-line charge">
                    <span>Parcel Charge</span>
                    <span>+ ₹20.00</span>
                </div>
                <div className="bill-line charge">
                    <span>AC Charge</span>
                    <span>+ ₹50.00</span>
                </div>
                <div className="bill-line charge">
                    <span>Service Charge (5%)</span>
                    <span>+ ₹40.00</span>
                </div>

                <hr className="bill-divider" />

                <div className="bill-line subtotal">
                    <span>Subtotal</span>
                    <span>₹910.00</span>
                </div>
                <div className="bill-line charge">
                    <span>CGST (2.5%)</span>
                    <span>₹22.75</span>
                </div>
                <div className="bill-line charge">
                    <span>SGST (2.5%)</span>
                    <span>₹22.75</span>
                </div>

                <hr className="bill-divider" />

                <div className="bill-line total">
                    <span>Grand Total</span>
                    <span>₹955.50</span>
                </div>

                <div className="bill-note">
                    Charges are automatically applied during billing based on the configured rules.
                </div>
            </div>
        </div>
    );
}

export default BillPreview;
