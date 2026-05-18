import { API } from 'api';
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import fetchBaseQueryHeaders from 'libs/fetchBaseQueryHeaders';

export const runtimeImagesApi = createApi({
    reducerPath: 'runtimeImagesApi',
    baseQuery: fetchBaseQuery({
        prepareHeaders: fetchBaseQueryHeaders,
    }),

    tagTypes: ['RuntimeImages'],

    endpoints: (builder) => ({
        getRuntimeImages: builder.query<IRuntimeImage[], void>({
            query: () => ({
                url: API.RUNTIME_IMAGES.LIST(),
                method: 'POST',
                body: {},
            }),
            providesTags: ['RuntimeImages'],
        }),

        updateRuntimeImages: builder.mutation<IRuntimeImage[], TRuntimeImagesUpdateParams>({
            query: (body) => ({
                url: API.RUNTIME_IMAGES.UPDATE(),
                method: 'POST',
                body,
            }),
            invalidatesTags: ['RuntimeImages'],
        }),
    }),
});

export const { useGetRuntimeImagesQuery, useUpdateRuntimeImagesMutation } = runtimeImagesApi;
