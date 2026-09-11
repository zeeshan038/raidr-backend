import { baseApi } from '../../../app/baseApi';

export const paymentApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        createPaymentIntent: builder.mutation({
            query: (data) => ({
                url: '/merchant/payments/create-intent',
                method: 'POST',
                body: data,
            }),
        }),
        getBillingHistory: builder.query({
            query: () => '/merchant/payments/history',
        }),
        getMerchantPurchaseHistory: builder.query({
            query: ({ page = 1, limit = 10 } = {}) => `/merchant/payments/purchase-history?page=${page}&limit=${limit}`,
        }),
    }),
});

export const { useCreatePaymentIntentMutation, useGetBillingHistoryQuery, useGetMerchantPurchaseHistoryQuery } = paymentApi;
