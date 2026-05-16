import { MouseEventHandler, ReactNode } from 'react';

export interface IProps {
    title?: string;
    content?: ReactNode;
    visible?: boolean;
    onDiscard: MouseEventHandler<HTMLButtonElement>;
    onConfirm: MouseEventHandler<HTMLButtonElement>;
    cancelButtonLabel?: string;
    confirmButtonLabel?: string;
}
