type TStatusIconType = 'error' | 'success' | 'stopped' | 'in-progress' | 'pending' | 'info';

export const getStatusIconType = (status: IVolume['status']): TStatusIconType | undefined => {
    switch (status) {
        case 'failed':
            return 'error';
        case 'active':
            return 'success';
        case 'provisioning':
            return 'in-progress';
        case 'submitted':
        default:
            console.error(new Error('Undefined volume status'));
    }
};
