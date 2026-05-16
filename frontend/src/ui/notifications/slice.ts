import type { RootState } from 'store';
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { Notification } from './types';

interface NotificationsState {
    items: Notification[];
    unreadCount: number;
}

const initialState: NotificationsState = {
    items: [],
    unreadCount: 0,
};

export const notificationsSlice = createSlice({
    name: 'notifications',
    initialState,
    reducers: {
        push: (state, action: PayloadAction<Notification>) => {
            state.items = [...state.items, action.payload];
            state.unreadCount += 1;
        },
        remove: (state, action: PayloadAction<Notification['id']>) => {
            state.items = state.items.filter((item) => item.id !== action.payload);
        },
        markAllRead: (state) => {
            state.unreadCount = 0;
        },
    },
});

export const { markAllRead, remove, push } = notificationsSlice.actions;
export const selectNotifications = (state: RootState) => state.notifications.items;
export const selectNotificationUnreadCount = (state: RootState) => state.notifications.unreadCount;
export default notificationsSlice.reducer;
