import { API } from 'api';
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import fetchBaseQueryHeaders from 'libs/fetchBaseQueryHeaders';

export const resourcePoolApi = createApi({
    reducerPath: 'resourcePoolApi',
    baseQuery: fetchBaseQuery({
        prepareHeaders: fetchBaseQueryHeaders,
    }),

    tagTypes: ['ResourcePool', 'ResourcePools'],

    endpoints: (builder) => ({
        getResourcePools: builder.query<IResourcePool[], TResourcePoolListParams>({
            query: (body) => ({
                url: API.RESOURCE_POOLS.LIST(),
                method: 'POST',
                body,
            }),
            providesTags: (result) =>
                result
                    ? [...result.map(({ name }) => ({ type: 'ResourcePool' as const, id: name })), 'ResourcePools']
                    : ['ResourcePools'],
        }),

        getProjectResourcePools: builder.query<IResourcePool[], { projectName: IProject['project_name'] }>({
            query: ({ projectName }) => ({
                url: API.RESOURCE_POOLS.PROJECT_LIST(projectName),
                method: 'POST',
            }),
            providesTags: (result) =>
                result
                    ? [...result.map(({ name }) => ({ type: 'ResourcePool' as const, id: name })), 'ResourcePools']
                    : ['ResourcePools'],
        }),

        getResourcePoolDetails: builder.query<IResourcePool, TResourcePoolGetParams>({
            query: (body) => ({
                url: API.RESOURCE_POOLS.GET(),
                method: 'POST',
                body,
            }),
            providesTags: (result) => (result ? [{ type: 'ResourcePool' as const, id: result.name }] : []),
        }),

        createResourcePool: builder.mutation<IResourcePool, TResourcePoolApplyParams>({
            query: (body) => ({
                url: API.RESOURCE_POOLS.CREATE(),
                method: 'POST',
                body,
            }),
            invalidatesTags: ['ResourcePools'],
        }),

        updateResourcePool: builder.mutation<IResourcePool, TResourcePoolApplyParams>({
            query: (body) => ({
                url: API.RESOURCE_POOLS.UPDATE(),
                method: 'POST',
                body,
            }),
            invalidatesTags: (_result, _error, arg) => [
                'ResourcePools',
                { type: 'ResourcePool', id: arg.plan.spec.configuration.name ?? 'unknown' },
            ],
        }),

        deleteResourcePools: builder.mutation<void, TResourcePoolDeleteParams>({
            query: (body) => ({
                url: API.RESOURCE_POOLS.DELETE(),
                method: 'POST',
                body,
            }),
            invalidatesTags: ['ResourcePools'],
        }),

        updateResourcePoolAssignment: builder.mutation<IResourcePool, TResourcePoolAssignmentUpdateParams>({
            query: (body) => ({
                url: API.RESOURCE_POOLS.ASSIGNMENTS_UPDATE(),
                method: 'POST',
                body,
            }),
            invalidatesTags: (_result, _error, arg) => ['ResourcePools', { type: 'ResourcePool', id: arg.resource_pool_name }],
        }),
    }),
});

export const {
    useCreateResourcePoolMutation,
    useDeleteResourcePoolsMutation,
    useGetProjectResourcePoolsQuery,
    useGetResourcePoolDetailsQuery,
    useGetResourcePoolsQuery,
    useUpdateResourcePoolAssignmentMutation,
    useUpdateResourcePoolMutation,
} = resourcePoolApi;
