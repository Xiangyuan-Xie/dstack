import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { BackendPage, FleetCreatePage, FleetDetailsPage, FleetsPage, ProjectDetailsPage, ProjectsPage } from './pages';

const mockNavigate = jest.fn();
const mockDeleteProjects = jest.fn();
const mockDeleteResourcePools = jest.fn();
const mockUpdateProject = jest.fn();
const mockConfirm = jest.fn();
const mockAddProjectMember = jest.fn();
const mockRemoveProjectMember = jest.fn();
const mockGetUserList = jest.fn();
const mockCreateResourcePool = jest.fn();
const mockUpdateResourcePool = jest.fn();
const mockUpdateResourcePoolAssignment = jest.fn();
const mockDeleteSecrets = jest.fn();
const mockDeleteBackend = jest.fn();
let mockLocationState: Record<string, string> | null = null;
let mockParams: Record<string, string> = { projectName: 'old-project' };
let mockSecrets: Array<{ id: string; name: string }> = [];

const resourcePool = (overrides: Partial<IResourcePool> = {}): IResourcePool => ({
    id: 'fleet-1',
    name: 'gpu-fleet',
    created_at: '2026-05-16T09:00:00+08:00',
    spec: {
        configuration: { type: 'fleet', name: 'gpu-fleet' },
        profile: { name: 'registered', default: true },
    },
    status: 'active',
    status_message: '',
    assignments: [{ project_name: 'old-project', whole_pool: true, instance_ids: [] }],
    instances: [
        {
            id: 'instance-1',
            name: 'server-1',
            instance_num: 0,
            status: 'idle',
            backend: 'registered',
            authorized_projects: ['old-project'],
            occupancy: { status: 'idle', project_names: [], task_count: 0 },
            resources: {
                cpu_count: 16,
                memory_gib: 128,
                disk_gib: 500,
                gpu_count: 2,
                gpus: [{ name: 'A100', count: 2, memory_gib: 40 }],
            },
            usage: {
                cpu_percent: 42,
                memory_used_gib: 32,
                memory_total_gib: 128,
                disk_used_gib: 200,
                disk_total_gib: 500,
                gpu_memory_used_gib: 20,
                gpu_memory_total_gib: 80,
                gpu_util_percent: 75,
                updated_at: '2026-05-16T09:05:00+08:00',
            },
        },
    ],
    authorized_project_names: ['old-project', 'research', 'vision'],
    idle_instance_count: 1,
    busy_instance_count: 0,
    resource_summary: {
        instance_count: 1,
        cpu_count: 16,
        memory_gib: 128,
        disk_gib: 500,
        gpu_count: 2,
        gpus: [{ name: 'A100', count: 2, memory_gib: 40 }],
    },
    usage_summary: {
        instance_count: 1,
        reporting_instance_count: 1,
        cpu_percent: 42,
        memory_used_gib: 32,
        memory_total_gib: 128,
        disk_used_gib: 200,
        disk_total_gib: 500,
        gpu_memory_used_gib: 20,
        gpu_memory_total_gib: 80,
        gpu_util_percent: 75,
        updated_at: '2026-05-16T09:05:00+08:00',
    },
    ...overrides,
});

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
    useParams: () => mockParams,
    useLocation: () => ({ state: mockLocationState }),
}));

jest.mock('./Layout', () => ({
    useConsoleContext: () => ({
        locale: 'zh',
        projects: [
            {
                project_id: 'project-1',
                project_name: 'old-project',
                members: [],
                backends: [],
                owner: { username: 'admin' },
                created_at: '2026-05-16T09:00:00+08:00',
                isPublic: false,
                auto_approval: {
                    enabled: false,
                    max_cpu: 4,
                    max_memory_gib: 16,
                    max_duration_hours: 8,
                },
            },
        ],
        role: {
            isGlobalAdmin: true,
            canUseProjectAdmin: true,
            canUseGlobalAdmin: true,
            canManagePortal: true,
            manageableProjectNames: ['old-project'],
        },
    }),
}));

jest.mock('hooks', () => ({
    useAppSelector: jest.fn(),
    useNotifications: () => [jest.fn()],
    useConfirmationDialog: () => [mockConfirm],
}));

jest.mock('services/project', () => ({
    useGetProjectsQuery: () => ({
        data: {
            data: [
                {
                    project_id: 'project-1',
                    project_name: 'old-project',
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
    useGetProjectQuery: () => ({
        data: {
            project_id: 'project-1',
            project_name: 'old-project',
            members: [
                {
                    project_role: 'user',
                    user: { username: 'bob' },
                },
            ],
            backends: [],
            owner: { username: 'admin' },
            created_at: '2026-05-16T09:00:00+08:00',
            isPublic: false,
            auto_approval: {
                enabled: false,
                max_cpu: 4,
                max_memory_gib: 16,
                max_duration_hours: 8,
            },
        },
        isLoading: false,
    }),
    useGetProjectReposQuery: () => ({ data: [] }),
    useGetProjectBackendsQuery: () => ({ data: [], isLoading: false }),
    useGetProjectLogsQuery: () => ({ data: null }),
    useAddProjectMemberMutation: () => [mockAddProjectMember, { isLoading: false }],
    useRemoveProjectMemberMutation: () => [mockRemoveProjectMember],
    useDeleteProjectsMutation: () => [mockDeleteProjects],
    useUpdateProjectMutation: () => [mockUpdateProject, { isLoading: false }],
}));

jest.mock('services/backend', () => ({
    useGetProjectBackendsQuery: () => ({ data: [], isLoading: false }),
    useDeleteProjectBackendMutation: () => [mockDeleteBackend],
}));
jest.mock('services/events', () => ({
    useGetAllEventsQuery: () => ({ data: [], isLoading: false }),
}));
jest.mock('services/resourcePool', () => ({
    useCreateResourcePoolMutation: () => [mockCreateResourcePool, { isLoading: false }],
    useDeleteResourcePoolsMutation: () => [mockDeleteResourcePools, { isLoading: false }],
    useGetProjectResourcePoolsQuery: () => ({
        data: [resourcePool()],
        isLoading: false,
    }),
    useGetResourcePoolDetailsQuery: () => ({
        data: resourcePool(),
        isLoading: false,
    }),
    useGetResourcePoolsQuery: () => ({
        data: [resourcePool()],
        isLoading: false,
    }),
    useUpdateResourcePoolMutation: () => [mockUpdateResourcePool, { isLoading: false }],
    useUpdateResourcePoolAssignmentMutation: () => [mockUpdateResourcePoolAssignment, { isLoading: false }],
}));
jest.mock('services/runtimeImages', () => ({
    useGetRuntimeImagesQuery: () => ({ data: [], isLoading: false }),
    useUpdateRuntimeImagesMutation: () => [jest.fn(), { isLoading: false }],
}));
jest.mock('services/gpu', () => ({}));
jest.mock('services/runRequest', () => ({}));
jest.mock('services/instance', () => ({}));
jest.mock('services/publicKeys', () => ({}));
jest.mock('services/run', () => ({}));
jest.mock('services/secrets', () => ({
    useGetAllSecretsQuery: () => ({ data: mockSecrets, isLoading: false }),
    useUpdateSecretMutation: () => [jest.fn()],
    useDeleteSecretsMutation: () => [mockDeleteSecrets],
}));
jest.mock('services/user', () => ({
    useLazyGetUserListQuery: () => [
        mockGetUserList,
        {
            data: {
                data: [
                    {
                        id: 'user-1',
                        username: 'alice',
                        email: 'alice@example.com',
                        global_role: 'user',
                        active: true,
                        created_at: '2026-05-15T10:00:00+08:00',
                    },
                    {
                        id: 'user-2',
                        username: 'bob',
                        email: 'bob@example.com',
                        global_role: 'user',
                        active: true,
                        created_at: '2026-05-15T10:00:00+08:00',
                    },
                ],
            },
            isFetching: false,
        },
    ],
}));
jest.mock('services/volume', () => ({}));
jest.mock('services/adminOAuth', () => ({}));
jest.mock('libs', () => ({
    buildRoute: (route: string, params: Record<string, string>) =>
        Object.keys(params).reduce((result, key) => result.replace(`:${key}`, params[key]), route),
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

describe('ProjectsPage', () => {
    beforeEach(() => {
        mockNavigate.mockReset();
        mockParams = { projectName: 'old-project' };
        mockDeleteProjects.mockReset();
        mockDeleteResourcePools.mockReset();
        mockRemoveProjectMember.mockReset();
        mockDeleteSecrets.mockReset();
        mockDeleteBackend.mockReset();
        mockConfirm.mockReset();
    });

    test('shows an edit action in the project list', async () => {
        render(<ProjectsPage />);

        await userEvent.click(screen.getByRole('button', { name: '编辑' }));

        expect(mockNavigate).toHaveBeenCalledWith('/workspace/projects/old-project');
        expect(screen.queryByRole('button', { name: '删除' })).not.toBeInTheDocument();
    });
});

describe('FleetCreatePage', () => {
    beforeEach(() => {
        mockNavigate.mockReset();
        mockCreateResourcePool.mockReset();
        mockLocationState = null;
    });

    test('creates a registered server resource pool without exposing YAML', async () => {
        mockCreateResourcePool.mockReturnValue({
            unwrap: () =>
                Promise.resolve({
                    id: 'fleet-1',
                    name: 'lab-pool',
                }),
        });

        render(<FleetCreatePage />);

        expect(screen.getByRole('heading', { name: '创建资源池' })).toBeInTheDocument();
        expect(screen.queryByText('YAML')).not.toBeInTheDocument();
        await userEvent.type(screen.getByLabelText('资源池名称'), 'lab-pool');
        await userEvent.click(screen.getByRole('button', { name: '创建资源池' }));

        expect(mockCreateResourcePool).toHaveBeenCalledWith({
            force: true,
            plan: {
                spec: {
                    configuration: {
                        type: 'fleet',
                        name: 'lab-pool',
                        nodes: { min: 0 },
                    },
                    configuration_path: 'console.yaml',
                    profile: { name: 'registered', default: true },
                },
            },
        });
        expect(mockNavigate).toHaveBeenCalledWith('/resources/instances', {
            state: {
                fleetName: 'lab-pool',
                openConnectServer: true,
            },
        });
    });

    test('validates resource pool names before creating', async () => {
        render(<FleetCreatePage />);

        await userEvent.type(screen.getByLabelText('资源池名称'), 'Bad_Name');
        await userEvent.click(screen.getByRole('button', { name: '创建资源池' }));

        expect(screen.getByText('名称需以小写字母开头，仅可包含小写字母、数字和短横线。')).toBeInTheDocument();
        expect(screen.getByLabelText('资源池名称')).toHaveAttribute('aria-invalid', 'true');
        expect(mockCreateResourcePool).not.toHaveBeenCalled();
    });

    test('uses access method wording for registered resource pools', () => {
        render(<FleetCreatePage />);

        expect(screen.getByText(/资源池创建后，可在实例页接入服务器/)).toBeInTheDocument();
        expect(screen.queryByText(/类型：注册服务器/)).not.toBeInTheDocument();
    });
});

describe('FleetsPage', () => {
    beforeEach(() => {
        mockNavigate.mockReset();
    });

    test('shows aggregate resource pool capacity and usage without idle or busy columns', () => {
        render(<FleetsPage />);

        expect(screen.getByText('gpu-fleet')).toBeInTheDocument();
        expect(screen.queryByText('状态')).not.toBeInTheDocument();
        expect(screen.getByText('已上报实例')).toBeInTheDocument();
        expect(screen.getByText('1 / 1')).toBeInTheDocument();
        expect(screen.getByText('16 核心')).toBeInTheDocument();
        expect(screen.getByText('128GiB')).toBeInTheDocument();
        expect(screen.getByText('2 张 / 80GiB')).toBeInTheDocument();
        expect(screen.getByText('500GiB')).toBeInTheDocument();
        expect(screen.getByText('old-project')).toBeInTheDocument();
        expect(screen.getByText('research')).toBeInTheDocument();
        expect(screen.getByText('vision')).toBeInTheDocument();
        expect(screen.queryByText(/GiB 内存/)).not.toBeInTheDocument();
        expect(screen.queryByText(/GiB 显存/)).not.toBeInTheDocument();
        expect(screen.queryByText(/GiB 磁盘/)).not.toBeInTheDocument();
        expect(screen.getByText('42%')).toBeInTheDocument();
        expect(screen.getByText('32 / 128GiB')).toBeInTheDocument();
        expect(screen.getByText('20 / 80GiB')).toBeInTheDocument();
        expect(screen.getByText('200 / 500GiB')).toBeInTheDocument();
        expect(screen.queryByText(/A100 x2 40GiB/)).not.toBeInTheDocument();
        expect(screen.queryByText('闲置实例')).not.toBeInTheDocument();
        expect(screen.queryByText('占用实例')).not.toBeInTheDocument();
        expect(screen.queryByText('registered')).not.toBeInTheDocument();
    });
});

describe('FleetDetailsPage', () => {
    beforeEach(() => {
        mockNavigate.mockReset();
        mockDeleteResourcePools.mockReset();
        mockUpdateResourcePool.mockReset();
        mockConfirm.mockReset();
    });

    test('shows aggregate resource pool summary and detailed instance configuration with a back button', async () => {
        render(<FleetDetailsPage />);

        expect(screen.getByRole('heading', { name: 'gpu-fleet' })).toBeInTheDocument();
        expect(screen.getAllByText('16 核心')).not.toHaveLength(0);
        expect(screen.getAllByText('128GiB')).not.toHaveLength(0);
        expect(screen.getAllByText('2 张 / 80GiB')).not.toHaveLength(0);
        expect(screen.getAllByText('500GiB')).not.toHaveLength(0);
        expect(screen.getAllByText('当前使用')).not.toHaveLength(0);
        expect(screen.getByText(/A100 x2 \/ 40GiB/)).toBeInTheDocument();
        expect(screen.queryByText('运行占用')).not.toBeInTheDocument();
        expect(screen.getByText('项目授权')).toBeInTheDocument();
        expect(screen.getAllByText('old-project')).not.toHaveLength(0);
        expect(screen.getByText('整个资源池')).toBeInTheDocument();
        expect(screen.queryByText('registered')).not.toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', { name: '返回' }));

        expect(mockNavigate).toHaveBeenCalledWith('/resources/fleets');
    });

    test('opens editing before renaming or deleting a resource pool', async () => {
        mockUpdateResourcePool.mockReturnValue({
            unwrap: () => Promise.resolve(resourcePool({ name: 'renamed-pool' })),
        });
        mockDeleteResourcePools.mockReturnValue({
            unwrap: () => Promise.resolve(undefined),
        });

        render(<FleetDetailsPage />);

        expect(screen.queryByRole('button', { name: '删除' })).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: '编辑' }));
        await userEvent.clear(screen.getByLabelText('资源池名称'));
        await userEvent.type(screen.getByLabelText('资源池名称'), 'renamed-pool');
        await userEvent.click(screen.getByRole('button', { name: '保存' }));

        expect(mockUpdateResourcePool).toHaveBeenCalledWith({
            resource_pool_name: 'gpu-fleet',
            new_resource_pool_name: 'renamed-pool',
        });

        await userEvent.click(screen.getByRole('button', { name: '删除资源池' }));

        expect(mockDeleteResourcePools).not.toHaveBeenCalled();
        expect(mockConfirm).toHaveBeenCalledWith(
            expect.objectContaining({
                title: '删除资源池',
                confirmButtonLabel: '删除',
            }),
        );

        const onConfirm = mockConfirm.mock.calls[0][0].onConfirm;
        await onConfirm();

        expect(mockDeleteResourcePools).toHaveBeenCalledWith({ names: ['gpu-fleet'] });
        expect(mockNavigate).toHaveBeenCalledWith('/resources/fleets');
    });
});

describe('ProjectDetailsPage', () => {
    beforeEach(() => {
        mockNavigate.mockReset();
        mockUpdateProject.mockReset();
        mockDeleteProjects.mockReset();
        mockAddProjectMember.mockReset();
        mockRemoveProjectMember.mockReset();
        mockGetUserList.mockReset();
        mockConfirm.mockReset();
        mockUpdateResourcePoolAssignment.mockReset();
        mockDeleteSecrets.mockReset();
        mockParams = { projectName: 'old-project' };
        mockSecrets = [];
        mockLocationState = null;
    });

    test('saves renamed project settings and navigates to the new URL', async () => {
        mockUpdateProject.mockReturnValue({
            unwrap: () => Promise.resolve({ project_name: 'new-project' }),
        });

        render(<ProjectDetailsPage />);
        const nameInput = screen.getByDisplayValue('old-project');
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'new-project');
        await userEvent.click(screen.getAllByRole('button', { name: '保存' })[0]);

        expect(mockUpdateProject).toHaveBeenCalledWith({
            project_name: 'old-project',
            new_project_name: 'new-project',
            is_public: false,
            auto_approval: {
                enabled: false,
                max_cpu: 4,
                max_memory_gib: 16,
                max_duration_hours: 8,
            },
        });
        expect(mockNavigate).toHaveBeenCalledWith('/workspace/projects/new-project');
    });

    test('does not show or submit templates repo settings', async () => {
        mockUpdateProject.mockReturnValue({
            unwrap: () => Promise.resolve({ project_name: 'old-project' }),
        });

        render(<ProjectDetailsPage />);

        expect(screen.queryByText('模板仓库')).not.toBeInTheDocument();
        expect(screen.queryByPlaceholderText('https://github.com/org/templates.git')).not.toBeInTheDocument();

        await userEvent.click(screen.getAllByRole('button', { name: '保存' })[0]);

        expect(mockUpdateProject).toHaveBeenCalledWith({
            project_name: 'old-project',
            new_project_name: 'old-project',
            is_public: false,
            auto_approval: {
                enabled: false,
                max_cpu: 4,
                max_memory_gib: 16,
                max_duration_hours: 8,
            },
        });
    });

    test('saves CPU-only auto approval limits with project settings', async () => {
        mockUpdateProject.mockReturnValue({
            unwrap: () => Promise.resolve({ project_name: 'old-project' }),
        });

        render(<ProjectDetailsPage />);
        await userEvent.click(screen.getByLabelText('启用'));
        await userEvent.clear(screen.getByLabelText('CPU 上限'));
        await userEvent.type(screen.getByLabelText('CPU 上限'), '8');
        await userEvent.clear(screen.getByLabelText('内存上限 GiB'));
        await userEvent.type(screen.getByLabelText('内存上限 GiB'), '32');
        await userEvent.clear(screen.getByLabelText('运行时间上限 小时'));
        await userEvent.type(screen.getByLabelText('运行时间上限 小时'), '4');
        await userEvent.click(screen.getAllByRole('button', { name: '保存' })[0]);

        expect(mockUpdateProject).toHaveBeenCalledWith({
            project_name: 'old-project',
            new_project_name: 'old-project',
            is_public: false,
            auto_approval: {
                enabled: true,
                max_cpu: 8,
                max_memory_gib: 32,
                max_duration_hours: 4,
            },
        });
    });

    test('searches users and adds the selected non-member to the project', async () => {
        mockAddProjectMember.mockReturnValue({
            unwrap: () => Promise.resolve({ project_name: 'old-project' }),
        });

        render(<ProjectDetailsPage />);

        await userEvent.type(screen.getByPlaceholderText('搜索用户'), 'ali');

        expect(mockGetUserList).toHaveBeenCalledWith({ name_pattern: 'ali' });
        expect(screen.getByText('alice')).toBeInTheDocument();
        expect(screen.getByText('alice@example.com')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /bob/ })).not.toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', { name: /alice/ }));
        await userEvent.click(screen.getByRole('button', { name: '添加成员' }));

        expect(mockAddProjectMember).toHaveBeenCalledWith({ project_name: 'old-project', username: 'alice' });
        expect(screen.getByPlaceholderText('搜索用户')).toHaveValue('');
    });

    test('deletes the project from the details page after confirmation', async () => {
        mockDeleteProjects.mockReturnValue({
            unwrap: () => Promise.resolve(undefined),
        });

        render(<ProjectDetailsPage />);
        await userEvent.click(screen.getByRole('button', { name: '删除项目' }));

        expect(mockConfirm).toHaveBeenCalledWith(
            expect.objectContaining({
                title: '删除项目',
                confirmButtonLabel: '删除',
            }),
        );

        const onConfirm = mockConfirm.mock.calls[0][0].onConfirm;
        await onConfirm();

        expect(mockDeleteProjects).toHaveBeenCalledWith(['old-project']);
        expect(mockNavigate).toHaveBeenCalledWith('/workspace/projects');
    });

    test('confirms before removing a project member', async () => {
        mockRemoveProjectMember.mockReturnValue({
            unwrap: () => Promise.resolve(undefined),
        });

        render(<ProjectDetailsPage />);
        await userEvent.click(screen.getByRole('button', { name: '移除' }));

        expect(mockRemoveProjectMember).not.toHaveBeenCalled();
        expect(mockConfirm).toHaveBeenCalledWith(
            expect.objectContaining({
                title: '移除成员',
                confirmButtonLabel: '移除',
            }),
        );

        const onConfirm = mockConfirm.mock.calls[0][0].onConfirm;
        await onConfirm();

        expect(mockRemoveProjectMember).toHaveBeenCalledWith({ project_name: 'old-project', username: 'bob' });
    });

    test('confirms before deleting a secret', async () => {
        mockSecrets = [{ id: 'secret-1', name: 'HF_TOKEN' }];
        mockDeleteSecrets.mockReturnValue({
            unwrap: () => Promise.resolve(undefined),
        });

        render(<ProjectDetailsPage />);
        const secretRow = screen.getByText('HF_TOKEN').closest('tr')!;
        await userEvent.click(within(secretRow).getByRole('button', { name: '删除' }));

        expect(mockDeleteSecrets).not.toHaveBeenCalled();
        expect(mockConfirm).toHaveBeenCalledWith(
            expect.objectContaining({
                title: '删除密钥',
                confirmButtonLabel: '删除',
            }),
        );

        const onConfirm = mockConfirm.mock.calls[0][0].onConfirm;
        await onConfirm();

        expect(mockDeleteSecrets).toHaveBeenCalledWith({ project_name: 'old-project', names: ['HF_TOKEN'] });
    });

    test('shows project resource assignments and updates the authorized resource pool', async () => {
        mockUpdateResourcePoolAssignment.mockReturnValue({
            unwrap: () => Promise.resolve(resourcePool()),
        });

        render(<ProjectDetailsPage />);

        expect(screen.getByText('资源授权')).toBeInTheDocument();
        expect(screen.getAllByText('gpu-fleet')).not.toHaveLength(0);
        expect(screen.queryByText(/A100 x2 \/ 40GiB/)).not.toBeInTheDocument();
        expect(screen.getAllByText(/2 张 \/ 80GiB/)).not.toHaveLength(0);
        expect(screen.queryByText(/"configuration"/)).not.toBeInTheDocument();
        expect(screen.getAllByText('整个资源池')).not.toHaveLength(0);
        expect(screen.getAllByText('1')).not.toHaveLength(0);

        await userEvent.click(screen.getByRole('button', { name: '保存授权' }));

        expect(mockUpdateResourcePoolAssignment).toHaveBeenCalledWith({
            resource_pool_name: 'gpu-fleet',
            project_name: 'old-project',
            assign_whole_pool: true,
            instance_ids: [],
        });
    });

    test('shows current usage separately from resource capacity for assigned resource pools', () => {
        render(<ProjectDetailsPage />);

        expect(screen.getByText('当前使用')).toBeInTheDocument();
        expect(screen.queryByText(/A100 x2 \/ 40GiB/)).not.toBeInTheDocument();
        expect(screen.getByText('42%')).toBeInTheDocument();
        expect(screen.getByText('32 / 128GiB')).toBeInTheDocument();
        expect(screen.getByText('200 / 500GiB')).toBeInTheDocument();
        expect(screen.getByText('75%')).toBeInTheDocument();
    });
});

describe('BackendPage', () => {
    beforeEach(() => {
        mockConfirm.mockReset();
        mockDeleteBackend.mockReset();
        mockParams = { projectName: 'old-project', backendName: 'local-backend' };
    });

    test('confirms before deleting a backend', async () => {
        mockDeleteBackend.mockReturnValue({
            unwrap: () => Promise.resolve(undefined),
        });

        render(<BackendPage />);
        await userEvent.click(screen.getByRole('button', { name: '删除' }));

        expect(mockDeleteBackend).not.toHaveBeenCalled();
        expect(mockConfirm).toHaveBeenCalledWith(
            expect.objectContaining({
                title: '删除后端配置',
                confirmButtonLabel: '删除',
            }),
        );

        const onConfirm = mockConfirm.mock.calls[0][0].onConfirm;
        await onConfirm();

        expect(mockDeleteBackend).toHaveBeenCalledWith({
            projectName: 'old-project',
            backends_names: ['local-backend'],
        });
    });
});
