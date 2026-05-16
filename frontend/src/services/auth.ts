import { API } from 'api';
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import unauthorizedQueryHeaders from 'libs/fetchBaseQueryHeaders';

export const getServerTestUsersQuery = () => ({
    url: API.AUTH.TEST_USERS(),
    method: 'POST',
});

export const authApi = createApi({
    reducerPath: 'authApi',
    baseQuery: fetchBaseQuery({
        prepareHeaders: unauthorizedQueryHeaders,
    }),

    tagTypes: ['Auth'],

    endpoints: (builder) => ({
        getServerTestUsers: builder.query<IServerTestUsersResponse, void>({
            query: getServerTestUsersQuery,
        }),

        getNextRedirect: builder.mutation<{ redirect_url?: string }, { code: string; state: string }>({
            query: (body) => ({
                url: API.AUTH.NEXT_REDIRECT(),
                method: 'POST',
                body,
            }),
        }),

        getFeishuInfo: builder.query<{ enabled: boolean }, void>({
            query: () => ({
                url: API.AUTH.FEISHU.INFO(),
                method: 'POST',
            }),
        }),

        feishuAuthorize: builder.mutation<{ authorization_url: string }, void>({
            query: () => ({
                url: API.AUTH.FEISHU.AUTHORIZE(),
                method: 'POST',
            }),
        }),

        feishuCallback: builder.mutation<IUserWithCreds, { code: string; state: string }>({
            query: (body) => ({
                url: API.AUTH.FEISHU.CALLBACK(),
                method: 'POST',
                body,
            }),
        }),

        getOktaInfo: builder.query<{ enabled: boolean }, void>({
            query: () => {
                return {
                    url: API.AUTH.OKTA.INFO(),
                    method: 'POST',
                };
            },
        }),

        oktaAuthorize: builder.mutation<{ authorization_url: string }, void>({
            query: () => ({
                url: API.AUTH.OKTA.AUTHORIZE(),
                method: 'POST',
            }),
        }),

        oktaCallback: builder.mutation<IUserWithCreds, { code: string; state: string }>({
            query: (body) => ({
                url: API.AUTH.OKTA.CALLBACK(),
                method: 'POST',
                body,
            }),
        }),

        getEntraInfo: builder.query<{ enabled: boolean }, void>({
            query: () => {
                return {
                    url: API.AUTH.ENTRA.INFO(),
                    method: 'POST',
                };
            },
        }),

        entraAuthorize: builder.mutation<{ authorization_url: string }, { base_url: string }>({
            query: (body) => ({
                url: API.AUTH.ENTRA.AUTHORIZE(),
                method: 'POST',
                body,
            }),
        }),

        entraCallback: builder.mutation<IUserWithCreds, { code: string; state: string; base_url: string }>({
            query: (body) => ({
                url: API.AUTH.ENTRA.CALLBACK(),
                method: 'POST',
                body,
            }),
        }),

        getGoogleInfo: builder.query<{ enabled: boolean }, void>({
            query: () => {
                return {
                    url: API.AUTH.GOOGLE.INFO(),
                    method: 'POST',
                };
            },
        }),

        googleAuthorize: builder.mutation<{ authorization_url: string }, void>({
            query: () => ({
                url: API.AUTH.GOOGLE.AUTHORIZE(),
                method: 'POST',
            }),
        }),

        googleCallback: builder.mutation<IUserWithCreds, { code: string; state: string }>({
            query: (body) => ({
                url: API.AUTH.GOOGLE.CALLBACK(),
                method: 'POST',
                body,
            }),
        }),
    }),
});

export const {
    useGetServerTestUsersQuery,
    useGetNextRedirectMutation,
    useGetFeishuInfoQuery,
    useFeishuAuthorizeMutation,
    useFeishuCallbackMutation,
    useGetOktaInfoQuery,
    useOktaAuthorizeMutation,
    useOktaCallbackMutation,
    useGetEntraInfoQuery,
    useEntraAuthorizeMutation,
    useEntraCallbackMutation,
    useGetGoogleInfoQuery,
    useGoogleAuthorizeMutation,
    useGoogleCallbackMutation,
} = authApi;
