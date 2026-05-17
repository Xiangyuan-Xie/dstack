import { close, open } from 'ui/confirmation/slice';

import { getUid } from '../libs';
import useAppDispatch from './useAppDispatch';

import { IProps as ConfirmationDialogProps } from 'ui/confirmation/types';

type ConfirmationDialogInput = {
    title?: ConfirmationDialogProps['title'];
    content?: ConfirmationDialogProps['content'];
    visible?: ConfirmationDialogProps['visible'];
    onConfirm: () => void | Promise<void>;
    cancelButtonLabel?: ConfirmationDialogProps['cancelButtonLabel'];
    confirmButtonLabel?: ConfirmationDialogProps['confirmButtonLabel'];
};

export const useConfirmationDialog = () => {
    const dispatch = useAppDispatch();

    const onDiscard = (uuid: string) => {
        dispatch(close(uuid));
    };

    const openConfirmationDialog = (props: ConfirmationDialogInput) => {
        const uuid = getUid();

        dispatch(
            open({
                uuid,
                ...props,
                onConfirm: async () => {
                    await props.onConfirm();
                    onDiscard(uuid);
                },
                onDiscard: () => onDiscard(uuid),
            }),
        );
    };

    return [openConfirmationDialog];
};
