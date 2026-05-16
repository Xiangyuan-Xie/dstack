import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';

import { ROUTES } from 'routes';

import App from 'App';
import { AuthErrorPage, LoginPage, LogoutPage, OAuthCallbackPage } from 'pages/Console/Auth';
import { AdminRoute, ConsoleLayout } from 'pages/Console/Layout';
import {
    AccountBillingPage,
    AccountKeysPage,
    AccountProfilePage,
    AccountProjectsPage,
    BackendPage,
    ContainersPage,
    DashboardPage,
    EventsPage,
    FleetCreatePage,
    FleetDetailsPage,
    FleetsPage,
    GatewayPage,
    GpuRequestCreatePage,
    GpuRequestDetailsPage,
    GpuRequestsPage,
    InstanceDetailsPage,
    InstancesPage,
    ModelDetailsPage,
    ModelsPage,
    NotFoundPage,
    OffersPage,
    ProjectCreatePage,
    ProjectDetailsPage,
    ProjectsPage,
    RunCreatePage,
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
            { path: ROUTES.AUTH.GITHUB_CALLBACK, element: <OAuthCallbackPage provider="github" /> },
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
                    { path: C.GPU_REQUESTS, element: <GpuRequestsPage /> },
                    { path: C.GPU_REQUEST_CREATE, element: <GpuRequestCreatePage /> },
                    { path: C.GPU_REQUEST_DETAILS.TEMPLATE, element: <GpuRequestDetailsPage /> },
                    { path: C.GPU_CONTAINERS, element: <ContainersPage /> },
                    { path: C.RESOURCES_RUNS, element: <RunsPage /> },
                    { path: C.RESOURCES_RUN_CREATE, element: <RunCreatePage /> },
                    { path: C.RESOURCES_RUN_DETAILS.TEMPLATE, element: <RunDetailsPage /> },
                    { path: C.RESOURCES_JOB_DETAILS.TEMPLATE, element: <RunDetailsPage /> },
                    { path: C.RESOURCES_FLEETS, element: <FleetsPage /> },
                    { path: C.RESOURCES_FLEET_CREATE, element: <FleetCreatePage /> },
                    { path: C.RESOURCES_FLEET_DETAILS.TEMPLATE, element: <FleetDetailsPage /> },
                    { path: C.RESOURCES_INSTANCES, element: <InstancesPage /> },
                    { path: C.RESOURCES_INSTANCE_DETAILS.TEMPLATE, element: <InstanceDetailsPage /> },
                    { path: C.RESOURCES_OFFERS, element: <OffersPage /> },
                    { path: C.RESOURCES_MODELS, element: <ModelsPage /> },
                    { path: C.RESOURCES_MODEL_DETAILS.TEMPLATE, element: <ModelDetailsPage /> },
                    { path: C.RESOURCES_VOLUMES, element: <VolumesPage /> },
                    { path: C.WORKSPACE_PROJECTS, element: <ProjectsPage /> },
                    { path: C.WORKSPACE_PROJECT_CREATE, element: <ProjectCreatePage /> },
                    { path: C.WORKSPACE_PROJECT_DETAILS.TEMPLATE, element: <ProjectDetailsPage /> },
                    { path: C.WORKSPACE_BACKEND_CREATE.TEMPLATE, element: <BackendPage create /> },
                    { path: C.WORKSPACE_BACKEND_DETAILS.TEMPLATE, element: <BackendPage /> },
                    { path: C.WORKSPACE_GATEWAY_CREATE.TEMPLATE, element: <GatewayPage create /> },
                    { path: C.WORKSPACE_GATEWAY_DETAILS.TEMPLATE, element: <GatewayPage /> },
                    {
                        path: C.ADMIN_APPROVALS,
                        element: (
                            <AdminRoute>
                                <GpuRequestsPage approvals />
                            </AdminRoute>
                        ),
                    },
                    {
                        path: C.ADMIN_CONTAINERS,
                        element: (
                            <AdminRoute>
                                <ContainersPage adminView />
                            </AdminRoute>
                        ),
                    },
                    {
                        path: C.ADMIN_SERVERS,
                        element: (
                            <AdminRoute>
                                <FleetsPage servers />
                            </AdminRoute>
                        ),
                    },
                    {
                        path: C.ADMIN_USERS,
                        element: (
                            <AdminRoute>
                                <UsersPage />
                            </AdminRoute>
                        ),
                    },
                    {
                        path: C.ADMIN_USER_CREATE,
                        element: (
                            <AdminRoute>
                                <UserCreatePage />
                            </AdminRoute>
                        ),
                    },
                    {
                        path: C.ADMIN_USER_DETAILS.TEMPLATE,
                        element: (
                            <AdminRoute>
                                <UserDetailsPage />
                            </AdminRoute>
                        ),
                    },
                    {
                        path: C.ADMIN_EVENTS,
                        element: (
                            <AdminRoute>
                                <EventsPage />
                            </AdminRoute>
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
