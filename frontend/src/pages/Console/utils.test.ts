import {
    buildGpuRequestCreateParams,
    canAccessConsoleRoute,
    getConsoleNavSections,
    getConsoleUserRole,
    getContainerSummaries,
    getGpuRequestStats,
    getPreferredLocale,
    getPreferredThemeMode,
    isLegacyConsolePath,
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

const roleOnlyManagedProject = {
    ...project,
    project_name: 'ops',
    members: [],
    current_user_project_role: 'manager',
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

describe('Console utils', () => {
    test('builds member navigation without admin or legacy console links', () => {
        const role = getConsoleUserRole([project], user);
        const labels = getConsoleNavSections(role, 'zh').flatMap((section) => section.items.map((item) => item.label));

        expect(labels).toEqual(expect.arrayContaining(['工作台', 'GPU 申请', '我的容器', '个人资料', 'SSH 公钥']));
        expect(labels).not.toContain('运行任务');
        expect(labels).not.toContain('项目');
        expect(labels).not.toContain('审批中心');
        expect(labels).not.toContain('用户管理');
        expect(labels).not.toContain('系统事件');
        expect(labels).not.toContain('高级控制台');
    });

    test('builds project admin navigation from current user role without global admin links', () => {
        const role = getConsoleUserRole([project, roleOnlyManagedProject], user);
        const labels = getConsoleNavSections(role, 'zh').flatMap((section) => section.items.map((item) => item.label));

        expect(labels).toEqual(expect.arrayContaining(['工作台', 'GPU 申请', '我的容器', '审批中心', '容器管理', '服务器管理']));
        expect(labels).not.toContain('运行任务');
        expect(labels).not.toContain('项目');
        expect(labels).not.toContain('用户管理');
        expect(labels).not.toContain('系统事件');
    });

    test('builds project admin navigation from members fallback without global admin links', () => {
        const role = getConsoleUserRole([project, managedProject], user);
        const labels = getConsoleNavSections(role, 'zh').flatMap((section) => section.items.map((item) => item.label));

        expect(labels).toEqual(expect.arrayContaining(['工作台', 'GPU 申请', '我的容器', '审批中心', '容器管理', '服务器管理']));
        expect(labels).not.toContain('运行任务');
        expect(labels).not.toContain('项目');
        expect(labels).not.toContain('用户管理');
        expect(labels).not.toContain('系统事件');
    });

    test('builds global admin navigation with resource and global admin links', () => {
        const role = getConsoleUserRole([project], admin);
        const labels = getConsoleNavSections(role, 'zh').flatMap((section) => section.items.map((item) => item.label));

        expect(labels).toEqual(
            expect.arrayContaining(['运行任务', '集群', '实例', '项目', '审批中心', '容器管理', '服务器管理', '用户管理', '系统事件']),
        );
        expect(labels).not.toContain('高级控制台');
    });

    test('detects project admins from current user role as console admins', () => {
        const role = getConsoleUserRole([project, roleOnlyManagedProject], user);

        expect(role.canManagePortal).toBe(true);
        expect(role.canUseProjectAdmin).toBe(true);
        expect(role.canUseGlobalAdmin).toBe(false);
        expect(role.manageableProjectNames).toEqual(['ops']);
    });

    test('detects project admins from members fallback as console admins', () => {
        const role = getConsoleUserRole([project, managedProject], user);

        expect(role.canManagePortal).toBe(true);
        expect(role.canUseProjectAdmin).toBe(true);
        expect(role.canUseGlobalAdmin).toBe(false);
        expect(role.manageableProjectNames).toEqual(['training']);
    });

    test('allows regular users only into the GPU portal and account pages', () => {
        const role = getConsoleUserRole([project], user);

        expect(canAccessConsoleRoute(role, '/dashboard')).toBe(true);
        expect(canAccessConsoleRoute(role, '/gpu/requests/research/req-1')).toBe(true);
        expect(canAccessConsoleRoute(role, '/gpu/containers')).toBe(true);
        expect(canAccessConsoleRoute(role, '/account/profile')).toBe(true);
        expect(canAccessConsoleRoute(role, '/resources/runs')).toBe(false);
        expect(canAccessConsoleRoute(role, '/workspace/projects')).toBe(false);
        expect(canAccessConsoleRoute(role, '/admin/users')).toBe(false);
        expect(canAccessConsoleRoute(role, '/admin/events')).toBe(false);
    });

    test('separates project admin routes from global admin routes', () => {
        const projectRole = getConsoleUserRole([project, managedProject], user);
        const globalRole = getConsoleUserRole([project], admin);

        expect(canAccessConsoleRoute(projectRole, '/admin/approvals')).toBe(true);
        expect(canAccessConsoleRoute(projectRole, '/admin/containers')).toBe(true);
        expect(canAccessConsoleRoute(projectRole, '/admin/servers')).toBe(true);
        expect(canAccessConsoleRoute(projectRole, '/admin/users')).toBe(false);
        expect(canAccessConsoleRoute(projectRole, '/resources/runs')).toBe(false);
        expect(canAccessConsoleRoute(globalRole, '/admin/users')).toBe(true);
        expect(canAccessConsoleRoute(globalRole, '/resources/runs')).toBe(true);
    });

    test('leaves legacy URLs to the Not Found route instead of permission blocking them', () => {
        const role = getConsoleUserRole([project], user);

        expect(canAccessConsoleRoute(role, '/runs')).toBe(true);
        expect(canAccessConsoleRoute(role, '/projects')).toBe(true);
    });

    test('keeps old top-level console URLs out of the new router', () => {
        expect(isLegacyConsolePath('/runs')).toBe(true);
        expect(isLegacyConsolePath('/projects')).toBe(true);
        expect(isLegacyConsolePath('/fleets')).toBe(true);
        expect(isLegacyConsolePath('/users')).toBe(true);
        expect(isLegacyConsolePath('/dashboard')).toBe(false);
        expect(isLegacyConsolePath('/resources/runs')).toBe(false);
    });

    test('prefers Chinese and persists explicit locale choices', () => {
        expect(getPreferredLocale(null, 'en-US')).toBe('zh');
        expect(getPreferredLocale('en', 'zh-CN')).toBe('en');
        expect(getPreferredLocale('zh', 'en-US')).toBe('zh');
    });

    test('uses saved theme mode before system preference', () => {
        expect(getPreferredThemeMode('dark', false)).toBe('dark');
        expect(getPreferredThemeMode('light', true)).toBe('light');
        expect(getPreferredThemeMode(null, true)).toBe('dark');
    });

    test('converts the GPU request form into the API shape', () => {
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
                requestDetailsPath: '/gpu/requests/research/req-1',
                runDetailsPath: '/resources/runs/research/run-1',
                logsPath: '/resources/runs/research/run-1#logs',
            },
        ]);
    });
});
