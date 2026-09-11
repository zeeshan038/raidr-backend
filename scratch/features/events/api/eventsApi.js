import { baseApi } from '../../../app/baseApi';

export const eventsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    createEvent: builder.mutation({
      query: (eventData) => ({
        url: '/merchant/events/create',
        method: 'POST',
        body: eventData,
      }),
      invalidatesTags: ['Events'],
    }),
    getMyEvents: builder.query({
      query: () => {  
        return {
          url: `/merchant/events/my-events`,
          method: 'GET',
        };
      },
      providesTags: ['Events'],
    }),
    getEventById: builder.query({
      query: (eventId) => ({
        url: `/merchant/events/specific-event/${eventId}`,
        method: 'GET',
      }),
      providesTags: ['Events'],
    }),
    updateEvent: builder.mutation({
      query: ({ eventId, eventData }) => ({
        url: `/merchant/events/update-event/${eventId}`,
        method: 'PUT',
        body: eventData,
      }),
      invalidatesTags: ['Events'],
    }),
    deleteEvent: builder.mutation({
      query: (eventId) => ({
        url: `/merchant/events/delete/${eventId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Events'],
    }),

    // Coin Rush endpoints
    createCoinRush: builder.mutation({
      query: (eventData) => ({
        url: '/merchant/coin-rush/create',
        method: 'POST',
        body: eventData,
      }),
      invalidatesTags: ['Events'],
    }),
    createHybridCoinRush: builder.mutation({
      query: (eventData) => ({
        url: '/merchant/coin-rush/hybrid/create',
        method: 'POST',
        body: eventData,
      }),
      invalidatesTags: ['Events'],
    }),
    getMyCoinRushEvents: builder.query({
      query: () => ({
        url: '/merchant/coin-rush/my-events',
        method: 'GET',
      }),
      providesTags: ['Events'],
    }),
    getCoinRushQRCheckpoints: builder.query({
      query: (eventId) => ({
        url: `/merchant/coin-rush/qr-codes/${eventId}`,
        method: 'GET',
      }),
      providesTags: ['Events'],
    }),
    updateCoinRush: builder.mutation({
      query: ({ eventId, eventData }) => ({
        url: `/merchant/coin-rush/update/${eventId}`,
        method: 'PUT',
        body: eventData,
      }),
      invalidatesTags: ['Events'],
    }),
    deleteCoinRush: builder.mutation({
      query: (eventId) => ({
        url: `/merchant/coin-rush/delete/${eventId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Events'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useCreateEventMutation,
  useGetMyEventsQuery,
  useGetEventByIdQuery,
  useUpdateEventMutation,
  useDeleteEventMutation,
  useCreateCoinRushMutation,
  useCreateHybridCoinRushMutation,
  useGetMyCoinRushEventsQuery,
  useGetCoinRushQRCheckpointsQuery,
  useUpdateCoinRushMutation,
  useDeleteCoinRushMutation,
} = eventsApi;
