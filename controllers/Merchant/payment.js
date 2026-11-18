import stripe from '../../config/stripe.js';
import { prisma } from '../../config/db.js';
import sendEmail from '../../utils/Nodemailer.js';
import { purchaseReceiptTemplate } from '../../utils/emails/purchaseReceipt.js';

const sendPurchaseReceipt = async ({ merchant, purchase, transactionId }) => {
    try {
        const htmlContent = purchaseReceiptTemplate({
            name: merchant.name,
            coinsAmount: purchase.creditsAmount,
            priceUsd: purchase.priceUsd,
            transactionId,
            date: purchase.updatedAt
        });
        await sendEmail({
            to: merchant.email,
            subject: "Raidr - Coin Purchase Receipt",
            html: htmlContent
        });
    } catch (emailErr) {
        console.error('⚠️ Failed to send Stripe purchase email:', emailErr.message);
    }
};

/**
 * Complete a purchase exactly once. Both the authenticated confirmation route
 * and the Stripe webhook use this function, so a webhook/HTTP race cannot add
 * the same credits twice.
 */
const completeCreditPurchase = async ({ transactionId, expectedMerchantId = null }) =>
    prisma.$transaction(async (tx) => {
        const purchase = await tx.merchantCreditPurchase.findUnique({
            where: { transactionId }
        });

        if (!purchase) {
            throw new Error('Credit purchase was not found');
        }
        if (expectedMerchantId && purchase.merchantId !== expectedMerchantId) {
            throw new Error('Credit purchase does not belong to this merchant');
        }

        if (purchase.status === 'completed') {
            const merchant = await tx.merchant.findUnique({
                where: { id: purchase.merchantId }
            });
            return { purchase, merchant, creditedNow: false };
        }
        if (purchase.status !== 'pending') {
            throw new Error(`Credit purchase cannot be completed from status: ${purchase.status}`);
        }

        // Atomically claim the pending purchase. If the webhook and dashboard
        // confirm simultaneously, only one transaction receives count=1.
        const claimed = await tx.merchantCreditPurchase.updateMany({
            where: { transactionId, status: 'pending' },
            data: { status: 'completed' }
        });

        if (claimed.count === 0) {
            const [currentPurchase, merchant] = await Promise.all([
                tx.merchantCreditPurchase.findUnique({ where: { transactionId } }),
                tx.merchant.findUnique({ where: { id: purchase.merchantId } })
            ]);
            return { purchase: currentPurchase, merchant, creditedNow: false };
        }

        const merchant = await tx.merchant.update({
            where: { id: purchase.merchantId },
            data: { credits: { increment: purchase.creditsAmount } }
        });
        await tx.merchantCreditLog.create({
            data: {
                merchantId: purchase.merchantId,
                amount: purchase.creditsAmount,
                type: 'purchase',
                description: `Purchased ${purchase.creditsAmount} credits`
            }
        });
        const completedPurchase = await tx.merchantCreditPurchase.findUnique({
            where: { transactionId }
        });

        return { purchase: completedPurchase, merchant, creditedNow: true };
    });

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
    console.log("--> ENTERED stripeWebhooks CONTROLLER");
    const sig = req.headers["stripe-signature"];
    let event;

    try {
        event = stripe.webhooks.constructEvent(
            req.rawBody,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
        console.log(`--> STRIPE EVENT VERIFIED: ${event.type}`);
    } catch (err) {
        console.log(`⚠️ Webhook signature verification failed.`, err.message);
        return res.sendStatus(400);
    }

    // Handle succeeded payment events
    if (event.type === "payment_intent.succeeded") {
        const paymentIntent = event.data.object;
        const transactionId = paymentIntent.id;
        const merchantId = paymentIntent.metadata.merchantId;

        try {
            const result = await completeCreditPurchase({
                transactionId,
                expectedMerchantId: merchantId
            });
            if (result.creditedNow) {
                await sendPurchaseReceipt({
                    merchant: result.merchant,
                    purchase: result.purchase,
                    transactionId
                });
                console.log(`Successfully credited ${result.purchase.creditsAmount} credits to merchant: ${merchantId}`);
            }
        } catch (error) {
            console.error(`Error processing Stripe Webhook transaction:`, error.message);
            return res.sendStatus(500);
        }
    }

    return res.sendStatus(200);
};

/**
 * @description Confirm a successful Stripe PaymentIntent and immediately credit the merchant
 * @route POST /api/merchant/payments/confirm
 * @access Private
 */
export const confirmCreditPurchase = async (req, res) => {
    const merchantId = req.merchant.id;
    const { paymentIntentId } = req.body;

    if (!paymentIntentId || typeof paymentIntentId !== 'string') {
        return res.status(400).json({ status: false, msg: 'paymentIntentId is required' });
    }

    try {
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (paymentIntent.status !== 'succeeded') {
            return res.status(409).json({
                status: false,
                msg: `Payment has not succeeded (status: ${paymentIntent.status})`
            });
        }
        if (paymentIntent.metadata?.merchantId !== merchantId) {
            return res.status(403).json({
                status: false,
                msg: 'Payment does not belong to this merchant'
            });
        }

        const result = await completeCreditPurchase({
            transactionId: paymentIntent.id,
            expectedMerchantId: merchantId
        });
        if (result.creditedNow) {
            await sendPurchaseReceipt({
                merchant: result.merchant,
                purchase: result.purchase,
                transactionId: paymentIntent.id
            });
        }

        return res.status(200).json({
            status: true,
            msg: result.creditedNow ? 'Credits added successfully' : 'Credits were already added',
            credits: result.merchant.credits,
            creditsAdded: result.purchase.creditsAmount,
            purchaseStatus: result.purchase.status
        });
    } catch (error) {
        console.error('Error confirming credit purchase:', error.message);
        return res.status(500).json({ status: false, msg: error.message });
    }
};

/**
 * Reconcile older pending purchases whose webhook was missed. This lets an
 * already-paid merchant recover credits simply by reopening the payments page.
 */
export const reconcileCreditPurchases = async (req, res) => {
    const merchantId = req.merchant.id;

    try {
        const pendingPurchases = await prisma.merchantCreditPurchase.findMany({
            where: {
                merchantId,
                status: 'pending',
                transactionId: { not: null }
            },
            orderBy: { createdAt: 'asc' },
            take: 20
        });

        let reconciledCount = 0;
        for (const purchase of pendingPurchases) {
            const paymentIntent = await stripe.paymentIntents.retrieve(purchase.transactionId);
            if (paymentIntent.status !== 'succeeded') continue;

            const result = await completeCreditPurchase({
                transactionId: purchase.transactionId,
                expectedMerchantId: merchantId
            });
            if (result.creditedNow) {
                reconciledCount += 1;
                await sendPurchaseReceipt({
                    merchant: result.merchant,
                    purchase: result.purchase,
                    transactionId: purchase.transactionId
                });
            }
        }

        const merchant = await prisma.merchant.findUnique({
            where: { id: merchantId },
            select: { credits: true }
        });
        return res.status(200).json({
            status: true,
            credits: merchant?.credits ?? 0,
            reconciledCount
        });
    } catch (error) {
        console.error('Error reconciling credit purchases:', error.message);
        return res.status(500).json({ status: false, msg: error.message });
    }
};

/**
 * @description Get Billing History
 * @route GET /api/merchant/payments/history
 * @access Private
 */
export const getBillingHistory = async (req, res) => {
    try {
        const merchantId = req.merchant.id;

        const history = await prisma.merchantCreditLog.findMany({
            where: { merchantId },
            orderBy: { createdAt: 'desc' }
        });

        return res.status(200).json({
            status: true,
            history
        });
    } catch (error) {
        console.error("Error fetching billing history:", error);
        return res.status(500).json({ status: false, msg: error.message });
    }
};

/**
 * @description Get Merchant Purchase History
 * @route GET /api/merchant/payments/purchase-history
 * @access Private
 */
export const getMerchantPurchaseHistory = async (req, res) => {
    const merchantId = req.merchant.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    try {
        const [transactions, total] = await prisma.$transaction([
            prisma.merchantCreditPurchase.findMany({
                where: { merchantId },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            }),
            prisma.merchantCreditPurchase.count({
                where: { merchantId }
            })
        ]);

        const hasNextPage = skip + transactions.length < total;

        return res.status(200).json({
            status: true,
            msg: 'Purchase history fetched successfully',
            data: transactions,
            pagination: {
                page,
                limit,
                total,
                hasNextPage
            }
        });

    } catch (error) {
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
};
