import { API } from 'api';
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import fetchBaseQueryHeaders from 'libs/fetchBaseQueryHeaders';

export const adminOAuthApi = createApi({
    reducerPath: 'adminOAuthApi',
    baseQuery: fetchBaseQuery({
        prepareHeaders: fetchBaseQueryHeaders,
    }),

    tagTypes: ['AdminOAuth'],

    endpoints: (builder) => ({
        getFeishuConfig: builder.query<IFeishuOAuthConfig, void>({
            query: () => ({
                url: API.ADMIN_OAUTH.FEISHU.GET(),
                method: 'POST',
            }),
            providesTags: ['AdminOAuth'],
        }),

        updateFeishuConfig: builder.mutation<IFeishuOAuthConfig, IFeishuOAuthConfigUpdate>({
            query: (body) => ({
                url: API.ADMIN_OAUTH.FEISHU.UPDATE(),
                method: 'POST',
                body,
            }),
            invalidatesTags: ['AdminOAuth'],
        }),
    }),
});

export const { useGetFeishuConfigQuery, useUpdateFeishuConfigMutation } = adminOAuthApi;
