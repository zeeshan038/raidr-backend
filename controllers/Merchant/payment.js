import stripe from '../../config/stripe.js';
import { prisma } from '../../config/db.js';
import sendEmail from '../../utils/Nodemailer.js';
import { purchaseReceiptTemplate } from '../../utils/emails/purchaseReceipt.js';

/**
 * @description Create Payment Intent for purchasing coins
 * @route POST /api/merchant/payments/create-intent
 * @access Private
 */
export const createCoinPaymentIntent = async (req, res) => {
    const merchantId = req.merchant.id;
    const { coinsAmount, priceUsd, address } = req.body;

    console.log(coinsAmount , priceUsd);

    // Validation
    if (!coinsAmount || typeof coinsAmount !== 'number' || coinsAmount <= 0) {
        return res.status(400).json({
            status: false,
            msg: 'Invalid coins amount'
        });
    }

    if (!priceUsd || typeof priceUsd !== 'number' || priceUsd <= 0) {
        return res.status(400).json({
            status: false,
            msg: 'Invalid price amount'
        });
    }

    // Convert USD price to cents for Stripe (e.g. $5.00 -> 500 cents)
    const amountInCents = Math.round(priceUsd * 100);

    try {
        // Fetch merchant dynamically to get their address
        const merchant = await prisma.merchant.findUnique({
            where: { id: merchantId }
        });

        // Use the frontend provided address if available, otherwise fallback
        const addressLine = address?.line1 || (merchant?.address && merchant.address.trim() !== '' ? merchant.address : '123 Tech Park');
        const city = address?.city || 'San Francisco';
        const state = address?.state || 'CA';
        const country = address?.country || 'US';
        const postal_code = address?.postal_code || '94105';

        // 1. Create PaymentIntent with Stripe
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amountInCents,
            currency: 'usd',
            description: `Purchase of ${coinsAmount} Raidr credits by ${merchant?.businessName || 'Merchant'}`,
            shipping: {
                name: merchant?.name || 'Merchant User',
                address: {
                    line1: addressLine,
                    city: city,
                    state: state,
                    country: country,
                    postal_code: postal_code
                }
            },
            metadata: {
                merchantId,
                coinsAmount: coinsAmount.toString(),
                priceUsd: priceUsd.toString()
            }
        });

        // 2. Save a pending transaction in database
        const purchase = await prisma.merchantCreditPurchase.create({
            data: {
                merchantId,
                creditsAmount: coinsAmount,
                priceUsd,
                transactionId: paymentIntent.id,
                status: 'pending'
            }
        });

        // 3. Return clientSecret to frontend
        return res.status(200).json({
            status: true,
            clientSecret: paymentIntent.client_secret,
            purchaseId: purchase.id
        });

    } catch (error) {
        return res.status(500).json({
            status: false, msg: error.message
        });
    }
};

/**
 * @description Stripe Webhook Listener 
 * @route POST /api/merchant/payments/webhook
 * @access Public
 */
export const stripeWebhooks = async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
        event = stripe.webhooks.constructEvent(
            req.rawBody,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.log(`⚠️ Webhook signature verification failed.`, err.message);
        return res.sendStatus(400);
    }

    // Handle succeeded payment events
    if (event.type === "payment_intent.succeeded") {
        const paymentIntent = event.data.object;
        const transactionId = paymentIntent.id;
        const merchantId = paymentIntent.metadata.merchantId;
        const coinsAmount = parseInt(paymentIntent.metadata.coinsAmount);

        try {
            const existingPurchase = await prisma.merchantCreditPurchase.findUnique({
                where: { transactionId }
            });

            // If database record is pending, complete it and update merchant coins balance
            if (existingPurchase && existingPurchase.status === "pending") {
                const [updatedPurchase, updatedMerchant] = await prisma.$transaction([
                    prisma.merchantCreditPurchase.update({
                        where: { transactionId },
                        data: { status: "completed" }
                    }),
                    prisma.merchant.update({
                        where: { id: merchantId },
                        data: { credits: { increment: coinsAmount } }
                    })
                ]);

                // Send email receipt to merchant
                try {
                    const htmlContent = purchaseReceiptTemplate({
                        name: updatedMerchant.name,
                        coinsAmount,
                        priceUsd: existingPurchase.priceUsd,
                        transactionId,
                        date: updatedPurchase.updatedAt
                    });
                  console.log(updatedMerchant.email)
                  console.log(coinsAmount)
                  console.log(existingPurchase.priceUsd)
                    
                    await sendEmail({
                        to: updatedMerchant.email,
                        subject: "Raidr - Coin Purchase Receipt",
                        html: htmlContent
                    });
                } catch (emailErr) {
                    console.error('⚠️ Failed to send Stripe purchase email:', emailErr.message);
                }

                console.log(`Successfully completed payment: ${transactionId} & credited ${coinsAmount} coins to merchant: ${merchantId}`);
            }
        } catch (error) {
            console.error(`Error processing Stripe Webhook transaction:`, error.message);
        }
    }

    return res.sendStatus(200);
};

