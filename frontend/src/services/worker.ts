import { API } from 'api';
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import fetchBaseQueryHeaders from 'libs/fetchBaseQueryHeaders';

export const workerApi = createApi({
    reducerPath: 'workerApi',
    baseQuery: fetchBaseQuery({
        prepareHeaders: fetchBaseQueryHeaders,
    }),

    tagTypes: ['WorkerRegistrationTokens'],

    endpoints: (builder) => ({
        getWorkerRegistrationTokens: builder.query<IWorkerRegistrationToken[], void>({
            query: () => ({
                url: API.ADMIN_WORKERS.LIST_TOKENS(),
                method: 'POST',
            }),
            providesTags: ['WorkerRegistrationTokens'],
        }),

        createWorkerRegistrationToken: builder.mutation<IWorkerRegistrationToken, TCreateWorkerRegistrationTokenParams>({
            query: (body) => ({
                url: API.ADMIN_WORKERS.CREATE_TOKEN(),
                method: 'POST',
                body,
            }),
            invalidatesTags: ['WorkerRegistrationTokens'],
        }),

        deleteWorkerRegistrationToken: builder.mutation<void, TDeleteWorkerRegistrationTokenParams>({
            query: (body) => ({
                url: API.ADMIN_WORKERS.DELETE_TOKEN(),
                method: 'POST',
                body,
            }),
            invalidatesTags: ['WorkerRegistrationTokens'],
        }),
    }),
});

export const {
    useCreateWorkerRegistrationTokenMutation,
    useDeleteWorkerRegistrationTokenMutation,
    useGetWorkerRegistrationTokensQuery,
} = workerApi;
