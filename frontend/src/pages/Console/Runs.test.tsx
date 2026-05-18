import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { RunDetailsPage, RunRequestCreatePage } from './pages';

const mockNavigate = jest.fn();
const mockPushNotification = jest.fn();
const mockConfirm = jest.fn();
const mockCreateRunRequest = jest.fn();
const mockApplyRun = jest.fn();
const mockStopRuns = jest.fn();
const mockGetProjectResourcePoolsQuery = jest.fn();
const mockGetRuntimeImagesQuery = jest.fn();
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
    useParams: () => ({ projectName: 'research', runId: 'run-1' }),
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
    useGetAllRunRequestsQuery: () => ({ data: [], isLoading: false }),
    useGetRunRequestQuery: () => ({ data: null, isLoading: false }),
    useRejectRunRequestMutation: () => [jest.fn(), { isLoading: false }],
    useRetryRunRequestMutation: () => [jest.fn(), { isLoading: false }],
}));

jest.mock('services/run', () => ({
    useApplyRunMutation: () => [mockApplyRun, { isLoading: false }],
    useDeleteRunsMutation: () => [jest.fn(), { isLoading: false }],
    useGetMetricsQuery: () => ({ data: [], isLoading: false }),
    useGetModelsQuery: () => ({ data: [], isLoading: false }),
    useGetRunQuery: () => ({
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
    }),
    useGetRunsQuery: () => ({ data: [], isLoading: false }),
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

    test('submits structured Docker startup options', async () => {
        mockCreateRunRequest.mockReturnValue({
            unwrap: () => Promise.resolve({ id: 'req-1', project_name: 'research' }),
        });

        render(<RunRequestCreatePage />);

        await userEvent.type(screen.getByLabelText('任务名称'), 'dev-box');
        await userEvent.type(screen.getByPlaceholderText('python train.py'), 'python train.py');
        await userEvent.type(screen.getByLabelText('入口点'), '/bin/bash');
        await userEvent.type(screen.getByLabelText('工作目录'), '/workspace/project');
        await userEvent.type(screen.getByLabelText('环境变量名'), 'MODEL');
        await userEvent.type(screen.getByLabelText('环境变量值'), 'qwen');
        await userEvent.type(screen.getByLabelText('宿主端口'), '18080');
        await userEvent.type(screen.getByLabelText('容器端口'), '8080');
        await userEvent.type(screen.getByLabelText('来源路径'), '/data/shared');
        await userEvent.type(screen.getByLabelText('容器路径'), '/workspace/data');
        await userEvent.click(screen.getByLabelText('只读'));
        await userEvent.click(screen.getByText('特权模式'));
        await userEvent.click(screen.getByRole('button', { name: '提交审批' }));

        expect(mockCreateRunRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                request: expect.objectContaining({
                    entrypoint: '/bin/bash',
                    working_dir: '/workspace/project',
                    env: { MODEL: 'qwen' },
                    ports: ['18080:8080'],
                    volumes: ['/data/shared:/workspace/data:ro'],
                    privileged: true,
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
});
