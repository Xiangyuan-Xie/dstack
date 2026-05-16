import { useEffect, useRef } from 'react';
import { push, remove } from 'ui/notifications/slice';

import { getUid } from 'libs';

import useAppDispatch from './useAppDispatch';

import { Notification } from 'ui/notifications/types';

const NOTIFICATION_LIFE_TIME = 6000;

type TUseNotificationsArgs = { temporary?: boolean; liveTime?: number } | undefined;

const defaultArgs = { temporary: true, liveTime: NOTIFICATION_LIFE_TIME };

type TNotificationInput = {
    type?: Notification['type'];
    header?: Notification['header'];
    content?: Notification['content'];
};

export const useNotifications = (args: TUseNotificationsArgs = defaultArgs) => {
    const dispatch = useAppDispatch();
    const notificationIdsSet = useRef(new Set<string>());

    const { temporary, liveTime } = {
        ...defaultArgs,
        ...args,
    };

    const removeNotification = (id: string) => {
        dispatch(remove(id));

        if (notificationIdsSet.current.has(id)) {
            notificationIdsSet.current.delete(id);
        }
    };

    const pushNotification = (notification: TNotificationInput) => {
        const id = getUid();

        dispatch(
            push({
                id,
                ...notification,
                dismissible: true,
                onDismiss: () => {
                    removeNotification(id);
                },
            }),
        );

        if (temporary) {
            setTimeout(() => {
                removeNotification(id);
            }, liveTime);
        } else {
            notificationIdsSet.current.add(id);
        }
    };

    useEffect(() => {
        return () => {
            notificationIdsSet.current.forEach((notificationId) => {
                removeNotification(notificationId);
            });
        };
    }, []);

    return [pushNotification];
};
