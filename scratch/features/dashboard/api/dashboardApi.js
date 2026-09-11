import { baseApi } from '../../../app/baseApi';
import { merchant_dashboard_url } from '../../../app/constant';

export const dashboardApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getDashboardAllCampaigns: builder.query({
      query: (params = {}) => {
        const queryParams = new URLSearchParams();
        if (params.page) queryParams.append('page', params.page);
        if (params.limit) queryParams.append('limit', params.limit);
        if (params.search) queryParams.append('search', params.search);
        
        const queryString = queryParams.toString();
        return {
          url: `${merchant_dashboard_url}/all${queryString ? `?${queryString}` : ''}`,
          method: 'GET',
        };
      },
      providesTags: ['Dashboard'],
      transformResponse: (response) => {
        if (response.status) {
          return response.data || [];
        }
        return [];
      }
    }),
    
    getDashboardActiveCampaigns: builder.query({
      query: (params = {}) => {
        const queryParams = new URLSearchParams();
        if (params.page) queryParams.append('page', params.page);
        if (params.limit) queryParams.append('limit', params.limit);
        if (params.search) queryParams.append('search', params.search);
        
        const queryString = queryParams.toString();
        return {
          url: `${merchant_dashboard_url}/active-campaigns${queryString ? `?${queryString}` : ''}`,
          method: 'GET',
        };
      },
      providesTags: ['Dashboard'],
      transformResponse: (response) => {
        if (response.status) {
          return response.data || [];
        }
        return [];
      }
    }),
    
    getDashboardTotalCount: builder.query({
      query: () => ({
        url: `${merchant_dashboard_url}/dashboard-total-count`,
        method: 'GET',
      }),
      providesTags: ['Dashboard'],
      transformResponse: (response) => {
        if (response.status) {
          return response.data;
        }
        return null;
      }
    }),
    
    getDashboardImpressionOverTime: builder.query({
      query: (days) => {
        const queryString = days ? `?days=${days}` : '';
        return {
          url: `${merchant_dashboard_url}/impression-over-time${queryString}`,
          method: 'GET',
        };
      },
      providesTags: ['Dashboard'],
      transformResponse: (response) => {
        if (response.status) {
          return response.data || [];
        }
        return [];
      }
    }),
    
    getDashboardRewardBreakdown: builder.query({
      query: () => ({
        url: `${merchant_dashboard_url}reward-breakdown`,
        method: 'GET',
      }),
      providesTags: ['Dashboard'],
      transformResponse: (response) => {
        if (response.status) {
          return response.data || [];
        }
        return [];
      }
    }),
    
    getDashboardPeakActivity: builder.query({
      query: () => ({
        url: `${merchant_dashboard_url}peak-activity`,
        method: 'GET',
      }),
      providesTags: ['Dashboard'],
      transformResponse: (response) => {
        if (response.status) {
          return response.data || [];
        }
        return [];
      }
    }),
    
    getDashboardEventStats: builder.query({
      query: () => ({
        url: `${merchant_dashboard_url}event-stats`,
        method: 'GET',
      }),
      providesTags: ['Dashboard'],
      transformResponse: (response) => {
        if (response.status) {
          return response.data || {};
        }
        return {};
      }
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetDashboardAllCampaignsQuery,
  useGetDashboardActiveCampaignsQuery,
  useGetDashboardTotalCountQuery,
  useGetDashboardImpressionOverTimeQuery,
  useGetDashboardRewardBreakdownQuery,
  useGetDashboardPeakActivityQuery,
  useGetDashboardEventStatsQuery
} = dashboardApi;
