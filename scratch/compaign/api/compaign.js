import { baseApi } from '../../../app/baseApi';
import { merchant_ads_url } from '../../../app/constant';

export const compaignApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getCampaigns: builder.query({
      query: (params = {}) => {
        const queryParams = new URLSearchParams();
        if (params.page) queryParams.append('page', params.page);
        if (params.limit) queryParams.append('limit', params.limit);
        if (params.search) queryParams.append('search', params.search);
        if (params.adCategory) queryParams.append('adCategory', params.adCategory);
        
        const queryString = queryParams.toString();
        return {
          url: `${merchant_ads_url}/get-all-campaigns${queryString ? `?${queryString}` : ''}`,
          method: 'GET',
        };
      },
      providesTags: ['MerchantAds'],
      transformResponse: (response) => {
        if (response.status) {
          // You could also return an object { data: response.data, pagination: response.pagination } 
          // if your UI components are updated to handle it, but returning response.data 
          // keeps it compatible with your existing `.map()` calls!
          return response.data || [];
        }
        return [];
      }
    }),
    getCampaignById: builder.query({
      query: (arg) => {
        const id = typeof arg === 'string' ? arg : arg?.id;
        const search = typeof arg === 'object' ? arg?.search : undefined;
        let url = `${merchant_ads_url}/get-campaign/${id}`;
        if (search) {
          url += `?search=${search}`;
        }
        return {
          url,
          method: 'GET',
        };
      },
      providesTags: (result, error, arg) => {
        const id = typeof arg === 'string' ? arg : arg?.id;
        return [{ type: 'MerchantAds', id }];
      },
      transformResponse: (response) => {
        if (response.status) {
          return response.ad;
        }
        return null;
      }
    }),
    createCampaign: builder.mutation({
      query: (campaignData) => ({
        url: `${merchant_ads_url}/create`,
        method: 'POST',
        body: campaignData,
      }),
      invalidatesTags: ['MerchantAds'],
    }),
    updateCampaign: builder.mutation({
      query: ({ id: campaignId, ...campaignData }) => ({
        url: `${merchant_ads_url}/update-campaign/${campaignId}`,
        method: 'PUT',
        body: campaignData,
      }),
      invalidatesTags: (result, error, arg) => [
        { type: 'MerchantAds', id: arg.id },
        'MerchantAds'
      ],
    }),
    deleteCampaign: builder.mutation({
      query: (campaignId) => ({
        url: `${merchant_ads_url}/delete-campaign/${campaignId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['MerchantAds'],
    }),
    toggleCampaignStatus: builder.mutation({
      query: ({ id: campaignId, isActive }) => ({
        url: `${merchant_ads_url}/toggle-campaign-status/${campaignId}`,
        method: 'PATCH',
        body: { isActive },
      }),
      invalidatesTags: (result, error, arg) => [
        { type: 'MerchantAds', id: arg.id },
        'MerchantAds'
      ],
    }),
    getCampaignImpressions: builder.query({
      query: (campaignId) => ({
        url: `${merchant_ads_url}/${campaignId}/impressions`,
        method: 'GET',
      }),
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetCampaignsQuery,
  useGetCampaignByIdQuery,
  useCreateCampaignMutation,
  useUpdateCampaignMutation,
  useDeleteCampaignMutation,
  useToggleCampaignStatusMutation,
  useGetCampaignImpressionsQuery
} = compaignApi;
