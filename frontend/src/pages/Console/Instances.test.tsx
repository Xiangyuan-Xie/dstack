import React from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CONSOLE_ROUTES } from './constants';
import { InstanceDetailsPage, InstancesPage, NotFoundPage } from './pages';

const mockNavigate = jest.fn();
const mockPushNotification = jest.fn();
const mockCreateRegistrationToken = jest.fn();
const mockDeleteRegistrationToken = jest.fn();
const mockAddResourcePoolSshHost = jest.fn();
const mockConfirm = jest.fn();
const mockGetResourcePoolsQuery = jest.fn();
const mockGetInstancesQuery = jest.fn();
let mockWorkerTokens: IWorkerRegistrationToken[] = [];
let mockResourcePools: IResourcePool[] = [];
let mockParams: Record<string, string> = {};
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

jest.mock('react-router-dom', () => {
    const actual = jest.requireActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
        useParams: () => mockParams,
        useLocation: () => ({ state: mockLocationState }),
    };
});

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
    useConfirmationDialog: () => [mockConfirm],
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
    useGetInstancesQuery: (...args: unknown[]) => mockGetInstancesQuery(...args),
}));

jest.mock('services/resourcePool', () => ({
    useAddResourcePoolSshHostMutation: () => [mockAddResourcePoolSshHost, { isLoading: false }],
    useCreateResourcePoolMutation: () => [jest.fn(), { isLoading: false }],
    useDeleteResourcePoolsMutation: () => [jest.fn(), { isLoading: false }],
    useGetProjectResourcePoolsQuery: () => ({ data: mockResourcePools, isLoading: false }),
    useGetResourcePoolDetailsQuery: () => ({ data: mockResourcePools[0], isLoading: false }),
    useGetResourcePoolsQuery: (...args: unknown[]) => mockGetResourcePoolsQuery(...args),
    useUpdateResourcePoolAssignmentMutation: () => [jest.fn(), { isLoading: false }],
    useUpdateResourcePoolMutation: () => [jest.fn(), { isLoading: false }],
}));

jest.mock('services/runtimeImages', () => ({
    useGetRuntimeImagesQuery: () => ({ data: [], isLoading: false }),
    useUpdateRuntimeImagesMutation: () => [jest.fn(), { isLoading: false }],
}));

jest.mock('services/worker', () => ({
    useGetWorkerRegistrationTokensQuery: () => ({ data: mockWorkerTokens, isLoading: false }),
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
    resource_summary: {
        instance_count: 0,
        cpu_count: 0,
        memory_gib: 0,
        disk_gib: 0,
        gpu_count: 0,
        gpus: [],
    },
});

describe('InstancesPage', () => {
    beforeEach(() => {
        mockNavigate.mockReset();
        mockPushNotification.mockReset();
        mockCreateRegistrationToken.mockReset();
        mockDeleteRegistrationToken.mockReset();
        mockAddResourcePoolSshHost.mockReset();
        mockConfirm.mockReset();
        mockGetResourcePoolsQuery.mockReset();
        mockGetInstancesQuery.mockReset();
        mockWorkerTokens = [];
        mockParams = {};
        mockLocationState = null;
        const pool = resourcePool('gpu-cluster');
        pool.instances = [
            {
                id: 'instance-1',
                name: 'gpu-server-1',
                instance_num: 0,
                status: 'idle',
                backend: 'registered',
                authorized_projects: ['research'],
                occupancy: { status: 'idle', project_names: [], task_count: 0 },
                resources: {
                    cpu_count: 16,
                    memory_gib: 64,
                    disk_gib: 500,
                    gpu_count: 1,
                    gpus: [{ name: 'RTX4090D', count: 1, memory_gib: 23.99 }],
                },
                usage: {
                    cpu_percent: 42,
                    memory_used_gib: 20,
                    memory_total_gib: 64,
                    disk_used_gib: 125,
                    disk_total_gib: 500,
                    gpu_memory_used_gib: 12,
                    gpu_memory_total_gib: 40,
                    gpu_util_percent: 76,
                    updated_at: '2026-05-16T09:05:07+08:00',
                },
            },
        ];
        mockResourcePools = [pool, resourcePool('training-cluster')];
        mockGetResourcePoolsQuery.mockImplementation(() => ({
            data: mockResourcePools,
            isLoading: false,
        }));
        mockGetInstancesQuery.mockImplementation(() => ({
            data: [],
            isLoading: false,
        }));
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
        await userEvent.click(screen.getAllByRole('button', { name: '接入服务器' }).at(-1)!);

        const fleetSelect = await screen.findByRole('combobox', { name: '资源池' });
        await waitFor(() => expect(fleetSelect).toHaveValue('gpu-cluster'));
        await userEvent.selectOptions(fleetSelect, 'training-cluster');
        await userEvent.click(screen.getByRole('button', { name: '生成命令' }));

        expect(mockCreateRegistrationToken).toHaveBeenCalledWith({
            fleet_name: 'training-cluster',
        });
        expect(await screen.findByText(/dstack worker --server/)).toBeInTheDocument();
    });

    test('adds a server through SSH direct access', async () => {
        mockAddResourcePoolSshHost.mockReturnValue({
            unwrap: () => Promise.resolve(mockResourcePools[0]),
        });

        render(<InstancesPage />);

        await userEvent.click(screen.getAllByRole('button', { name: '接入服务器' }).at(-1)!);
        await userEvent.click(screen.getByRole('button', { name: 'SSH 直连' }));
        await userEvent.type(screen.getByLabelText('主机地址'), '10.0.0.10');
        await userEvent.clear(screen.getByLabelText('SSH 用户'));
        await userEvent.type(screen.getByLabelText('SSH 用户'), 'ubuntu');
        await userEvent.clear(screen.getByLabelText('端口'));
        await userEvent.type(screen.getByLabelText('端口'), '2222');
        await userEvent.type(screen.getByLabelText('SSH 私钥'), '-----BEGIN OPENSSH PRIVATE KEY-----\\nkey\\n-----END OPENSSH PRIVATE KEY-----');
        await userEvent.click(screen.getByRole('button', { name: '添加服务器' }));

        expect(mockAddResourcePoolSshHost).toHaveBeenCalledWith({
            resource_pool_name: 'gpu-cluster',
            hostname: '10.0.0.10',
            user: 'ubuntu',
            port: 2222,
            private_key: '-----BEGIN OPENSSH PRIVATE KEY-----\\nkey\\n-----END OPENSSH PRIVATE KEY-----',
            internal_ip: null,
        });
    });

    test('shows clear required field feedback before adding an SSH server', async () => {
        render(<InstancesPage />);

        await userEvent.click(screen.getAllByRole('button', { name: '接入服务器' }).at(-1)!);
        await userEvent.click(screen.getByRole('button', { name: 'SSH 直连' }));
        await userEvent.clear(screen.getByLabelText('主机地址'));
        await userEvent.clear(screen.getByLabelText('SSH 私钥'));
        await userEvent.click(screen.getByRole('button', { name: '添加服务器' }));

        expect(mockAddResourcePoolSshHost).not.toHaveBeenCalled();
        expect(screen.getByText('请补全必填信息')).toBeInTheDocument();
        expect(screen.getByText('请输入主机地址')).toBeInTheDocument();
        expect(screen.getByText('请粘贴 SSH 私钥')).toBeInTheDocument();
        expect(screen.getByLabelText('主机地址')).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByLabelText('SSH 私钥')).toHaveAttribute('aria-invalid', 'true');
    });

    test('refreshes resource pools while the instances page is open', () => {
        render(<InstancesPage />);

        expect(mockGetResourcePoolsQuery).toHaveBeenCalledWith(
            { only_active: false, limit: 500 },
            { pollingInterval: 5000, refetchOnMountOrArgChange: true },
        );
    });

    test('does not depend on the legacy project-scoped instances API', () => {
        render(<InstancesPage />);

        expect(mockGetInstancesQuery).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: 'gpu-server-1' })).toBeInTheDocument();
    });

    test('renders registration token status without falling back to the router error page', () => {
        mockWorkerTokens = [
            {
                id: 'token-1',
                fleet_name: 'gpu-cluster',
                enabled: true,
                created_at: '2026-05-16T09:00:00+08:00',
            },
        ];
        mockLocationState = {
            fleetName: 'gpu-cluster',
            openConnectServer: true,
        };

        render(<InstancesPage />);

        expect(screen.getByText('注册 Token')).toBeInTheDocument();
        expect(screen.getByText(/用于服务器接入认证/)).toBeInTheDocument();
        expect(screen.getByText('可用')).toBeInTheDocument();
        expect(screen.queryByText('Page not found')).not.toBeInTheDocument();
    });

    test('opens instance details without a project segment', async () => {
        render(<InstancesPage />);

        await userEvent.click(screen.getByRole('button', { name: 'gpu-server-1' }));

        expect(mockNavigate).toHaveBeenCalledWith('/resources/instances/instance-1');
    });

    test('shows access method wording and current usage in the instance list', () => {
        render(<InstancesPage />);

        expect(screen.getByText('接入方式')).toBeInTheDocument();
        expect(screen.getByText('最近上报')).toBeInTheDocument();
        expect(screen.getByText('2026-05-16 09:05:07')).toBeInTheDocument();
        expect(screen.queryByText('运行占用')).not.toBeInTheDocument();
        expect(screen.queryByText('状态')).not.toBeInTheDocument();
        expect(screen.queryByText('区域')).not.toBeInTheDocument();
        expect(screen.queryByText('类型')).not.toBeInTheDocument();
        expect(screen.getByText('自有服务器')).toBeInTheDocument();
        expect(screen.queryByText('registered')).not.toBeInTheDocument();
        expect(screen.queryByText('注册服务器')).not.toBeInTheDocument();
        expect(screen.getAllByText('CPU')).not.toHaveLength(0);
        expect(screen.getByText('42%')).toBeInTheDocument();
        expect(screen.getAllByText('内存')).not.toHaveLength(0);
        expect(screen.getByText('20 / 64GiB')).toBeInTheDocument();
        expect(screen.getByText('GPU 利用率')).toBeInTheDocument();
        expect(screen.getByText('76%')).toBeInTheDocument();
    });

    test('shows detailed instance configuration without raw backend codes', () => {
        mockParams = { instanceId: 'instance-1' };
        render(<InstanceDetailsPage />);

        expect(screen.getByText('实例信息')).toBeInTheDocument();
        expect(screen.getByText('16 核心')).toBeInTheDocument();
        expect(screen.getByText('64GiB')).toBeInTheDocument();
        expect(screen.getByText('RTX4090D x1 / 23.99GiB')).toBeInTheDocument();
        expect(screen.getByText('500GiB')).toBeInTheDocument();
        expect(screen.queryByText('运行占用')).not.toBeInTheDocument();
        expect(screen.queryByText('registered')).not.toBeInTheDocument();
    });

    test('confirms before disabling a registration token', async () => {
        mockWorkerTokens = [
            {
                id: 'token-1',
                fleet_name: 'gpu-cluster',
                enabled: true,
                created_at: '2026-05-16T09:00:00+08:00',
            },
        ];
        mockDeleteRegistrationToken.mockReturnValue({
            unwrap: () => Promise.resolve(undefined),
        });

        render(<InstancesPage />);
        await userEvent.click(screen.getByRole('button', { name: '停用' }));

        expect(mockDeleteRegistrationToken).not.toHaveBeenCalled();
        expect(mockConfirm).toHaveBeenCalledWith(
            expect.objectContaining({
                title: '停用注册 Token',
                confirmButtonLabel: '停用',
            }),
        );

        const onConfirm = mockConfirm.mock.calls[0][0].onConfirm;
        await onConfirm();

        expect(mockDeleteRegistrationToken).toHaveBeenCalledWith({ id: 'token-1' });
    });

    test('renders instance details for the legacy project-scoped path', () => {
        mockParams = { projectName: '-', instanceId: 'instance-1' };
        const router = createMemoryRouter(
            [
                {
                    path: CONSOLE_ROUTES.RESOURCES_INSTANCE_DETAILS.LEGACY_TEMPLATE,
                    element: <InstanceDetailsPage />,
                },
                { path: '*', element: <NotFoundPage /> },
            ],
            { initialEntries: ['/resources/instances/-/instance-1'] },
        );

        render(<RouterProvider router={router} />);

        expect(screen.getByText('实例信息')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'gpu-server-1' })).toBeInTheDocument();
        expect(screen.getByText('当前使用')).toBeInTheDocument();
        expect(screen.getByText('GPU 显存')).toBeInTheDocument();
        expect(screen.getByText('12 / 40GiB')).toBeInTheDocument();
        expect(screen.queryByText('404')).not.toBeInTheDocument();
    });

    test('shows a localized empty state when instance usage is absent', () => {
        mockParams = { instanceId: 'instance-1' };
        mockResourcePools[0].instances[0].usage = null;
        render(<InstanceDetailsPage />);

        expect(screen.getByText('暂无使用数据')).toBeInTheDocument();
        expect(screen.queryByText('No data')).not.toBeInTheDocument();
    });

    test('disables command generation and links to resource pool creation when no resource pools exist', async () => {
        mockResourcePools = [];
        render(<InstancesPage />);

        await userEvent.click(screen.getByRole('button', { name: '接入服务器' }));

        expect(await screen.findByText('暂无资源池')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '生成命令' })).toBeDisabled();

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
