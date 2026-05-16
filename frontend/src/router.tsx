import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';

import { ROUTES } from 'routes';

import App from 'App';
import { AuthErrorPage, LoginPage, LogoutPage, OAuthCallbackPage } from 'pages/Console/Auth';
import { ConsoleLayout, GlobalAdminRoute, ProjectAdminRoute } from 'pages/Console/Layout';
import {
    AccountBillingPage,
    AccountKeysPage,
    AccountProfilePage,
    AccountProjectsPage,
    AdminSettingsPage,
    BackendPage,
    DashboardPage,
    EventsPage,
    FleetCreatePage,
    FleetDetailsPage,
    FleetsPage,
    GatewayPage,
    RunApprovalsPage,
    RunRequestCreatePage,
    RunRequestDetailsPage,
    InstanceDetailsPage,
    InstancesPage,
    ModelDetailsPage,
    ModelsPage,
    NotFoundPage,
    OffersPage,
    ProjectCreatePage,
    ProjectDetailsPage,
    ProjectsPage,
    RunDetailsPage,
    RunsPage,
    UserCreatePage,
    UserDetailsPage,
    UsersPage,
    VolumesPage,
} from 'pages/Console/pages';

const C = ROUTES.CONSOLE;

export const router = createBrowserRouter([
    {
        path: '/',
        element: <App />,
        errorElement: <AuthErrorPage title="Not Found" text="Page not found" />,
        children: [
            { path: ROUTES.AUTH.FEISHU_CALLBACK, element: <OAuthCallbackPage provider="feishu" /> },
            { path: ROUTES.AUTH.OKTA_CALLBACK, element: <OAuthCallbackPage provider="okta" /> },
            { path: ROUTES.AUTH.ENTRA_CALLBACK, element: <OAuthCallbackPage provider="entra" /> },
            { path: ROUTES.AUTH.GOOGLE_CALLBACK, element: <OAuthCallbackPage provider="google" /> },
            { path: ROUTES.AUTH.TOKEN, element: <LoginPage tokenOnly /> },
            { path: ROUTES.LOGOUT, element: <LogoutPage /> },
            {
                element: <ConsoleLayout />,
                children: [
                    { index: true, element: <Navigate replace to={C.DASHBOARD} /> },
                    { path: C.DASHBOARD, element: <DashboardPage /> },
                    { path: C.RUNS, element: <RunsPage /> },
                    { path: C.RUN_CREATE, element: <RunRequestCreatePage /> },
                    { path: C.RUN_REQUEST_DETAILS.TEMPLATE, element: <RunRequestDetailsPage /> },
                    { path: C.RUN_DETAILS.TEMPLATE, element: <RunDetailsPage /> },
                    { path: C.JOB_DETAILS.TEMPLATE, element: <RunDetailsPage /> },
                    {
                        path: C.RUN_APPROVALS,
                        element: (
                            <ProjectAdminRoute>
                                <RunApprovalsPage />
                            </ProjectAdminRoute>
                        ),
                    },
                    {
                        path: C.RESOURCES_FLEETS,
                        element: (
                            <GlobalAdminRoute>
                                <FleetsPage />
                            </GlobalAdminRoute>
                        ),
                    },
                    {
                        path: C.RESOURCES_FLEET_CREATE,
                        element: (
                            <GlobalAdminRoute>
                                <FleetCreatePage />
                            </GlobalAdminRoute>
                        ),
                    },
                    {
                        path: C.RESOURCES_FLEET_DETAILS.TEMPLATE,
                        element: (
                            <GlobalAdminRoute>
                                <FleetDetailsPage />
                            </GlobalAdminRoute>
                        ),
                    },
                    {
                        path: C.RESOURCES_INSTANCES,
                        element: (
                            <GlobalAdminRoute>
                                <InstancesPage />
                            </GlobalAdminRoute>
                        ),
                    },
                    {
                        path: C.RESOURCES_INSTANCE_DETAILS.TEMPLATE,
                        element: (
                            <GlobalAdminRoute>
                                <InstanceDetailsPage />
                            </GlobalAdminRoute>
                        ),
                    },
                    {
                        path: C.RESOURCES_OFFERS,
                        element: (
                            <GlobalAdminRoute>
                                <OffersPage />
                            </GlobalAdminRoute>
                        ),
                    },
                    {
                        path: C.RESOURCES_MODELS,
                        element: (
                            <GlobalAdminRoute>
                                <ModelsPage />
                            </GlobalAdminRoute>
                        ),
                    },
                    {
                        path: C.RESOURCES_MODEL_DETAILS.TEMPLATE,
                        element: (
                            <GlobalAdminRoute>
                                <ModelDetailsPage />
                            </GlobalAdminRoute>
                        ),
                    },
                    {
                        path: C.RESOURCES_VOLUMES,
                        element: (
                            <GlobalAdminRoute>
                                <VolumesPage />
                            </GlobalAdminRoute>
                        ),
                    },
                    {
                        path: C.WORKSPACE_PROJECTS,
                        element: (
                            <GlobalAdminRoute>
                                <ProjectsPage />
                            </GlobalAdminRoute>
                        ),
                    },
                    {
                        path: C.WORKSPACE_PROJECT_CREATE,
                        element: (
                            <GlobalAdminRoute>
                                <ProjectCreatePage />
                            </GlobalAdminRoute>
                        ),
                    },
                    {
                        path: C.WORKSPACE_PROJECT_DETAILS.TEMPLATE,
                        element: (
                            <GlobalAdminRoute>
                                <ProjectDetailsPage />
                            </GlobalAdminRoute>
                        ),
                    },
                    {
                        path: C.WORKSPACE_BACKEND_CREATE.TEMPLATE,
                        element: (
                            <GlobalAdminRoute>
                                <BackendPage create />
                            </GlobalAdminRoute>
                        ),
                    },
                    {
                        path: C.WORKSPACE_BACKEND_DETAILS.TEMPLATE,
                        element: (
                            <GlobalAdminRoute>
                                <BackendPage />
                            </GlobalAdminRoute>
                        ),
                    },
                    {
                        path: C.WORKSPACE_GATEWAY_CREATE.TEMPLATE,
                        element: (
                            <GlobalAdminRoute>
                                <GatewayPage create />
                            </GlobalAdminRoute>
                        ),
                    },
                    {
                        path: C.WORKSPACE_GATEWAY_DETAILS.TEMPLATE,
                        element: (
                            <GlobalAdminRoute>
                                <GatewayPage />
                            </GlobalAdminRoute>
                        ),
                    },
                    {
                        path: C.ADMIN_SERVERS,
                        element: (
                            <ProjectAdminRoute>
                                <FleetsPage servers />
                            </ProjectAdminRoute>
                        ),
                    },
                    {
                        path: C.ADMIN_SETTINGS,
                        element: (
                            <GlobalAdminRoute>
                                <AdminSettingsPage />
                            </GlobalAdminRoute>
                        ),
                    },
                    {
                        path: C.ADMIN_USERS,
                        element: (
                            <GlobalAdminRoute>
                                <UsersPage />
                            </GlobalAdminRoute>
                        ),
                    },
                    {
                        path: C.ADMIN_USER_CREATE,
                        element: (
                            <GlobalAdminRoute>
                                <UserCreatePage />
                            </GlobalAdminRoute>
                        ),
                    },
                    {
                        path: C.ADMIN_USER_DETAILS.TEMPLATE,
                        element: (
                            <GlobalAdminRoute>
                                <UserDetailsPage />
                            </GlobalAdminRoute>
                        ),
                    },
                    {
                        path: C.ADMIN_EVENTS,
                        element: (
                            <GlobalAdminRoute>
                                <EventsPage />
                            </GlobalAdminRoute>
                        ),
                    },
                    { path: C.ACCOUNT_PROFILE, element: <AccountProfilePage /> },
                    { path: C.ACCOUNT_PROJECTS, element: <AccountProjectsPage /> },
                    { path: C.ACCOUNT_KEYS, element: <AccountKeysPage /> },
                    { path: C.ACCOUNT_BILLING, element: <AccountBillingPage /> },
                    { path: '*', element: <NotFoundPage /> },
                ],
            },
        ],
    },
]);
