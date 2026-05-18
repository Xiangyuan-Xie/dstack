import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { VolumesPage } from './pages';

const mockConfirm = jest.fn();
const mockDeleteVolumes = jest.fn();

Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
    })),
});

jest.mock('./Layout', () => ({
    useConsoleContext: () => ({
        locale: 'zh',
        role: {
            isGlobalAdmin: true,
            canUseProjectAdmin: true,
            canUseGlobalAdmin: true,
            canManagePortal: true,
            manageableProjectNames: ['research'],
        },
    }),
}));

jest.mock('hooks', () => ({
    useAppSelector: jest.fn(),
    useNotifications: () => [jest.fn()],
    useConfirmationDialog: () => [mockConfirm],
}));

jest.mock('react-router-dom', () => ({
    useNavigate: () => jest.fn(),
    useParams: () => ({}),
}));

jest.mock('services/volume', () => ({
    useGetAllVolumesQuery: () => ({
        data: [
            {
                id: 'volume-1',
                name: 'dataset-cache',
                project_name: 'research',
                status: 'active',
                configuration: { backend: 'local', size: 100 },
                provisioning_data: { size_gb: 100 },
            },
        ],
        isLoading: false,
    }),
    useDeleteVolumesMutation: () => [mockDeleteVolumes, { isLoading: false }],
}));

jest.mock('services/adminOAuth', () => ({}));
jest.mock('services/backend', () => ({}));
jest.mock('services/events', () => ({}));
jest.mock('services/gpu', () => ({}));
jest.mock('services/instance', () => ({}));
jest.mock('services/project', () => ({}));
jest.mock('services/publicKeys', () => ({}));
jest.mock('services/resourcePool', () => ({}));
jest.mock('services/run', () => ({}));
jest.mock('services/runRequest', () => ({}));
jest.mock('services/secrets', () => ({}));
jest.mock('services/user', () => ({}));
jest.mock('services/worker', () => ({}));
jest.mock('libs', () => ({
    buildRoute: (template: string, params: Record<string, string>) =>
        Object.entries(params).reduce((route, [key, value]) => route.replace(`:${key}`, value), template),
    centsToFormattedString: jest.fn(),
    copyToClipboard: jest.fn(),
}));
jest.mock('libs/fleet', () => ({
    formatFleetBackend: jest.fn(),
    getFleetPrice: jest.fn(),
}));
jest.mock('libs/resources', () => ({
    formatResources: jest.fn(() => '-'),
}));
jest.mock('libs/runStatus', () => ({
    runStatusForDeleting: [],
    runStatusForStopping: [],
}));

describe('VolumesPage', () => {
    beforeEach(() => {
        mockConfirm.mockReset();
        mockDeleteVolumes.mockReset();
    });

    test('confirms before deleting a volume', async () => {
        mockDeleteVolumes.mockReturnValue({
            unwrap: () => Promise.resolve(undefined),
        });

        render(<VolumesPage />);
        await userEvent.click(screen.getByRole('button', { name: '删除' }));

        expect(mockDeleteVolumes).not.toHaveBeenCalled();
        expect(mockConfirm).toHaveBeenCalledWith(
            expect.objectContaining({
                title: '删除存储卷',
                confirmButtonLabel: '删除',
            }),
        );

        const onConfirm = mockConfirm.mock.calls[0][0].onConfirm;
        await onConfirm();

        expect(mockDeleteVolumes).toHaveBeenCalledWith({
            project_name: 'research',
            names: ['dataset-cache'],
        });
    });
});
