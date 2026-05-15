import { API } from 'api';
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import fetchBaseQueryHeaders from 'libs/fetchBaseQueryHeaders';

export const gpuRequestApi = createApi({
    reducerPath: 'gpuRequestApi',
    refetchOnMountOrArgChange: true,
    baseQuery: fetchBaseQuery({
        prepareHeaders: fetchBaseQueryHeaders,
    }),

    tagTypes: ['GpuRequests', 'GpuRequest'],

    endpoints: (builder) => ({
        getAllGpuRequests: builder.query<IGpuRequest[], TGpuRequestGlobalListParams | void>({
            query: (body = {}) => ({
                url: API.PROJECTS.GPU_REQUESTS_LIST_ALL(),
                method: 'POST',
                body,
            }),

            providesTags: (result) =>
                result ? [...result.map(({ id }) => ({ type: 'GpuRequest' as const, id })), 'GpuRequests'] : ['GpuRequests'],
        }),

        getGpuRequests: builder.query<IGpuRequest[], TGpuRequestListParams>({
            query: ({ project_name, ...body }) => ({
                url: API.PROJECTS.GPU_REQUESTS_LIST(project_name),
                method: 'POST',
                body,
            }),

            providesTags: (result) =>
                result ? [...result.map(({ id }) => ({ type: 'GpuRequest' as const, id })), 'GpuRequests'] : ['GpuRequests'],
        }),

        getGpuRequest: builder.query<IGpuRequest, { project_name: IProject['project_name']; id: IGpuRequest['id'] }>({
            query: ({ project_name, id }) => ({
                url: API.PROJECTS.GPU_REQUESTS_GET(project_name),
                method: 'POST',
                body: { id },
            }),

            providesTags: (result) => (result ? [{ type: 'GpuRequest' as const, id: result.id }] : []),
        }),

        createGpuRequest: builder.mutation<IGpuRequest, TGpuRequestCreateParams>({
            query: ({ project_name, request }) => ({
                url: API.PROJECTS.GPU_REQUESTS_CREATE(project_name),
                method: 'POST',
                body: { request },
            }),

            invalidatesTags: ['GpuRequests'],
        }),

        approveGpuRequest: builder.mutation<IGpuRequest, TGpuRequestReviewParams>({
            query: ({ project_name, id }) => ({
                url: API.PROJECTS.GPU_REQUESTS_APPROVE(project_name),
                method: 'POST',
                body: { id },
            }),

            invalidatesTags: (result, error, params) => ['GpuRequests', { type: 'GpuRequest' as const, id: params.id }],
        }),

        rejectGpuRequest: builder.mutation<IGpuRequest, TGpuRequestRejectParams>({
            query: ({ project_name, id, reason }) => ({
                url: API.PROJECTS.GPU_REQUESTS_REJECT(project_name),
                method: 'POST',
                body: { id, reason },
            }),

            invalidatesTags: (result, error, params) => ['GpuRequests', { type: 'GpuRequest' as const, id: params.id }],
        }),

        retryGpuRequest: builder.mutation<IGpuRequest, TGpuRequestReviewParams>({
            query: ({ project_name, id }) => ({
                url: API.PROJECTS.GPU_REQUESTS_RETRY(project_name),
                method: 'POST',
                body: { id },
            }),

            invalidatesTags: (result, error, params) => ['GpuRequests', { type: 'GpuRequest' as const, id: params.id }],
        }),
    }),
});

export const {
    useGetAllGpuRequestsQuery,
    useGetGpuRequestsQuery,
    useGetGpuRequestQuery,
    useCreateGpuRequestMutation,
    useApproveGpuRequestMutation,
    useRejectGpuRequestMutation,
    useRetryGpuRequestMutation,
} = gpuRequestApi;
