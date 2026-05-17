import { buildRoute } from 'libs';

export const LOCALE_STORAGE_KEY = 'dstack_console_locale';
export const THEME_STORAGE_KEY = 'dstack_console_theme';

export const CONSOLE_ROUTES = {
    DASHBOARD: '/dashboard',
    RUNS: '/resources/runs',
    RUN_CREATE: '/resources/runs/new',
    RUN_APPROVALS: '/admin/approvals',
    RUN_REQUEST_DETAILS: {
        TEMPLATE: '/resources/runs/requests/:projectName/:requestId',
        FORMAT: (projectName: string, requestId: string) =>
            buildRoute(CONSOLE_ROUTES.RUN_REQUEST_DETAILS.TEMPLATE, { projectName, requestId }),
    },
    RUN_DETAILS: {
        TEMPLATE: '/resources/runs/:projectName/:runId',
        FORMAT: (projectName: string, runId: string) => buildRoute(CONSOLE_ROUTES.RUN_DETAILS.TEMPLATE, { projectName, runId }),
    },
    JOB_DETAILS: {
        TEMPLATE: '/resources/runs/:projectName/:runId/jobs/:jobName',
        FORMAT: (projectName: string, runId: string, jobName: string) =>
            buildRoute(CONSOLE_ROUTES.JOB_DETAILS.TEMPLATE, { projectName, runId, jobName }),
    },
    RESOURCES_FLEETS: '/resources/fleets',
    RESOURCES_FLEET_CREATE: '/resources/fleets/new',
    RESOURCES_FLEET_DETAILS: {
        TEMPLATE: '/resources/fleets/:projectName/:fleetId',
        FORMAT: (projectName: string, fleetId: string) =>
            buildRoute(CONSOLE_ROUTES.RESOURCES_FLEET_DETAILS.TEMPLATE, { projectName, fleetId }),
    },
    RESOURCES_INSTANCES: '/resources/instances',
    RESOURCES_INSTANCE_DETAILS: {
        TEMPLATE: '/resources/instances/:projectName/:instanceId',
        FORMAT: (projectName: string, instanceId: string) =>
            buildRoute(CONSOLE_ROUTES.RESOURCES_INSTANCE_DETAILS.TEMPLATE, { projectName, instanceId }),
    },
    RESOURCES_OFFERS: '/resources/offers',
    RESOURCES_MODELS: '/resources/models',
    RESOURCES_MODEL_DETAILS: {
        TEMPLATE: '/resources/models/:projectName/:runName',
        FORMAT: (projectName: string, runName: string) =>
            buildRoute(CONSOLE_ROUTES.RESOURCES_MODEL_DETAILS.TEMPLATE, { projectName, runName }),
    },
    RESOURCES_VOLUMES: '/resources/volumes',
    WORKSPACE_PROJECTS: '/workspace/projects',
    WORKSPACE_PROJECT_CREATE: '/workspace/projects/new',
    WORKSPACE_PROJECT_DETAILS: {
        TEMPLATE: '/workspace/projects/:projectName',
        FORMAT: (projectName: string) => buildRoute(CONSOLE_ROUTES.WORKSPACE_PROJECT_DETAILS.TEMPLATE, { projectName }),
    },
    WORKSPACE_BACKEND_CREATE: {
        TEMPLATE: '/workspace/projects/:projectName/backends/new',
        FORMAT: (projectName: string) => buildRoute(CONSOLE_ROUTES.WORKSPACE_BACKEND_CREATE.TEMPLATE, { projectName }),
    },
    WORKSPACE_BACKEND_DETAILS: {
        TEMPLATE: '/workspace/projects/:projectName/backends/:backendName',
        FORMAT: (projectName: string, backendName: string) =>
            buildRoute(CONSOLE_ROUTES.WORKSPACE_BACKEND_DETAILS.TEMPLATE, { projectName, backendName }),
    },
    WORKSPACE_GATEWAY_CREATE: {
        TEMPLATE: '/workspace/projects/:projectName/gateways/new',
        FORMAT: (projectName: string) => buildRoute(CONSOLE_ROUTES.WORKSPACE_GATEWAY_CREATE.TEMPLATE, { projectName }),
    },
    WORKSPACE_GATEWAY_DETAILS: {
        TEMPLATE: '/workspace/projects/:projectName/gateways/:gatewayName',
        FORMAT: (projectName: string, gatewayName: string) =>
            buildRoute(CONSOLE_ROUTES.WORKSPACE_GATEWAY_DETAILS.TEMPLATE, { projectName, gatewayName }),
    },
    ADMIN_SETTINGS: '/admin/settings',
    ADMIN_USERS: '/admin/users',
    ADMIN_USER_CREATE: '/admin/users/new',
    ADMIN_USER_DETAILS: {
        TEMPLATE: '/admin/users/:userName',
        FORMAT: (userName: string) => buildRoute(CONSOLE_ROUTES.ADMIN_USER_DETAILS.TEMPLATE, { userName }),
    },
    ADMIN_EVENTS: '/admin/events',
    ACCOUNT_PROFILE: '/account/profile',
    ACCOUNT_KEYS: '/account/keys',
    ACCOUNT_BILLING: '/account/billing',
};

export const LEGACY_CONSOLE_PATHS = [
    '/runs',
    '/offers',
    '/models',
    '/fleets',
    '/instances',
    '/volumes',
    '/projects',
    '/users',
    '/events',
    '/billing',
    '/console',
];
