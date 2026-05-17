import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { FleetCreatePage, ProjectDetailsPage, ProjectsPage } from './pages';

const mockNavigate = jest.fn();
const mockDeleteProjects = jest.fn();
const mockUpdateProject = jest.fn();
const mockConfirm = jest.fn();
const mockAddProjectMember = jest.fn();
const mockGetUserList = jest.fn();
const mockCreateResourcePool = jest.fn();
const mockUpdateResourcePoolAssignment = jest.fn();
let mockLocationState: Record<string, string> | null = null;

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
        },
    ],
    authorized_project_names: ['old-project'],
    idle_instance_count: 1,
    busy_instance_count: 0,
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
    useParams: () => ({ projectName: 'old-project' }),
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
        },
        isLoading: false,
    }),
    useGetProjectReposQuery: () => ({ data: [] }),
    useGetProjectBackendsQuery: () => ({ data: [], isLoading: false }),
    useGetProjectLogsQuery: () => ({ data: null }),
    useAddProjectMemberMutation: () => [mockAddProjectMember, { isLoading: false }],
    useRemoveProjectMemberMutation: () => [jest.fn()],
    useDeleteProjectsMutation: () => [mockDeleteProjects],
    useUpdateProjectMutation: () => [mockUpdateProject, { isLoading: false }],
}));

jest.mock('services/backend', () => ({
    useGetProjectBackendsQuery: () => ({ data: [], isLoading: false }),
}));
jest.mock('services/events', () => ({
    useGetAllEventsQuery: () => ({ data: [], isLoading: false }),
}));
jest.mock('services/resourcePool', () => ({
    useCreateResourcePoolMutation: () => [mockCreateResourcePool, { isLoading: false }],
    useDeleteResourcePoolsMutation: () => [jest.fn(), { isLoading: false }],
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
    useUpdateResourcePoolAssignmentMutation: () => [mockUpdateResourcePoolAssignment, { isLoading: false }],
}));
jest.mock('services/gpu', () => ({}));
jest.mock('services/runRequest', () => ({}));
jest.mock('services/instance', () => ({}));
jest.mock('services/publicKeys', () => ({}));
jest.mock('services/run', () => ({}));
jest.mock('services/secrets', () => ({
    useGetAllSecretsQuery: () => ({ data: [], isLoading: false }),
    useUpdateSecretMutation: () => [jest.fn()],
    useDeleteSecretsMutation: () => [jest.fn()],
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
        mockDeleteProjects.mockReset();
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

        expect(screen.getByText("资源池名称需匹配 '^[a-z][a-z0-9-]{1,40}$'。")).toBeInTheDocument();
        expect(mockCreateResourcePool).not.toHaveBeenCalled();
    });
});

describe('ProjectDetailsPage', () => {
    beforeEach(() => {
        mockNavigate.mockReset();
        mockUpdateProject.mockReset();
        mockDeleteProjects.mockReset();
        mockAddProjectMember.mockReset();
        mockGetUserList.mockReset();
        mockConfirm.mockReset();
        mockUpdateResourcePoolAssignment.mockReset();
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

    test('shows project resource assignments and updates the authorized resource pool', async () => {
        mockUpdateResourcePoolAssignment.mockReturnValue({
            unwrap: () => Promise.resolve(resourcePool()),
        });

        render(<ProjectDetailsPage />);

        expect(screen.getByText('资源授权')).toBeInTheDocument();
        expect(screen.getAllByText('gpu-fleet')).not.toHaveLength(0);
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
});
