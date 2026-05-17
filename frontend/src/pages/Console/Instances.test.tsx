import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { InstancesPage } from './pages';

const mockNavigate = jest.fn();
const mockPushNotification = jest.fn();
const mockCreateRegistrationToken = jest.fn();
const mockDeleteRegistrationToken = jest.fn();
let mockResourcePools: IResourcePool[] = [];
let mockLocationState: Record<string, string | boolean> | null = null;

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

jest.mock('react-router-dom', () => ({
    useNavigate: () => mockNavigate,
    useParams: () => ({}),
    useLocation: () => ({ state: mockLocationState }),
}));

jest.mock('./Layout', () => ({
    useConsoleContext: () => ({
        locale: 'zh',
        role: {
            isGlobalAdmin: true,
            canUseProjectAdmin: true,
            canUseGlobalAdmin: true,
            canManagePortal: true,
            manageableProjectNames: ['research', 'empty-project'],
        },
    }),
}));

jest.mock('hooks', () => ({
    useAppSelector: jest.fn(),
    useNotifications: () => [mockPushNotification],
    useConfirmationDialog: () => [jest.fn()],
}));

jest.mock('services/project', () => ({
    useGetProjectsQuery: () => ({
        data: {
            data: [
                {
                    project_id: 'project-1',
                    project_name: 'research',
                    members: [],
                    backends: [],
                    owner: { username: 'admin' },
                    created_at: '2026-05-16T09:00:00+08:00',
                    isPublic: false,
                },
                {
                    project_id: 'project-2',
                    project_name: 'empty-project',
                    members: [],
                    backends: [],
                    owner: { username: 'admin' },
                    created_at: '2026-05-16T09:00:00+08:00',
                    isPublic: false,
                },
            ],
        },
        isLoading: false,
    }),
}));

jest.mock('services/instance', () => ({
    useGetInstancesQuery: () => ({
        data: [
            {
                id: 'instance-1',
                name: 'gpu-server-1',
                project_name: 'research',
                fleet_name: 'gpu-cluster',
                backend: 'registered',
                status: 'idle',
                region: 'local',
            },
        ],
        isLoading: false,
    }),
}));

jest.mock('services/resourcePool', () => ({
    useCreateResourcePoolMutation: () => [jest.fn(), { isLoading: false }],
    useDeleteResourcePoolsMutation: () => [jest.fn(), { isLoading: false }],
    useGetProjectResourcePoolsQuery: () => ({ data: mockResourcePools, isLoading: false }),
    useGetResourcePoolDetailsQuery: () => ({ data: mockResourcePools[0], isLoading: false }),
    useGetResourcePoolsQuery: () => ({
        data: mockResourcePools,
        isLoading: false,
    }),
    useUpdateResourcePoolAssignmentMutation: () => [jest.fn(), { isLoading: false }],
}));

jest.mock('services/worker', () => ({
    useGetWorkerRegistrationTokensQuery: () => ({ data: [], isLoading: false }),
    useCreateWorkerRegistrationTokenMutation: () => [mockCreateRegistrationToken, { isLoading: false }],
    useDeleteWorkerRegistrationTokenMutation: () => [mockDeleteRegistrationToken, { isLoading: false }],
}));

jest.mock('services/backend', () => ({}));
jest.mock('services/events', () => ({}));
jest.mock('services/gpu', () => ({}));
jest.mock('services/runRequest', () => ({}));
jest.mock('services/publicKeys', () => ({}));
jest.mock('services/run', () => ({}));
jest.mock('services/secrets', () => ({}));
jest.mock('services/user', () => ({}));
jest.mock('services/volume', () => ({}));
jest.mock('services/adminOAuth', () => ({}));
jest.mock('libs', () => ({
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

const resourcePool = (name: string): IResourcePool => ({
    id: `${name}-id`,
    name,
    created_at: '2026-05-16T09:00:00+08:00',
    spec: {
        configuration: { type: 'fleet', name },
        profile: { name: 'registered', default: true },
    },
    status: 'active',
    status_message: '',
    assignments: [],
    instances: [],
    authorized_project_names: [],
    idle_instance_count: 0,
    busy_instance_count: 0,
});

describe('InstancesPage', () => {
    beforeEach(() => {
        mockNavigate.mockReset();
        mockPushNotification.mockReset();
        mockCreateRegistrationToken.mockReset();
        mockDeleteRegistrationToken.mockReset();
        mockLocationState = null;
        mockResourcePools = [resourcePool('gpu-cluster'), resourcePool('training-cluster')];
    });

    test('uses existing fleets when creating a server connection command', async () => {
        mockCreateRegistrationToken.mockReturnValue({
            unwrap: () =>
                Promise.resolve({
                    id: 'token-1',
                    fleet_name: 'training-cluster',
                    enabled: true,
                    created_at: '2026-05-16T09:00:00+08:00',
                    token: 'secret-token',
                }),
        });

        render(<InstancesPage />);

        expect(screen.getByText('资源池')).toBeInTheDocument();
        expect(screen.queryByText('集群')).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: '接入服务器' }));

        const fleetSelect = await screen.findByRole('combobox', { name: '资源池' });
        await waitFor(() => expect(fleetSelect).toHaveValue('gpu-cluster'));
        await userEvent.selectOptions(fleetSelect, 'training-cluster');
        await userEvent.click(screen.getByRole('button', { name: '生成接入命令' }));

        expect(mockCreateRegistrationToken).toHaveBeenCalledWith({
            fleet_name: 'training-cluster',
        });
        expect(await screen.findByText(/dstack worker --server/)).toBeInTheDocument();
    });

    test('disables command generation and links to resource pool creation when no resource pools exist', async () => {
        mockResourcePools = [];
        render(<InstancesPage />);

        await userEvent.click(screen.getByRole('button', { name: '接入服务器' }));

        expect(await screen.findByText('还没有资源池，请先创建资源池。')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '生成接入命令' })).toBeDisabled();

        await userEvent.click(screen.getByRole('button', { name: '创建资源池' }));

        expect(mockNavigate).toHaveBeenCalledWith('/resources/fleets/new');
    });

    test('opens the connection modal with the resource pool preselected from route state', async () => {
        mockLocationState = {
            fleetName: 'training-cluster',
            openConnectServer: true,
        };

        render(<InstancesPage />);

        const fleetSelect = await screen.findByRole('combobox', { name: '资源池' });
        await waitFor(() => expect(fleetSelect).toHaveValue('training-cluster'));
    });
});
