import { API } from 'api';
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import fetchBaseQueryHeaders from 'libs/fetchBaseQueryHeaders';

export const runRequestApi = createApi({
    reducerPath: 'runRequestApi',
    refetchOnMountOrArgChange: true,
    baseQuery: fetchBaseQuery({
        prepareHeaders: fetchBaseQueryHeaders,
    }),

    tagTypes: ['RunRequests', 'RunRequest'],

    endpoints: (builder) => ({
        getAllRunRequests: builder.query<IRunRequest[], TRunRequestGlobalListParams | void>({
            query: (body = {}) => ({
                url: API.PROJECTS.RUN_REQUESTS_LIST_ALL(),
                method: 'POST',
                body,
            }),

            providesTags: (result) =>
                result ? [...result.map(({ id }) => ({ type: 'RunRequest' as const, id })), 'RunRequests'] : ['RunRequests'],
        }),

        getRunRequests: builder.query<IRunRequest[], TRunRequestListParams>({
            query: ({ project_name, ...body }) => ({
                url: API.PROJECTS.RUN_REQUESTS_LIST(project_name),
                method: 'POST',
                body,
            }),

            providesTags: (result) =>
                result ? [...result.map(({ id }) => ({ type: 'RunRequest' as const, id })), 'RunRequests'] : ['RunRequests'],
        }),

        getRunRequest: builder.query<IRunRequest, { project_name: IProject['project_name']; id: IRunRequest['id'] }>({
            query: ({ project_name, id }) => ({
                url: API.PROJECTS.RUN_REQUESTS_GET(project_name),
                method: 'POST',
                body: { id },
            }),

            providesTags: (result) => (result ? [{ type: 'RunRequest' as const, id: result.id }] : []),
        }),

        createRunRequest: builder.mutation<IRunRequest, TRunRequestCreateParams>({
            query: ({ project_name, request }) => ({
                url: API.PROJECTS.RUN_REQUESTS_CREATE(project_name),
                method: 'POST',
                body: { request },
            }),

            invalidatesTags: ['RunRequests'],
        }),

        approveRunRequest: builder.mutation<IRunRequest, TRunRequestReviewParams>({
            query: ({ project_name, id }) => ({
                url: API.PROJECTS.RUN_REQUESTS_APPROVE(project_name),
                method: 'POST',
                body: { id },
            }),

            invalidatesTags: (result, error, params) => ['RunRequests', { type: 'RunRequest' as const, id: params.id }],
        }),

        rejectRunRequest: builder.mutation<IRunRequest, TRunRequestRejectParams>({
            query: ({ project_name, id, reason }) => ({
                url: API.PROJECTS.RUN_REQUESTS_REJECT(project_name),
                method: 'POST',
                body: { id, reason },
            }),

            invalidatesTags: (result, error, params) => ['RunRequests', { type: 'RunRequest' as const, id: params.id }],
        }),

        retryRunRequest: builder.mutation<IRunRequest, TRunRequestReviewParams>({
            query: ({ project_name, id }) => ({
                url: API.PROJECTS.RUN_REQUESTS_RETRY(project_name),
                method: 'POST',
                body: { id },
            }),

            invalidatesTags: (result, error, params) => ['RunRequests', { type: 'RunRequest' as const, id: params.id }],
        }),
    }),
});

export const {
    useGetAllRunRequestsQuery,
    useGetRunRequestsQuery,
    useGetRunRequestQuery,
    useCreateRunRequestMutation,
    useApproveRunRequestMutation,
    useRejectRunRequestMutation,
    useRetryRunRequestMutation,
} = runRequestApi;
