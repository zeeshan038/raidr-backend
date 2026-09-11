import { baseApi } from '../../../app/baseApi';
import { setCredentials } from '../../../store/authSlice';

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    merchantLogin: builder.mutation({
      query: (credentials) => ({
        url: '/merchant/login',
        method: 'POST',
        body: credentials,
      }),
      async onQueryStarted(args, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          if (data && data.status && data.token) {
            // Save token and user details to localStorage
            localStorage.setItem('token', data.token);
            if (data.merchant) {
              localStorage.setItem('user', JSON.stringify(data.merchant));
              localStorage.setItem('name', data.merchant.name || '');
              localStorage.setItem('profileImage', data.merchant.photoUrl || '');
            }
            // Update Redux state
            dispatch(setCredentials({ user: data.merchant, token: data.token }));
          }
        } catch (error) {
          // Login failed, handled by component
        }
      },
      invalidatesTags: ['User'],
    }),
    merchantRegister: builder.mutation({
      query: (userData) => ({
        url: '/merchant/register',
        method: 'POST',
        body: userData,
      }),
      invalidatesTags: ['User'],
    }),
    merchantWhoami: builder.query({
      query: () => ({
        url: '/merchant/whoami',
        method: 'GET',
      }),
      providesTags: ['User'],
      async onQueryStarted(args, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          if (data && data.status && data.merchant) {
            import('../../../store/authSlice').then(({ setCredits }) => {
              dispatch(setCredits(data.merchant.credits || 0));
            });
          }
        } catch (error) {
          // Handled by component
        }
      },
    }),
    merchantCredits: builder.query({
      query: () => ({
        url: '/merchant/credits',
        method: 'GET',
      }),
      providesTags: ['User'],
      async onQueryStarted(args, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          if (data && data.status && data.credits !== undefined) {
            import('../../../store/authSlice').then(({ setCredits }) => {
              dispatch(setCredits(data.credits));
            });
          }
        } catch (error) {
          // Handled by component
        }
      },
    }),
    updateUser: builder.mutation({
      query: (userData) => ({
        url: '/merchant/user',
        method: 'PUT',
        body: userData,
      }),
      invalidatesTags: ['User'],
    }),
    updateBusiness: builder.mutation({
      query: (businessData) => ({
        url: '/merchant/business',
        method: 'PUT',
        body: businessData,
      }),
      invalidatesTags: ['User'],
    }),
    changePassword: builder.mutation({
      query: (passwordData) => ({
        url: '/merchant/change-password',
        method: 'PUT',
        body: passwordData,
      }),
    }),
  }),
  overrideExisting: false,
});

export const { useMerchantLoginMutation, useMerchantRegisterMutation, useMerchantWhoamiQuery, useMerchantCreditsQuery, useUpdateUserMutation, useUpdateBusinessMutation, useChangePasswordMutation } = authApi;
