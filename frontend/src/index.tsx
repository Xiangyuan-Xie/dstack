import React from 'react';
import { Provider as BusProvider } from 'react-bus';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { RouterProvider } from 'react-router-dom';

import { router } from './router';
import { store } from './store';

import 'ace-builds/css/ace.css';
import 'ace-builds/css/theme/cloud_editor.css';
import 'ace-builds/css/theme/cloud_editor_dark.css';
import 'assets/css/index.css';

import 'locale';

const container = document.getElementById('root');

if (container) {
    const root = createRoot(container);

    root.render(
        <React.StrictMode>
            <Provider store={store}>
                <BusProvider>
                    <RouterProvider router={router} />
                </BusProvider>
            </Provider>
        </React.StrictMode>,
    );
}
