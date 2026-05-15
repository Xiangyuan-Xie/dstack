import {
    buildGpuRequestCreateParams,
    getContainerSummaries,
    getGpuRequestStats,
    getPortalNavItems,
    getPortalUserRole,
} from './utils';

const user = {
    id: 'u-1',
    username: 'alice',
    global_role: 'user',
    email: null,
    permissions: [],
    created_at: '2026-05-15T00:00:00Z',
    active: true,
} as IUser;

const admin = {
    ...user,
    username: 'admin',
    global_role: 'admin',
} as IUser;

const project = {
    project_id: 'p-1',
    project_name: 'research',
    members: [{ user, project_role: 'user' }],
    backends: [],
    owner: user,
    created_at: '2026-05-15T00:00:00Z',
    isPublic: false,
} as IProject;

const managedProject = {
    ...project,
    project_name: 'training',
    members: [{ user, project_role: 'manager' }],
} as IProject;

const request = {
    id: 'req-1',
    project_name: 'research',
    applicant: 'alice',
    status: 'approved',
    created_at: '2026-05-15T00:00:00Z',
    run_id: 'run-1',
    run_name: 'train-a',
    request: {
        name: 'train-a',
        image: 'pytorch/pytorch:2.5.1-cuda12.4-cudnn9-runtime',
        commands: ['python train.py'],
        ports: [8888],
        resources: {
            gpu: '1',
            cpu: '8',
            memory: '32GB',
        },
    },
} as IGpuRequest;

describe('Portal utils', () => {
    test('builds user navigation without admin links', () => {
        const role = getPortalUserRole([project], user);
        const labels = getPortalNavItems(role).map((item) => item.label);

        expect(labels).toEqual(['工作台', 'GPU 申请', '我的容器']);
    });

    test('builds admin navigation with approval and console links', () => {
        const role = getPortalUserRole([project], admin);
        const labels = getPortalNavItems(role).map((item) => item.label);

        expect(labels).toContain('审批中心');
        expect(labels).toContain('容器管理');
        expect(labels).toContain('服务器管理');
        expect(labels).toContain('高级控制台');
    });

    test('detects project managers as portal admins', () => {
        const role = getPortalUserRole([project, managedProject], user);

        expect(role.canManagePortal).toBe(true);
        expect(role.manageableProjectNames).toEqual(['training']);
    });

    test('converts the Chinese portal form into the GPU request API shape', () => {
        expect(
            buildGpuRequestCreateParams({
                project_name: 'research',
                name: 'train-a',
                image: 'pytorch/pytorch:2.5.1-cuda12.4-cudnn9-runtime',
                commands: 'python train.py\npython eval.py',
                env: 'MODEL=qwen\nEMPTY_VALUE',
                ports: '8888, 6006',
                nodes: '2',
                cpu: '8',
                memory: '32GB',
                gpu: '1',
                disk: '200GB',
                max_duration: '4h',
                fleets: 'gpu-a, gpu-b',
            }),
        ).toEqual({
            project_name: 'research',
            request: {
                name: 'train-a',
                image: 'pytorch/pytorch:2.5.1-cuda12.4-cudnn9-runtime',
                commands: ['python train.py', 'python eval.py'],
                env: {
                    MODEL: 'qwen',
                    EMPTY_VALUE: '',
                },
                ports: [8888, 6006],
                nodes: 2,
                resources: {
                    cpu: '8',
                    memory: '32GB',
                    gpu: '1',
                    disk: '200GB',
                },
                max_duration: '4h',
                fleets: ['gpu-a', 'gpu-b'],
            },
        });
    });

    test('summarizes request statuses for dashboards', () => {
        expect(
            getGpuRequestStats([
                { ...request, status: 'pending' },
                { ...request, id: 'req-2', status: 'approved' },
                { ...request, id: 'req-3', status: 'failed' },
            ]),
        ).toEqual({
            total: 3,
            pending: 1,
            approved: 1,
            rejected: 0,
            failed: 1,
        });
    });

    test('maps approved GPU requests to user-facing container summaries', () => {
        const summaries = getContainerSummaries(
            [request],
            [
                {
                    id: 'run-1',
                    project_name: 'research',
                    user: 'alice',
                    submitted_at: '2026-05-15T00:10:00Z',
                    status: 'running',
                    jobs: [],
                    run_spec: {
                        run_name: 'train-a',
                        configuration: { type: 'task' },
                    },
                    cost: 0,
                    service: { url: 'https://notebook.example.com', model: null },
                } as unknown as IRun,
            ],
        );

        expect(summaries).toEqual([
            {
                id: 'run-1',
                name: 'train-a',
                projectName: 'research',
                applicant: 'alice',
                status: 'running',
                image: 'pytorch/pytorch:2.5.1-cuda12.4-cudnn9-runtime',
                resources: 'cpu=8 mem=32GB gpu=1',
                url: 'https://notebook.example.com',
                runDetailsPath: '/projects/research/runs/run-1',
                logsPath: '/projects/research/runs/run-1/logs',
            },
        ]);
    });
});
