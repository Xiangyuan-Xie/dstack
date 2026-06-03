import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { RunDetailsPage, RunRequestCreatePage, RunRequestDetailsPage, RunsPage } from './pages';

const mockNavigate = jest.fn();
const mockParams = { projectName: 'research', requestId: 'task-req', runId: 'run-1' };
const mockPushNotification = jest.fn();
const mockConfirm = jest.fn();
const mockCreateRunRequest = jest.fn();
const mockApplyRun = jest.fn();
const mockGetRunPlan = jest.fn();
const mockStopRuns = jest.fn();
const mockGetProjectResourcePoolsQuery = jest.fn();
const mockGetRuntimeImagesQuery = jest.fn();
const mockGetAllRunRequestsQuery = jest.fn();
const mockGetRunRequestQuery = jest.fn();
const mockGetRunsQuery = jest.fn();
const mockGetRunQuery = jest.fn();
const regularRole = {
    isGlobalAdmin: false,
    canUseProjectAdmin: false,
    canUseGlobalAdmin: false,
    canManagePortal: true,
    manageableProjectNames: [],
};
let mockRole = regularRole;
let mockProjects = [
    { project_name: 'research', project_id: 'project-1' },
    { project_name: 'small', project_id: 'project-2' },
];

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
}));

jest.mock('./Layout', () => ({
    useConsoleContext: () => ({
        locale: 'zh',
        projects: mockProjects,
        role: mockRole,
    }),
}));

jest.mock('hooks', () => ({
    useAppSelector: jest.fn(),
    useNotifications: () => [mockPushNotification],
    useConfirmationDialog: () => [mockConfirm],
}));

const pool = (name: string, resources: IResourcePoolResources): IResourcePool => ({
    id: `${name}-id`,
    name,
    created_at: '2026-05-16T09:00:00+08:00',
    spec: {
        configuration: { type: 'fleet', name },
        profile: { name: 'registered', default: true },
    },
    status: 'active',
    assignments: [],
    instances: [
        {
            id: `${name}-instance-1`,
            name: `${name}-server-1`,
            instance_num: 0,
            status: 'idle',
            backend: 'registered',
            authorized_projects: ['research'],
            occupancy: { status: 'idle', project_names: [], task_count: 0 },
            resources,
        },
    ],
    authorized_project_names: ['research'],
    idle_instance_count: 1,
    busy_instance_count: 0,
    resource_summary: {
        instance_count: 1,
        cpu_count: resources.cpu_count ?? 0,
        memory_gib: resources.memory_gib ?? 0,
        disk_gib: resources.disk_gib ?? 0,
        gpu_count: resources.gpu_count,
        gpus: resources.gpus,
    },
});

const bigPool = pool('big-pool', {
    cpu_count: 32,
    memory_gib: 64,
    disk_gib: 500,
    gpu_count: 1,
    gpus: [{ name: 'RTX4090D', count: 1, memory_gib: 23.99 }],
});

const smallPool = pool('small-pool', {
    cpu_count: 8,
    memory_gib: 16,
    disk_gib: 100,
    gpu_count: 0,
    gpus: [],
});

jest.mock('services/resourcePool', () => ({
    useGetProjectResourcePoolsQuery: (...args: unknown[]) => mockGetProjectResourcePoolsQuery(...args),
    useGetResourcePoolsQuery: () => ({ data: [], isLoading: false }),
    useGetResourcePoolDetailsQuery: () => ({ data: null, isLoading: false }),
    useCreateResourcePoolMutation: () => [jest.fn(), { isLoading: false }],
    useDeleteResourcePoolsMutation: () => [jest.fn(), { isLoading: false }],
    useUpdateResourcePoolAssignmentMutation: () => [jest.fn(), { isLoading: false }],
}));

jest.mock('services/runtimeImages', () => ({
    useGetRuntimeImagesQuery: (...args: unknown[]) => mockGetRuntimeImagesQuery(...args),
    useUpdateRuntimeImagesMutation: () => [jest.fn(), { isLoading: false }],
}));

jest.mock('services/runRequest', () => ({
    useCreateRunRequestMutation: () => [mockCreateRunRequest, { isLoading: false }],
    useApproveRunRequestMutation: () => [jest.fn(), { isLoading: false }],
    useGetAllRunRequestsQuery: (...args: unknown[]) => mockGetAllRunRequestsQuery(...args),
    useGetRunRequestQuery: (...args: unknown[]) => mockGetRunRequestQuery(...args),
    useRejectRunRequestMutation: () => [jest.fn(), { isLoading: false }],
    useRetryRunRequestMutation: () => [jest.fn(), { isLoading: false }],
}));

jest.mock('services/run', () => ({
    useApplyRunMutation: () => [mockApplyRun, { isLoading: false }],
    useDeleteRunsMutation: () => [jest.fn(), { isLoading: false }],
    useGetMetricsQuery: () => ({ data: [], isLoading: false }),
    useGetModelsQuery: () => ({ data: [], isLoading: false }),
    useGetRunPlanMutation: () => [mockGetRunPlan, { isLoading: false }],
    useGetRunQuery: (...args: unknown[]) => mockGetRunQuery(...args),
    useGetRunsQuery: (...args: unknown[]) => mockGetRunsQuery(...args),
    useStopRunsMutation: () => [mockStopRuns, { isLoading: false }],
}));

jest.mock('services/backend', () => ({}));
jest.mock('services/events', () => ({}));
jest.mock('services/gpu', () => ({}));
jest.mock('services/instance', () => ({}));
jest.mock('services/project', () => ({
    useGetProjectLogsQuery: () => ({ data: null, isLoading: false }),
    useGetProjectsQuery: () => ({ data: { data: [] }, isLoading: false }),
}));
jest.mock('services/publicKeys', () => ({}));
jest.mock('services/secrets', () => ({}));
jest.mock('services/user', () => ({}));
jest.mock('services/volume', () => ({}));
jest.mock('services/adminOAuth', () => ({}));
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
    runStatusForStopping: ['running'],
}));

describe('RunRequestCreatePage', () => {
    beforeEach(() => {
        mockNavigate.mockReset();
        mockPushNotification.mockReset();
        mockCreateRunRequest.mockReset();
        mockApplyRun.mockReset();
        mockGetRunPlan.mockReset();
        mockStopRuns.mockReset();
        mockConfirm.mockReset();
        mockRole = regularRole;
        mockProjects = [
            { project_name: 'research', project_id: 'project-1' },
            { project_name: 'small', project_id: 'project-2' },
        ];
        mockGetProjectResourcePoolsQuery.mockReset();
        mockGetProjectResourcePoolsQuery.mockReturnValue({ data: [bigPool, smallPool], isLoading: false });
        mockGetRuntimeImagesQuery.mockReset();
        mockGetRuntimeImagesQuery.mockReturnValue({
            data: [
                {
                    name: 'PyTorch CUDA',
                    image: 'pytorch/pytorch:2.5.1-cuda12.4-cudnn9-runtime',
                    category: 'PyTorch',
                },
                {
                    name: 'Isaac Sim 6.0',
                    image: 'nvcr.io/nvidia/isaac-sim:6.0.0-dev2',
                    category: 'Isaac Sim',
                },
            ],
            isLoading: false,
        });
        mockGetAllRunRequestsQuery.mockReturnValue({ data: [], isLoading: false });
        mockGetRunRequestQuery.mockReturnValue({ data: null, isLoading: false });
        mockGetRunPlan.mockReturnValue({
            unwrap: () =>
                Promise.resolve({
                    job_plans: [
                        {
                            total_offers: 1,
                            offers: [{ availability: 'available' }],
                        },
                    ],
                }),
        });
        mockGetRunQuery.mockReturnValue({
            data: {
                id: 'run-1',
                project_name: 'research',
                user: 'alice',
                submitted_at: '2026-05-16T09:00:00+08:00',
                status: 'running',
                jobs: [],
                run_spec: { run_name: 'train-a', configuration: { type: 'task' } },
                cost: 0,
                service: null,
            },
            isLoading: false,
        });
        mockGetRunsQuery.mockReturnValue({ data: [], isLoading: false });
    });

    test('bounds resource sliders and run duration by allowed ranges', () => {
        render(<RunRequestCreatePage />);

        expect(screen.queryByLabelText('节点数 滑条')).not.toBeInTheDocument();
        expect(screen.getByLabelText('GPU 数量')).toHaveAttribute('max', '1');
        expect(screen.getByLabelText('CPU 核心')).toHaveAttribute('max', '32');
        expect(screen.getByLabelText('内存 GiB')).toHaveAttribute('max', '64');
        expect(screen.queryByLabelText('磁盘 GiB')).not.toBeInTheDocument();
        expect(screen.getByLabelText('运行时间 小时')).toHaveAttribute('min', '1');
        expect(screen.getByLabelText('运行时间 小时')).toHaveAttribute('max', '168');
        expect(screen.getByLabelText('运行时间 数值')).toHaveValue(4);
    });

    test('defaults run resource inputs to zero', () => {
        render(<RunRequestCreatePage />);

        expect(screen.getByLabelText('CPU 数值')).toHaveValue(0);
        expect(screen.getByLabelText('内存 数值')).toHaveValue(0);
        expect(screen.getByLabelText('GPU 数值')).toHaveValue(0);
    });

    test('defaults dev environment resource inputs to zero', () => {
        render(<RunRequestCreatePage kind="dev-environments" />);

        expect(screen.getByLabelText('CPU 数值')).toHaveValue(0);
        expect(screen.getByLabelText('内存 数值')).toHaveValue(0);
        expect(screen.getByLabelText('GPU 数值')).toHaveValue(0);
    });

    test('recomputes resource slider limits from the selected resource pool and clamps values', async () => {
        render(<RunRequestCreatePage />);

        await userEvent.clear(screen.getByLabelText('CPU 数值'));
        await userEvent.type(screen.getByLabelText('CPU 数值'), '30');
        await userEvent.selectOptions(screen.getByLabelText('资源池'), 'small-pool');

        await waitFor(() => expect(screen.getByLabelText('CPU 核心')).toHaveAttribute('max', '8'));
        expect(screen.getByLabelText('CPU 数值')).toHaveValue(8);
        expect(screen.getByLabelText('GPU 数量')).toHaveAttribute('max', '0');
    });

    test('submits numeric slider values using the existing run request shape', async () => {
        mockCreateRunRequest.mockReturnValue({
            unwrap: () => Promise.resolve({ id: 'req-1', project_name: 'research' }),
        });

        render(<RunRequestCreatePage />);

        expect(screen.queryByPlaceholderText('train-qwen')).not.toBeInTheDocument();
        expect(screen.getByRole('group', { name: 'PyTorch' })).toBeInTheDocument();
        expect(screen.getByRole('group', { name: 'Isaac Sim' })).toBeInTheDocument();
        await userEvent.type(screen.getByLabelText('任务名称'), 'train-a');
        await userEvent.selectOptions(screen.getByLabelText('镜像'), 'pytorch/pytorch:2.5.1-cuda12.4-cudnn9-runtime');
        await userEvent.type(screen.getByPlaceholderText('python train.py'), 'python train.py');
        await userEvent.clear(screen.getByLabelText('GPU 数值'));
        await userEvent.type(screen.getByLabelText('GPU 数值'), '1');
        await userEvent.clear(screen.getByLabelText('CPU 数值'));
        await userEvent.type(screen.getByLabelText('CPU 数值'), '16');
        await userEvent.clear(screen.getByLabelText('内存 数值'));
        await userEvent.type(screen.getByLabelText('内存 数值'), '32');
        await userEvent.clear(screen.getByLabelText('运行时间 数值'));
        await userEvent.type(screen.getByLabelText('运行时间 数值'), '168');
        await userEvent.click(screen.getByRole('button', { name: '提交审批' }));

        expect(mockCreateRunRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                request: expect.objectContaining({
                    run_type: 'task',
                    image: 'pytorch/pytorch:2.5.1-cuda12.4-cudnn9-runtime',
                    max_duration: '168h',
                    resources: {
                        gpu: '1',
                        cpu: '16',
                        memory: '32GB',
                    },
                }),
            }),
        );
    });

    test('submits dev environment requests without a startup command', async () => {
        mockCreateRunRequest.mockReturnValue({
            unwrap: () => Promise.resolve({ id: 'req-1', project_name: 'research' }),
        });

        render(<RunRequestCreatePage kind="dev-environments" />);

        expect(screen.queryByPlaceholderText('python train.py')).not.toBeInTheDocument();
        expect(screen.queryByText('环境变量')).not.toBeInTheDocument();
        expect(screen.queryByText('端口映射')).not.toBeInTheDocument();
        expect(screen.queryByText('特权模式')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('连接工具')).not.toBeInTheDocument();
        expect(screen.getByLabelText('工作目录')).toHaveAttribute('placeholder', '/root');
        await userEvent.type(screen.getByLabelText('开发环境名称'), 'code-box');
        await userEvent.type(screen.getByPlaceholderText('pip install -r requirements.txt'), 'pip install uv');
        await userEvent.type(screen.getByLabelText('服务器路径'), '/data/dev/alice');
        await userEvent.type(screen.getByLabelText('环境内路径'), '/workspace/data');
        await userEvent.click(screen.getByRole('button', { name: '提交审批' }));

        expect(mockCreateRunRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                request: expect.objectContaining({
                    run_type: 'dev-environment',
                    commands: [],
                    init: ['pip install uv'],
                    ide: undefined,
                    inactivity_duration: 'off',
                    persistent_dirs: [{ host_path: '/data/dev/alice', mount_path: '/workspace/data', read_only: false }],
                }),
            }),
        );
        expect(mockNavigate).toHaveBeenCalledWith('/resources/dev-environments/requests/research/req-1');
    });

    test('submits persistent directory mappings without raw volume syntax', async () => {
        mockCreateRunRequest.mockReturnValue({
            unwrap: () => Promise.resolve({ id: 'req-1', project_name: 'research' }),
        });

        render(<RunRequestCreatePage />);

        await userEvent.type(screen.getByLabelText('任务名称'), 'dev-box');
        await userEvent.type(screen.getByPlaceholderText('python train.py'), 'python train.py');
        expect(screen.queryByLabelText('入口点')).not.toBeInTheDocument();
        await userEvent.type(screen.getByLabelText('工作目录'), '/workspace/project');
        await userEvent.type(screen.getByLabelText('环境变量名'), 'MODEL');
        await userEvent.type(screen.getByLabelText('环境变量值'), 'qwen');
        await userEvent.type(screen.getByLabelText('宿主端口'), '18080');
        await userEvent.type(screen.getByLabelText('环境端口'), '8080');
        await userEvent.type(screen.getByLabelText('服务器路径'), '/data/shared');
        await userEvent.type(screen.getByLabelText('环境内路径'), '/workspace/data');
        await userEvent.click(screen.getByLabelText('只读'));
        await userEvent.click(screen.getByRole('button', { name: '提交审批' }));

        expect(mockCreateRunRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                request: expect.objectContaining({
                    entrypoint: undefined,
                    working_dir: '/workspace/project',
                    env: { MODEL: 'qwen' },
                    ports: ['18080:8080'],
                    persistent_dirs: [{ host_path: '/data/shared', mount_path: '/workspace/data', read_only: true }],
                }),
            }),
        );
    });

    test('requires a runtime image before submitting', async () => {
        mockGetRuntimeImagesQuery.mockReturnValue({ data: [], isLoading: false });

        render(<RunRequestCreatePage />);

        expect(screen.getByText('暂无可用任务镜像')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: '提交审批' }));

        expect(mockCreateRunRequest).not.toHaveBeenCalled();
        expect(mockPushNotification).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'error',
                header: '请选择任务镜像',
            }),
        );
    });

    test('shows field-level required feedback before submitting a run request', async () => {
        render(<RunRequestCreatePage />);

        await userEvent.clear(screen.getByLabelText('任务名称'));
        await userEvent.selectOptions(screen.getByLabelText('镜像'), '');
        await userEvent.clear(screen.getByLabelText('启动命令'));
        await userEvent.click(screen.getByRole('button', { name: '提交审批' }));

        expect(mockCreateRunRequest).not.toHaveBeenCalled();
        expect(screen.getByText('请补全必填信息')).toBeInTheDocument();
        expect(screen.getByText('请输入任务名称')).toBeInTheDocument();
        expect(screen.getAllByText('请选择镜像')).toHaveLength(2);
        expect(screen.getByText('请输入启动命令')).toBeInTheDocument();
        expect(screen.getByLabelText('任务名称')).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByLabelText('镜像')).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByLabelText('启动命令')).toHaveAttribute('aria-invalid', 'true');
    });

    test('shows an empty project state before any project is created', async () => {
        mockProjects = [];

        render(<RunRequestCreatePage />);

        expect(screen.getByText('暂无项目，请最高管理员先创建项目。')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: '提交审批' }));

        expect(mockCreateRunRequest).not.toHaveBeenCalled();
        expect(mockPushNotification).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'error',
                header: '请先创建项目',
            }),
        );
    });

    test('prechecks capacity before directly creating a run', async () => {
        mockRole = {
            ...regularRole,
            canUseProjectAdmin: true,
            manageableProjectNames: ['research'],
        };
        mockApplyRun.mockReturnValue({
            unwrap: () => Promise.resolve({ id: 'run-2', project_name: 'research' }),
        });

        render(<RunRequestCreatePage />);

        await userEvent.type(screen.getByLabelText('任务名称'), 'train-direct');
        await userEvent.type(screen.getByPlaceholderText('python train.py'), 'python train.py');
        await userEvent.click(screen.getByRole('button', { name: '创建任务' }));

        await waitFor(() => expect(mockGetRunPlan).toHaveBeenCalled());
        expect(mockGetRunPlan).toHaveBeenCalledWith(
            expect.objectContaining({
                max_offers: 1,
            }),
        );
        expect(mockApplyRun).toHaveBeenCalledWith(
            expect.objectContaining({
                project_name: 'research',
                force: true,
                plan: expect.objectContaining({
                    run_spec: expect.objectContaining({
                        run_name: 'train-direct',
                    }),
                }),
            }),
        );
        expect(mockNavigate).toHaveBeenCalledWith('/resources/runs/research/run-2');
    });

    test('directly creates a development environment and navigates to its details', async () => {
        mockRole = {
            ...regularRole,
            canUseProjectAdmin: true,
            manageableProjectNames: ['research'],
        };
        mockApplyRun.mockReturnValue({
            unwrap: () => Promise.resolve({ id: 'dev-run-2', project_name: 'research' }),
        });

        render(<RunRequestCreatePage kind="dev-environments" />);

        await userEvent.type(screen.getByLabelText('开发环境名称'), 'dev-direct');
        await userEvent.click(screen.getByRole('button', { name: '创建开发环境' }));

        await waitFor(() => expect(mockGetRunPlan).toHaveBeenCalled());
        expect(mockApplyRun).toHaveBeenCalledWith(
            expect.objectContaining({
                project_name: 'research',
                force: true,
                plan: expect.objectContaining({
                    run_spec: expect.objectContaining({
                        run_name: 'dev-direct',
                    }),
                }),
            }),
        );
        expect(mockNavigate).toHaveBeenCalledWith('/resources/dev-environments/research/dev-run-2');
    });

    test('blocks direct run creation when capacity precheck has no offers', async () => {
        mockRole = {
            ...regularRole,
            canUseProjectAdmin: true,
            manageableProjectNames: ['research'],
        };
        mockGetRunPlan.mockReturnValue({
            unwrap: () =>
                Promise.resolve({
                    job_plans: [
                        {
                            total_offers: 0,
                            offers: [],
                            capacity_issue: {
                                code: 'no_matching_instance',
                                message: '没有空闲的 registered worker 满足当前 CPU/内存/GPU 配置。',
                            },
                        },
                    ],
                }),
        });

        render(<RunRequestCreatePage />);

        await userEvent.type(screen.getByLabelText('任务名称'), 'train-direct');
        await userEvent.type(screen.getByPlaceholderText('python train.py'), 'python train.py');
        await userEvent.click(screen.getByRole('button', { name: '创建任务' }));

        await waitFor(() => expect(mockGetRunPlan).toHaveBeenCalled());
        expect(mockApplyRun).not.toHaveBeenCalled();
        expect(mockPushNotification).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'error',
                header: '当前配置暂无可启动容量',
            }),
        );
        expect(screen.getByText('当前配置暂无可启动容量')).toBeInTheDocument();
        expect(screen.getByRole('alert')).toHaveTextContent('没有空闲的 registered worker 满足当前 CPU/内存/GPU 配置。');
        expect(screen.getByRole('alert')).not.toHaveTextContent('授权');
    });

    test('uses neutral capacity feedback when backend provides no diagnostic', async () => {
        mockRole = {
            ...regularRole,
            canUseProjectAdmin: true,
            manageableProjectNames: ['research'],
        };
        mockGetRunPlan.mockReturnValue({
            unwrap: () =>
                Promise.resolve({
                    job_plans: [
                        {
                            total_offers: 0,
                            offers: [],
                        },
                    ],
                }),
        });

        render(<RunRequestCreatePage />);

        await userEvent.type(screen.getByLabelText('任务名称'), 'train-direct');
        await userEvent.type(screen.getByPlaceholderText('python train.py'), 'python train.py');
        await userEvent.click(screen.getByRole('button', { name: '创建任务' }));

        await waitFor(() => expect(mockGetRunPlan).toHaveBeenCalled());
        expect(mockApplyRun).not.toHaveBeenCalled();
        expect(screen.getByRole('alert')).toHaveTextContent('未找到满足当前配置的可启动资源。');
        expect(screen.getByRole('alert')).not.toHaveTextContent('授权');
    });

    test('blocks direct run creation when capacity precheck only returns busy offers', async () => {
        mockRole = {
            ...regularRole,
            canUseProjectAdmin: true,
            manageableProjectNames: ['research'],
        };
        mockGetRunPlan.mockReturnValue({
            unwrap: () =>
                Promise.resolve({
                    job_plans: [
                        {
                            total_offers: 1,
                            offers: [{ availability: 'busy' }],
                        },
                    ],
                }),
        });

        render(<RunRequestCreatePage />);

        await userEvent.type(screen.getByLabelText('任务名称'), 'train-direct');
        await userEvent.type(screen.getByPlaceholderText('python train.py'), 'python train.py');
        await userEvent.click(screen.getByRole('button', { name: '创建任务' }));

        await waitFor(() => expect(mockGetRunPlan).toHaveBeenCalled());
        expect(mockApplyRun).not.toHaveBeenCalled();
        expect(screen.getByRole('alert')).toHaveTextContent('预检返回的资源暂不可启动，可能已被占用或不满足本次配置。');
        expect(screen.getByRole('alert')).toHaveTextContent('状态：busy');
        expect(screen.getAllByText('请调整资源池、CPU/GPU/内存配置，或稍后重试。')).toHaveLength(1);
    });

    test('labels resource sliders as specification limits, not available capacity', () => {
        render(<RunRequestCreatePage />);

        expect(screen.getAllByText(/规格上限/)).toHaveLength(3);
        expect(screen.queryByText(/可用上限/)).not.toBeInTheDocument();
    });
});

describe('RunsPage', () => {
    beforeEach(() => {
        mockNavigate.mockReset();
        mockRole = regularRole;
        mockGetAllRunRequestsQuery.mockReturnValue({
            data: [
                {
                    id: 'task-req',
                    project_name: 'research',
                    applicant: 'alice',
                    status: 'pending',
                    created_at: '2026-05-16T09:00:00+08:00',
                    request: {
                        run_type: 'task',
                        name: 'train-task',
                        image: 'ubuntu:22.04',
                        commands: ['python train.py'],
                        resources: {},
                    },
                },
                {
                    id: 'approved-task-req',
                    project_name: 'research',
                    applicant: 'alice',
                    status: 'approved',
                    created_at: '2026-05-16T08:00:00+08:00',
                    run_id: 'approved-run-task',
                    run_name: 'approved-train-task',
                    request: {
                        run_type: 'task',
                        name: 'approved-train-task',
                        image: 'ubuntu:22.04',
                        commands: ['python train.py'],
                        resources: {},
                    },
                },
                {
                    id: 'rejected-task-req',
                    project_name: 'research',
                    applicant: 'alice',
                    status: 'rejected',
                    created_at: '2026-05-16T07:00:00+08:00',
                    request: {
                        run_type: 'task',
                        name: 'rejected-task',
                        image: 'ubuntu:22.04',
                        commands: ['python train.py'],
                        resources: {},
                    },
                },
                {
                    id: 'failed-task-req',
                    project_name: 'research',
                    applicant: 'alice',
                    status: 'failed',
                    created_at: '2026-05-16T06:00:00+08:00',
                    request: {
                        run_type: 'task',
                        name: 'failed-task',
                        image: 'ubuntu:22.04',
                        commands: ['python train.py'],
                        resources: {},
                    },
                },
                {
                    id: 'dev-req',
                    project_name: 'research',
                    applicant: 'alice',
                    status: 'pending',
                    created_at: '2026-05-16T10:00:00+08:00',
                    request: {
                        run_type: 'dev-environment',
                        name: 'code-box',
                        image: 'ubuntu:22.04',
                        commands: [],
                        init: [],
                        resources: {},
                    },
                },
                {
                    id: 'approved-dev-req',
                    project_name: 'research',
                    applicant: 'alice',
                    status: 'approved',
                    created_at: '2026-05-16T08:30:00+08:00',
                    run_id: 'approved-run-dev',
                    run_name: 'approved-code-box',
                    request: {
                        run_type: 'dev-environment',
                        name: 'approved-code-box',
                        image: 'ubuntu:22.04',
                        commands: [],
                        init: [],
                        resources: {},
                    },
                },
            ],
            isLoading: false,
        });
        mockGetRunsQuery.mockReturnValue({
            data: [
                {
                    id: 'run-task',
                    project_name: 'research',
                    user: 'alice',
                    submitted_at: '2026-05-16T11:00:00+08:00',
                    status: 'running',
                    jobs: [],
                    run_spec: { run_name: 'direct-task', configuration: { type: 'task' } },
                    cost: 0,
                    service: null,
                },
                {
                    id: 'run-dev',
                    project_name: 'research',
                    user: 'alice',
                    submitted_at: '2026-05-16T12:00:00+08:00',
                    status: 'running',
                    jobs: [],
                    run_spec: { run_name: 'direct-dev', configuration: { type: 'dev-environment' } },
                    cost: 0,
                    service: null,
                },
                {
                    id: 'approved-run-task',
                    project_name: 'research',
                    user: 'alice',
                    submitted_at: '2026-05-16T08:05:00+08:00',
                    status: 'provisioning',
                    jobs: [],
                    run_spec: { run_name: 'approved-train-task', configuration: { type: 'task' } },
                    cost: 0,
                    service: null,
                },
                {
                    id: 'approved-run-dev',
                    project_name: 'research',
                    user: 'alice',
                    submitted_at: '2026-05-16T08:35:00+08:00',
                    status: 'submitted',
                    jobs: [],
                    run_spec: { run_name: 'approved-code-box', configuration: { type: 'dev-environment' } },
                    cost: 0,
                    service: null,
                },
            ],
            isLoading: false,
        });
    });

    test('shows task runs separately from dev environments', () => {
        render(<RunsPage kind="runs" />);

        expect(screen.getByText('运行任务')).toBeInTheDocument();
        expect(screen.getByText('train-task')).toBeInTheDocument();
        expect(screen.getByText('approved-train-task')).toBeInTheDocument();
        expect(screen.getByText('rejected-task')).toBeInTheDocument();
        expect(screen.getByText('failed-task')).toBeInTheDocument();
        expect(screen.getByText('direct-task')).toBeInTheDocument();
        expect(screen.queryByText('code-box')).not.toBeInTheDocument();
        expect(screen.queryByText('approved-code-box')).not.toBeInTheDocument();
        expect(screen.queryByText('direct-dev')).not.toBeInTheDocument();
    });

    test('shows a single current status column for task requests and runs', () => {
        render(<RunsPage kind="runs" />);

        expect(screen.getByRole('columnheader', { name: '当前状态' })).toBeInTheDocument();
        expect(screen.queryByRole('columnheader', { name: '审批' })).not.toBeInTheDocument();
        expect(screen.queryByRole('columnheader', { name: '运行' })).not.toBeInTheDocument();
        expect(screen.getByText('待审批')).toBeInTheDocument();
        expect(screen.getByText('创建中')).toBeInTheDocument();
        expect(screen.getByText('已拒绝')).toBeInTheDocument();
        expect(screen.getByText('失败')).toBeInTheDocument();
        expect(screen.queryByText('已通过')).not.toBeInTheDocument();
    });

    test('shows dev environments separately from task runs', async () => {
        render(<RunsPage kind="dev-environments" />);

        expect(screen.getByText('开发环境')).toBeInTheDocument();
        expect(screen.getByText('code-box')).toBeInTheDocument();
        expect(screen.getByText('approved-code-box')).toBeInTheDocument();
        expect(screen.getByText('direct-dev')).toBeInTheDocument();
        expect(screen.queryByText('train-task')).not.toBeInTheDocument();
        expect(screen.queryByText('approved-train-task')).not.toBeInTheDocument();
        expect(screen.queryByText('direct-task')).not.toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: '当前状态' })).toBeInTheDocument();
        expect(screen.getByText('待审批')).toBeInTheDocument();
        expect(screen.getByText('已提交')).toBeInTheDocument();

        await userEvent.click(screen.getByText('code-box'));
        expect(mockNavigate).toHaveBeenCalledWith('/resources/dev-environments/requests/research/dev-req');
    });

    test('requests list data within backend pagination limits', () => {
        render(<RunsPage kind="dev-environments" />);

        expect(mockGetRunsQuery).toHaveBeenCalledWith(
            { limit: 100, job_submissions_limit: 1 },
            { pollingInterval: 5000, refetchOnMountOrArgChange: true },
        );
        expect(mockGetAllRunRequestsQuery).toHaveBeenCalledWith(
            { include_all: false, limit: 100 },
            { pollingInterval: 5000, refetchOnMountOrArgChange: true },
        );
    });
});

describe('RunRequestDetailsPage', () => {
    beforeEach(() => {
        mockRole = regularRole;
        mockGetRunRequestQuery.mockReturnValue({
            data: {
                id: 'task-req',
                project_name: 'research',
                applicant: 'alice',
                status: 'pending',
                created_at: '2026-05-16T09:00:00+08:00',
                request: {
                    run_type: 'task',
                    name: 'train-task',
                    image: 'ubuntu:22.04',
                    commands: ['python train.py'],
                    resources: {},
                },
            },
            isLoading: false,
        });
        mockGetRunQuery.mockReturnValue({ data: undefined, isLoading: false });
    });

    test('shows pending approval as the current status', () => {
        render(<RunRequestDetailsPage kind="runs" />);

        expect(screen.getByText('当前状态')).toBeInTheDocument();
        expect(screen.getByText('待审批')).toBeInTheDocument();
    });
});

describe('RunDetailsPage', () => {
    beforeEach(() => {
        mockConfirm.mockReset();
        mockStopRuns.mockReset();
        mockRole = {
            ...regularRole,
            canUseProjectAdmin: true,
            manageableProjectNames: ['research'],
        };
        mockGetRunQuery.mockReturnValue({
            data: {
                id: 'run-1',
                project_name: 'research',
                user: 'alice',
                submitted_at: '2026-05-16T09:00:00+08:00',
                status: 'running',
                jobs: [],
                run_spec: { run_name: 'train-a', configuration: { type: 'task' } },
                cost: 0,
                service: null,
            },
            isLoading: false,
        });
    });

    test('confirms before stopping a running task', async () => {
        mockStopRuns.mockReturnValue({
            unwrap: () => Promise.resolve(undefined),
        });

        render(<RunDetailsPage />);
        await userEvent.click(screen.getByRole('button', { name: '停止' }));

        expect(mockStopRuns).not.toHaveBeenCalled();
        expect(mockConfirm).toHaveBeenCalledWith(
            expect.objectContaining({
                title: '停止运行任务',
                confirmButtonLabel: '停止',
            }),
        );

        const onConfirm = mockConfirm.mock.calls[0][0].onConfirm;
        await onConfirm();

        expect(mockStopRuns).toHaveBeenCalledWith({
            project_name: 'research',
            runs_names: ['train-a'],
            abort: true,
        });
    });

    test('shows no-capacity feedback from the latest job submission', () => {
        mockGetRunQuery.mockReturnValue({
            data: {
                id: 'run-1',
                project_name: 'research',
                user: 'alice',
                submitted_at: '2026-05-16T09:00:00+08:00',
                status: 'failed',
                termination_reason: 'job_failed',
                latest_job_submission: {
                    id: 'submission-1',
                    submission_num: 0,
                    status: 'failed',
                    submitted_at: 0,
                    finished_at: '2026-05-16T09:01:00+08:00',
                    termination_reason: 'failed_to_start_due_to_no_capacity',
                    termination_reason_message: 'No matching fleet found',
                    status_message: 'no fleets',
                    error: 'Failed to start due to no capacity',
                },
                jobs: [
                    {
                        job_spec: {
                            job_name: 'train-a-0-0',
                            job_num: 0,
                            image_name: 'ubuntu:22.04',
                            commands: ['python train.py'],
                        },
                        job_submissions: [
                            {
                                id: 'submission-1',
                                submission_num: 0,
                                status: 'failed',
                                submitted_at: 0,
                                finished_at: '2026-05-16T09:01:00+08:00',
                                termination_reason: 'failed_to_start_due_to_no_capacity',
                                termination_reason_message: 'No matching fleet found',
                                status_message: 'no fleets',
                            },
                        ],
                    },
                ],
                run_spec: { run_name: 'train-a', configuration: { type: 'task' } },
                cost: 0,
                service: null,
            },
            isLoading: false,
        });

        render(<RunDetailsPage />);

        expect(screen.getByText('当前配置暂无可启动容量')).toBeInTheDocument();
        expect(screen.getAllByText(/No matching fleet found/).length).toBeGreaterThan(0);
        expect(screen.getByText(/train-a-0-0/)).toBeInTheDocument();
        expect(screen.getByText(/no fleets/)).toBeInTheDocument();
    });

    test('shows executor failure feedback with termination message and exit status', () => {
        mockGetRunQuery.mockReturnValue({
            data: {
                id: 'run-1',
                project_name: 'research',
                user: 'alice',
                submitted_at: '2026-05-16T09:00:00+08:00',
                status: 'failed',
                termination_reason: 'job_failed',
                jobs: [
                    {
                        job_spec: {
                            job_name: 'dev-box-0-0',
                            job_num: 0,
                            image_name: 'python:3.11-slim',
                            commands: ['tail -f /dev/null'],
                        },
                        job_submissions: [
                            {
                                id: 'submission-1',
                                submission_num: 0,
                                status: 'failed',
                                submitted_at: 0,
                                finished_at: '2026-05-16T09:01:00+08:00',
                                termination_reason: 'executor_error',
                                termination_reason_message:
                                    'Docker exited with status 125: could not select device driver',
                                exit_status: 125,
                            },
                        ],
                    },
                ],
                run_spec: { run_name: 'dev-box', configuration: { type: 'dev-environment' } },
                cost: 0,
                service: null,
            },
            isLoading: false,
        });

        render(<RunDetailsPage kind="dev-environments" />);

        expect(screen.queryByText('当前配置暂无可启动容量')).not.toBeInTheDocument();
        expect(screen.getByText('执行失败')).toBeInTheDocument();
        expect(screen.getAllByText(/Docker exited with status 125/).length).toBeGreaterThan(0);
        expect(screen.getByText(/退出码：125/)).toBeInTheDocument();
    });
});
