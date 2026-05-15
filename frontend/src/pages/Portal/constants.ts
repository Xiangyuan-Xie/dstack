import { ROUTES } from 'routes';

export const PORTAL_ROUTES = {
    DASHBOARD: '/dashboard',
    GPU_REQUESTS: '/gpu/requests',
    GPU_REQUEST_CREATE: '/gpu/requests/new',
    GPU_CONTAINERS: '/gpu/containers',
    GPU_REQUEST_DETAILS: {
        TEMPLATE: '/gpu/requests/:projectName/:requestId',
        FORMAT: (projectName: string, requestId: string) => `/gpu/requests/${projectName}/${requestId}`,
    },
    ADMIN_APPROVALS: '/admin/approvals',
    ADMIN_CONTAINERS: '/admin/containers',
    ADMIN_SERVERS: '/admin/servers',
    CONSOLE: '/console',
} as const;

export const CONSOLE_ENTRY_PATH = ROUTES.RUNS.LIST;
