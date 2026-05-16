import { ReactNode } from 'react';

export type Notification = {
    id?: string;
    type?: 'success' | 'error' | 'info' | 'warning';
    header?: ReactNode;
    content?: ReactNode;
    dismissible?: boolean;
    onDismiss?: () => void;
};
