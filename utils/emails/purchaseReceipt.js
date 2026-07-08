/**
 * @description HTML template for coin purchase receipts
 * @param {object} params
 * @param {string} params.name - Merchant name
 * @param {number} params.coinsAmount - Number of coins purchased
 * @param {number} params.priceUsd - Total price paid in USD
 * @param {string} params.transactionId - Stripe PaymentIntent ID
 * @param {Date|string} params.date - Date of transaction
 * @returns {string} HTML Content
 */
export const purchaseReceiptTemplate = ({ name, coinsAmount, priceUsd, transactionId, date }) => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
        <h2 style="color: #6750A4; text-align: center;">Payment Receipt</h2>
        <p>Dear ${name || 'Merchant'},</p>
        <p>Thank you for purchasing coins for your live events! Your payment has been successfully processed, and your coin balance has been updated.</p>
        
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 6px 0; color: #666;">Coins Purchased:</td>
                    <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #333;">${coinsAmount} Coins</td>
                </tr>
                <tr>
                    <td style="padding: 6px 0; color: #666;">Amount Paid:</td>
                    <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #333;">$${priceUsd.toFixed(2)} USD</td>
                </tr>
                <tr>
                    <td style="padding: 6px 0; color: #666;">Payment ID:</td>
                    <td style="padding: 6px 0; text-align: right; font-family: monospace; font-size: 13px; color: #333;">${transactionId}</td>
                </tr>
                <tr>
                    <td style="padding: 6px 0; color: #666;">Date:</td>
                    <td style="padding: 6px 0; text-align: right; color: #333;">${new Date(date).toLocaleString()}</td>
                </tr>
            </table>
        </div>
        
        <p style="text-align: center; color: #888; font-size: 12px; margin-top: 30px;">
            If you did not authorize this transaction, please contact us immediately.
            <br />
            © ${new Date().getFullYear()} Raidr. All rights reserved.
        </p>
    </div>
  `;
};
