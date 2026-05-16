import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import { useAppDispatch, useAppSelector } from 'hooks';
import { ROUTES } from 'routes';
import { useGetUserDataQuery } from 'services/user';

import { AuthErrorPage, LoginPage } from 'pages/Console/Auth';

import { selectAuthToken, setUserData } from './slice';

const localStorageIsAvailable = 'localStorage' in window;

const IGNORED_AUTH_PATHS = [
    ROUTES.AUTH.GITHUB_CALLBACK,
    ROUTES.AUTH.OKTA_CALLBACK,
    ROUTES.AUTH.ENTRA_CALLBACK,
    ROUTES.AUTH.GOOGLE_CALLBACK,
    ROUTES.AUTH.TOKEN,
    ROUTES.LOGOUT,
];

const App: React.FC = () => {
    const token = useAppSelector(selectAuthToken);
    const isAuthenticated = Boolean(token);
    const dispatch = useAppDispatch();
    const { pathname } = useLocation();
    const { data: userData, error: getUserError } = useGetUserDataQuery(
        { token },
        {
            skip: !isAuthenticated || !localStorageIsAvailable,
        },
    );

    useEffect(() => {
        if (userData?.username) {
            dispatch(setUserData(userData));
        }
    }, [dispatch, userData]);

    if (IGNORED_AUTH_PATHS.includes(pathname)) {
        return <Outlet />;
    }

    if (!localStorageIsAvailable) {
        return <AuthErrorPage title="Local Storage is unavailable" text="Your browser does not support local storage." />;
    }

    if (getUserError || !isAuthenticated) {
        return <LoginPage />;
    }

    return <Outlet />;
};

export default App;
