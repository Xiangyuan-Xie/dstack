import confirmationReducer from 'ui/confirmation/slice';
import notificationsReducer from 'ui/notifications/slice';
import { configureStore } from '@reduxjs/toolkit';

import { adminOAuthApi } from 'services/adminOAuth';
import { artifactApi } from 'services/artifact';
import { authApi } from 'services/auth';
import { eventApi } from 'services/events';
import { fleetApi } from 'services/fleet';
import { gatewayApi } from 'services/gateway';
import { instanceApi } from 'services/instance';
import { mainApi } from 'services/mainApi';
import { projectApi } from 'services/project';
import { publicKeysApi } from 'services/publicKeys';
import { repoApi } from 'services/repo';
import { resourcePoolApi } from 'services/resourcePool';
import { runApi } from 'services/run';
import { runRequestApi } from 'services/runRequest';
import { secretApi } from 'services/secrets';
import { serverApi } from 'services/server';
import { templateApi } from 'services/templates';
import { userApi } from 'services/user';
import { volumeApi } from 'services/volume';
import { workerApi } from 'services/worker';

import appReducer from 'App/slice';

import { gpuApi } from './services/gpu';

export const store = configureStore({
    reducer: {
        app: appReducer,
        notifications: notificationsReducer,
        confirmation: confirmationReducer,
        [projectApi.reducerPath]: projectApi.reducer,
        [runApi.reducerPath]: runApi.reducer,
        [artifactApi.reducerPath]: artifactApi.reducer,
        [fleetApi.reducerPath]: fleetApi.reducer,
        [instanceApi.reducerPath]: instanceApi.reducer,
        [userApi.reducerPath]: userApi.reducer,
        [gatewayApi.reducerPath]: gatewayApi.reducer,
        [authApi.reducerPath]: authApi.reducer,
        [adminOAuthApi.reducerPath]: adminOAuthApi.reducer,
        [serverApi.reducerPath]: serverApi.reducer,
        [volumeApi.reducerPath]: volumeApi.reducer,
        [secretApi.reducerPath]: secretApi.reducer,
        [gpuApi.reducerPath]: gpuApi.reducer,
        [runRequestApi.reducerPath]: runRequestApi.reducer,
        [repoApi.reducerPath]: repoApi.reducer,
        [mainApi.reducerPath]: mainApi.reducer,
        [publicKeysApi.reducerPath]: publicKeysApi.reducer,
        [resourcePoolApi.reducerPath]: resourcePoolApi.reducer,
        [eventApi.reducerPath]: eventApi.reducer,
        [templateApi.reducerPath]: templateApi.reducer,
        [workerApi.reducerPath]: workerApi.reducer,
    },

    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: false,
        })
            .concat(projectApi.middleware)
            .concat(runApi.middleware)
            .concat(artifactApi.middleware)
            .concat(fleetApi.middleware)
            .concat(instanceApi.middleware)
            .concat(gatewayApi.middleware)
            .concat(userApi.middleware)
            .concat(authApi.middleware)
            .concat(adminOAuthApi.middleware)
            .concat(serverApi.middleware)
            .concat(volumeApi.middleware)
            .concat(secretApi.middleware)
            .concat(gpuApi.middleware)
            .concat(runRequestApi.middleware)
            .concat(publicKeysApi.middleware)
            .concat(resourcePoolApi.middleware)
            .concat(eventApi.middleware)
            .concat(repoApi.middleware)
            .concat(templateApi.middleware)
            .concat(mainApi.middleware)
            .concat(workerApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
