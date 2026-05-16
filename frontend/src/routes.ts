import { CONSOLE_ROUTES } from 'pages/Console/constants';

export const ROUTES = {
    BASE: '/',
    LOGOUT: '/logout',
    AUTH: {
        GITHUB_CALLBACK: '/auth/github/callback',
        OKTA_CALLBACK: '/auth/okta/callback',
        ENTRA_CALLBACK: '/auth/entra/callback',
        GOOGLE_CALLBACK: '/auth/google/callback',
        TOKEN: '/auth/token',
    },
    CONSOLE: CONSOLE_ROUTES,
};
