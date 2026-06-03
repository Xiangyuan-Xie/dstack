import { GlobalUserRole, ProjectUserRole } from 'types';

import { CONSOLE_ROUTES, LEGACY_CONSOLE_PATHS } from './constants';

type RunRequestStats = Record<TRunRequestStatus, number> & {
    total: number;
};

export type TNotificationCenterItem = {
    id: string;
    type: 'notification' | 'event';
    tone: 'success' | 'error' | 'info' | 'warning' | 'neutral';
    title: string;
    description?: string;
    recordedAt?: string;
};

const navCopy = {
    zh: {
        dashboard: '工作台',
        runs: '运行任务',
        devEnvironments: '开发环境',
        resources: '资源',
        fleets: '资源池',
        instances: '实例',
        offers: '资源报价',
        models: '模型服务',
        volumes: '存储卷',
        workspace: '工作区',
        projects: '项目',
        admin: '管理',
        approvals: '审批',
        settings: '系统设置',
        users: '用户管理',
        events: '系统事件',
        account: '账户',
        profile: '个人资料',
        keys: 'SSH 公钥',
        billing: '账单',
    },
    en: {
        dashboard: 'Dashboard',
        runs: 'Runs',
        devEnvironments: 'Development',
        resources: 'Resources',
        fleets: 'Resource pools',
        instances: 'Instances',
        offers: 'Pricing',
        models: 'Model services',
        volumes: 'Storage volumes',
        workspace: 'Workspace',
        projects: 'Projects',
        admin: 'Admin',
        approvals: 'Approvals',
        settings: 'System settings',
        users: 'Users',
        events: 'Events',
        account: 'Account',
        profile: 'Profile',
        keys: 'SSH Keys',
        billing: 'Billing',
    },
};

const splitLines = (value: string) =>
    value
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

const splitComma = (value: string) =>
    value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

const parseEnv = (value: string | TRunRequestEnvRow[]): Record<string, string> | undefined => {
    const env = (
        Array.isArray(value)
            ? value
            : splitLines(value).map((line) => {
                  const separatorIndex = line.indexOf('=');
                  return separatorIndex < 0
                      ? { key: line, value: '' }
                      : { key: line.slice(0, separatorIndex).trim(), value: line.slice(separatorIndex + 1) };
              })
    ).reduce<Record<string, string>>((result, row) => {
        const key = row.key.trim();
        if (key) {
            result[key] = row.value;
        }
        return result;
    }, {});

    return Object.keys(env).length ? env : undefined;
};

const parsePorts = (value: string | TRunRequestPortRow[]): Array<number | string> | undefined => {
    const ports = Array.isArray(value)
        ? value
              .map((row) => {
                  const container = row.container.trim();
                  const host = row.host.trim();
                  if (!container) return null;
                  const mapped = host ? `${host}:${container}` : container;
                  return row.protocol === 'udp' ? `${mapped}/udp` : mapped;
              })
              .filter((port): port is string => Boolean(port))
        : splitComma(value)
              .map((port) => Number(port))
              .filter((port) => Number.isInteger(port) && port > 0);
    return ports.length ? ports : undefined;
};

const parsePersistentDirs = (value: TRunRequestPersistentDir[]): TRunRequestPersistentDir[] | undefined => {
    const dirs = value
        .map((row) => {
            const hostPath = row.host_path.trim();
            const mountPath = row.mount_path.trim();
            if (!hostPath || !mountPath) return null;
            return {
                host_path: hostPath,
                mount_path: mountPath,
                read_only: row.read_only,
            };
        })
        .filter((dir): dir is TRunRequestPersistentDir => Boolean(dir));
    return dirs.length ? dirs : undefined;
};

export const getPreferredLocale = (storedLocale: string | null, browserLanguage?: string): TLocale => {
    if (storedLocale === 'zh' || storedLocale === 'en') {
        return storedLocale;
    }

    if (browserLanguage?.toLowerCase().startsWith('zh')) {
        return 'zh';
    }

    return 'zh';
};

export const getPreferredThemeMode = (storedMode: string | null, prefersDark: boolean): TThemeMode => {
    if (storedMode === 'light' || storedMode === 'dark') {
        return storedMode;
    }
    return prefersDark ? 'dark' : 'light';
};

export const applyConsoleTheme = (mode: TThemeMode): void => {
    document.documentElement.dataset.theme = mode;
    document.documentElement.classList.toggle('dark', mode === 'dark');
};

export const getConsoleUserRole = (projects: IProject[], user?: IUser | null): IConsoleUserRole => {
    const isGlobalAdmin = user?.global_role === GlobalUserRole.ADMIN;
    const manageableProjectNames = projects
        .filter((project) => {
            const projectRole =
                project.current_user_project_role ??
                project.members.find((member) => member.user.username === user?.username)?.project_role;
            return projectRole === ProjectUserRole.ADMIN || projectRole === ProjectUserRole.MANAGER;
        })
        .map((project) => project.project_name);

    return {
        isGlobalAdmin,
        canUseProjectAdmin: isGlobalAdmin || manageableProjectNames.length > 0,
        canUseGlobalAdmin: isGlobalAdmin,
        canManagePortal: isGlobalAdmin || manageableProjectNames.length > 0,
        manageableProjectNames,
    };
};

export const canManageConsoleProject = (role: IConsoleUserRole, projectName: string): boolean => {
    return role.isGlobalAdmin || role.manageableProjectNames.includes(projectName);
};

export const getConsoleNavSections = (
    role: IConsoleUserRole,
    locale: TLocale = 'zh',
    uiVersion = process.env.UI_VERSION,
): IConsoleNavSection[] => {
    const text = navCopy[locale] ?? navCopy.zh;

    return [
        {
            title: text.dashboard,
            items: [{ label: text.dashboard, href: CONSOLE_ROUTES.DASHBOARD, icon: 'LayoutDashboard' }],
        },
        {
            title: text.resources,
            items: [
                { label: text.runs, href: CONSOLE_ROUTES.RUNS, icon: 'PlayCircle' },
                { label: text.devEnvironments, href: CONSOLE_ROUTES.DEV_ENVIRONMENTS, icon: 'Laptop' },
                ...(role.canUseGlobalAdmin
                    ? [
                          { label: text.fleets, href: CONSOLE_ROUTES.RESOURCES_FLEETS, icon: 'Server' },
                          { label: text.instances, href: CONSOLE_ROUTES.RESOURCES_INSTANCES, icon: 'Cpu' },
                          { label: text.offers, href: CONSOLE_ROUTES.RESOURCES_OFFERS, icon: 'Tags' },
                          { label: text.models, href: CONSOLE_ROUTES.RESOURCES_MODELS, icon: 'BrainCircuit' },
                          { label: text.volumes, href: CONSOLE_ROUTES.RESOURCES_VOLUMES, icon: 'HardDrive' },
                      ]
                    : []),
            ],
        },
        role.canUseGlobalAdmin && {
            title: text.workspace,
            items: [{ label: text.projects, href: CONSOLE_ROUTES.WORKSPACE_PROJECTS, icon: 'FolderKanban' }],
        },
        role.canUseProjectAdmin && {
            title: text.admin,
            items: [
                { label: text.approvals, href: CONSOLE_ROUTES.RUN_APPROVALS, icon: 'ClipboardCheck', adminOnly: true },
                ...(role.canUseGlobalAdmin
                    ? [
                          { label: text.settings, href: CONSOLE_ROUTES.ADMIN_SETTINGS, icon: 'Settings', adminOnly: true },
                          { label: text.users, href: CONSOLE_ROUTES.ADMIN_USERS, icon: 'Users', adminOnly: true },
                          { label: text.events, href: CONSOLE_ROUTES.ADMIN_EVENTS, icon: 'Activity', adminOnly: true },
                      ]
                    : []),
            ],
        },
        {
            title: text.account,
            items: [
                { label: text.profile, href: CONSOLE_ROUTES.ACCOUNT_PROFILE, icon: 'UserCircle' },
                { label: text.keys, href: CONSOLE_ROUTES.ACCOUNT_KEYS, icon: 'KeyRound' },
                ...(uiVersion === 'sky'
                    ? [{ label: text.billing, href: CONSOLE_ROUTES.ACCOUNT_BILLING, icon: 'CreditCard' }]
                    : []),
            ],
        },
    ].filter(Boolean) as IConsoleNavSection[];
};

export const canAccessConsoleRoute = (
    role: IConsoleUserRole,
    pathname: string,
    uiVersion = process.env.UI_VERSION,
): boolean => {
    if (isLegacyConsolePath(pathname)) {
        // Legacy paths are handled by the router's Not Found page, not by the permission guard.
        return true;
    }
    if (pathname === '/' || pathname === CONSOLE_ROUTES.DASHBOARD) {
        return true;
    }
    if (
        pathname === CONSOLE_ROUTES.RUNS ||
        pathname === CONSOLE_ROUTES.RUN_CREATE ||
        pathname.startsWith('/resources/runs/requests/') ||
        /^\/resources\/runs\/[^/]+\/[^/]+/.test(pathname) ||
        pathname === CONSOLE_ROUTES.DEV_ENVIRONMENTS ||
        pathname === CONSOLE_ROUTES.DEV_ENVIRONMENT_CREATE ||
        pathname.startsWith('/resources/dev-environments/requests/') ||
        /^\/resources\/dev-environments\/[^/]+\/[^/]+/.test(pathname)
    ) {
        return true;
    }
    if (pathname === CONSOLE_ROUTES.ACCOUNT_PROFILE || pathname === CONSOLE_ROUTES.ACCOUNT_KEYS) {
        return true;
    }
    if (pathname === CONSOLE_ROUTES.ACCOUNT_BILLING) {
        return uiVersion === 'sky';
    }
    if (pathname === CONSOLE_ROUTES.RUN_APPROVALS) {
        return role.canUseProjectAdmin;
    }
    if (pathname.startsWith('/resources/') || pathname.startsWith('/workspace/projects')) {
        return role.canUseGlobalAdmin;
    }
    if (
        pathname.startsWith('/admin/users') ||
        pathname === CONSOLE_ROUTES.ADMIN_EVENTS ||
        pathname === CONSOLE_ROUTES.ADMIN_SETTINGS
    ) {
        return role.canUseGlobalAdmin;
    }
    if (pathname.startsWith('/admin/') || pathname.startsWith('/account/')) {
        return false;
    }
    return true;
};

export const isLegacyConsolePath = (pathname: string): boolean => {
    return LEGACY_CONSOLE_PATHS.some((legacyPath) => pathname === legacyPath || pathname.startsWith(`${legacyPath}/`));
};

export const isConsoleNavItemActive = (pathname: string, itemHref: string): boolean => {
    if (pathname === itemHref) {
        return true;
    }

    if (itemHref === CONSOLE_ROUTES.RUNS) {
        return (
            pathname === CONSOLE_ROUTES.RUN_CREATE ||
            pathname.startsWith('/resources/runs/requests/') ||
            /^\/resources\/runs\/[^/]+\/[^/]+/.test(pathname)
        );
    }

    if (itemHref === CONSOLE_ROUTES.DEV_ENVIRONMENTS) {
        return (
            pathname === CONSOLE_ROUTES.DEV_ENVIRONMENT_CREATE ||
            pathname.startsWith('/resources/dev-environments/requests/') ||
            /^\/resources\/dev-environments\/[^/]+\/[^/]+/.test(pathname)
        );
    }

    return pathname.startsWith(`${itemHref}/`);
};

export const formatEventActor = (actor: string | null | undefined, locale: TLocale): string => {
    return actor || (locale === 'zh' ? '系统' : 'system');
};

export const formatStatusLabel = (status: string | null | undefined, locale: TLocale): string => {
    if (!status) {
        return '-';
    }
    const normalized = status.toLowerCase();
    const labels: Record<string, { zh: string; en: string }> = {
        pending: { zh: '待处理', en: 'Pending' },
        pending_approval: { zh: '待审批', en: 'Pending approval' },
        approved: { zh: '已通过', en: 'Approved' },
        rejected: { zh: '已拒绝', en: 'Rejected' },
        failed: { zh: '失败', en: 'Failed' },
        running: { zh: '运行中', en: 'Running' },
        submitted: { zh: '已提交', en: 'Submitted' },
        provisioning: { zh: '创建中', en: 'Provisioning' },
        pulling: { zh: '拉取中', en: 'Pulling' },
        terminating: { zh: '停止中', en: 'Terminating' },
        terminated: { zh: '已终止', en: 'Terminated' },
        aborted: { zh: '已中止', en: 'Aborted' },
        done: { zh: '已完成', en: 'Done' },
        ready: { zh: '就绪', en: 'Ready' },
        active: { zh: '活跃', en: 'Active' },
        idle: { zh: '闲置', en: 'Idle' },
        busy: { zh: '占用', en: 'Busy' },
        warning: { zh: '警告', en: 'Warning' },
        error: { zh: '错误', en: 'Error' },
        enabled: { zh: '可用', en: 'Enabled' },
        disabled: { zh: '已停用', en: 'Disabled' },
        unreachable: { zh: '不可达', en: 'Unreachable' },
        unknown: { zh: '未知', en: 'Unknown' },
    };
    const label = labels[normalized];
    if (label) {
        return label[locale] ?? label.zh;
    }
    const titleCase = status
        .split(/[_\s-]+/)
        .filter(Boolean)
        .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');
    return locale === 'zh' ? titleCase || '未知状态' : titleCase;
};

export const formatEventMessage = (message: string, locale: TLocale): string => {
    if (locale !== 'zh') {
        return message;
    }
    const exactMessages: Record<string, string> = {
        'Project created': '项目已创建',
        'Project deleted': '项目已删除',
        'Project updated': '项目已更新',
        'User created': '用户已创建',
        'User updated': '用户已更新',
        'User deleted': '用户已删除',
        'Run submitted': '运行任务已提交',
        'Run updated': '运行任务已更新',
        'Run deleted': '运行任务已删除',
        'Run stopped': '运行任务已停止',
        'Fleet created': '资源池已创建',
        'Fleet updated': '资源池已更新',
        'Fleet deleted': '资源池已删除',
        'Instance created': '实例已创建',
        'Instance updated': '实例已更新',
        'Instance deleted': '实例已删除',
        'Volume created': '存储卷已创建',
        'Volume deleted': '存储卷已删除',
        'Gateway created': '网关已创建',
        'Gateway deleted': '网关已删除',
        'Secret created': '密钥已创建',
        'Secret updated': '密钥已更新',
        'Secret deleted': '密钥已删除',
        'Public key created': '公钥已创建',
        'Public key deleted': '公钥已删除',
        'Token refreshed': 'Token 已刷新',
    };
    if (exactMessages[message]) {
        return exactMessages[message];
    }
    const patterns: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
        [/^(.+) created$/, (match) => `${translateEventSubject(match[1])}已创建`],
        [/^(.+) updated$/, (match) => `${translateEventSubject(match[1])}已更新`],
        [/^(.+) deleted$/, (match) => `${translateEventSubject(match[1])}已删除`],
        [/^(.+) stopped$/, (match) => `${translateEventSubject(match[1])}已停止`],
        [
            /^(.+) submitted\. Status: (.+)$/,
            (match) => `${translateEventSubject(match[1])}已提交。状态：${formatStatusLabel(match[2], locale)}`,
        ],
        [
            /^(.+) created\. Status: (.+)$/,
            (match) => `${translateEventSubject(match[1])}已创建。状态：${formatStatusLabel(match[2], locale)}`,
        ],
        [/^(.+) updated\. Updated fields: (.+)$/, (match) => `${translateEventSubject(match[1])}已更新。字段：${match[2]}`],
        [/^(.+) updated\. Changed fields: (.+)$/, (match) => `${translateEventSubject(match[1])}已更新。字段：${match[2]}`],
        [
            /^(.+) status changed (.+) -> (.+) \((.+)\)$/,
            (match) =>
                `${translateEventSubject(match[1])}状态从 ${formatStatusLabel(match[2], locale)} 变为 ${formatStatusLabel(match[3], locale)}（${match[4]}）`,
        ],
        [
            /^(.+) status changed (.+) -> (.+)$/,
            (match) =>
                `${translateEventSubject(match[1])}状态从 ${formatStatusLabel(match[2], locale)} 变为 ${formatStatusLabel(match[3], locale)}`,
        ],
    ];

    for (const [pattern, formatter] of patterns) {
        const match = message.match(pattern);
        if (match) {
            return formatter(match);
        }
    }
    return message;
};

export const getNotificationCenterItems = (
    notifications: Array<{ id?: string; type?: string; header?: unknown; content?: unknown }>,
    events: IEvent[],
    locale: TLocale,
): TNotificationCenterItem[] => {
    const notificationItems = notifications.map<TNotificationCenterItem>((notification, index) => ({
        id: notification.id ?? `notification-${index}`,
        type: 'notification',
        tone:
            notification.type === 'success' || notification.type === 'error' || notification.type === 'warning'
                ? notification.type
                : 'info',
        title: stringifyNotificationNode(notification.header) || (locale === 'zh' ? '通知' : 'Notification'),
        description: stringifyNotificationNode(notification.content),
    }));
    const eventItems = events.map<TNotificationCenterItem>((event) => ({
        id: event.id,
        type: 'event',
        tone: 'neutral',
        title: formatEventMessage(event.message, locale),
        description: formatEventActor(event.actor_user, locale),
        recordedAt: event.recorded_at,
    }));
    return [...notificationItems, ...eventItems];
};

const translateEventSubject = (subject: string): string => {
    const subjects: Record<string, string> = {
        Project: '项目',
        User: '用户',
        Run: '运行任务',
        Job: '任务',
        Fleet: '资源池',
        Instance: '实例',
        Volume: '存储卷',
        Gateway: '网关',
        Secret: '密钥',
        Repository: '代码仓库',
        Repo: '代码仓库',
        'Public key': '公钥',
        Token: 'Token',
    };
    return subjects[subject] ?? subject;
};

const stringifyNotificationNode = (value: unknown): string | undefined => {
    if (value === null || value === undefined || typeof value === 'boolean') {
        return undefined;
    }
    if (typeof value === 'string' || typeof value === 'number') {
        return String(value);
    }
    return undefined;
};

export const getRunRequestStats = (requests: IRunRequest[]): RunRequestStats => {
    return requests.reduce<RunRequestStats>(
        (result, request) => {
            result.total += 1;
            result[request.status] += 1;
            return result;
        },
        {
            total: 0,
            pending: 0,
            approved: 0,
            rejected: 0,
            failed: 0,
        },
    );
};

export const buildRunRequestCreateParams = (values: IRunRequestFormValues): TRunRequestCreateParams => {
    const resources: TRunRequestResources = {};
    const resourceValue = (value: string) => {
        const trimmed = value.trim();
        if (!trimmed) return undefined;
        const parsed = Number(trimmed.replace(/[^\d.]/g, ''));
        if (Number.isFinite(parsed) && parsed === 0) return undefined;
        return trimmed;
    };
    const cpu = resourceValue(values.cpu);
    const memory = resourceValue(values.memory);
    const gpu = resourceValue(values.gpu);
    if (cpu) resources.cpu = cpu;
    if (memory) resources.memory = memory;
    if (gpu) resources.gpu = gpu;

    const fleets = splitComma(values.fleets);

    return {
        project_name: values.project_name,
        request: {
            image: values.image.trim(),
            run_type: values.run_type,
            commands: splitLines(values.commands),
            init: values.run_type === 'dev-environment' ? splitLines(values.init) : undefined,
            ide: values.run_type === 'dev-environment' ? values.ide || undefined : undefined,
            inactivity_duration:
                values.run_type === 'dev-environment' ? values.inactivity_duration.trim() || undefined : undefined,
            name: values.name.trim() || undefined,
            entrypoint: values.entrypoint.trim() || undefined,
            working_dir: values.working_dir.trim() || undefined,
            env: values.run_type === 'task' ? parseEnv(values.env) : undefined,
            ports: values.run_type === 'task' ? parsePorts(values.ports) : undefined,
            persistent_dirs: parsePersistentDirs(values.persistent_dirs),
            nodes: 1,
            resources: Object.keys(resources).length ? resources : undefined,
            max_duration: values.max_duration.trim() || undefined,
            fleets: fleets.length ? fleets : undefined,
        },
    };
};

export const formatRunRequestResourcesText = (request: IRunRequestSpec): string => {
    const resources = request.resources ?? {};
    const parts: string[] = [];

    if (request.nodes && request.nodes > 1) {
        parts.push(`nodes=${request.nodes}`);
    }
    if (resources.cpu) {
        parts.push(`cpu=${resources.cpu}`);
    }
    if (resources.memory) {
        parts.push(`mem=${resources.memory}`);
    }
    if (resources.disk) {
        const disk = typeof resources.disk === 'object' && 'size' in resources.disk ? resources.disk.size : resources.disk;
        parts.push(`disk=${disk}`);
    }
    if (resources.gpu) {
        parts.push(`gpu=${typeof resources.gpu === 'object' ? JSON.stringify(resources.gpu) : resources.gpu}`);
    }

    return parts.join(' ') || '-';
};

export const formatResourcePoolGpuText = (
    resources: Pick<IResourcePoolResources, 'gpu_count' | 'gpus'> | null | undefined,
    locale: TLocale,
): string => {
    if (!resources?.gpu_count) {
        return locale === 'zh' ? '无 GPU' : 'No GPU';
    }
    const gpuText = resources.gpus
        .map((gpu) => {
            const memory = gpu.memory_gib ? ` ${gpu.memory_gib}GiB` : '';
            return `${gpu.name} x${gpu.count}${memory}`;
        })
        .join(', ');
    return gpuText || `${resources.gpu_count} GPU`;
};

export const formatResourcePoolResourceText = (
    resources: IResourcePoolResources | IResourcePoolResourceSummary | null | undefined,
    locale: TLocale,
): string => {
    if (!resources) {
        return '-';
    }
    const gpuCount = resources.gpu_count ?? 0;
    const gpuMemoryGiB = resources.gpus.reduce((sum, gpu) => sum + (gpu.memory_gib ?? 0) * gpu.count, 0);
    const gpuText = gpuCount
        ? gpuMemoryGiB
            ? `${gpuCount} ${locale === 'zh' ? '张' : 'GPU'} / ${gpuMemoryGiB}GiB`
            : `${gpuCount} ${locale === 'zh' ? '张' : 'GPU'}`
        : locale === 'zh'
          ? '无 GPU'
          : 'No GPU';
    const parts = [
        `${resources.cpu_count ?? 0} ${locale === 'zh' ? '核心' : 'cores'}`,
        `${resources.memory_gib ?? 0}GiB`,
        gpuText,
        `${resources.disk_gib ?? 0}GiB`,
    ];
    return parts.join(' / ');
};

export const getRunSummariesFromRequests = (requests: IRunRequest[], runs: IRun[] = []): IRunSummary[] => {
    return requests
        .filter((request) => request.status === 'approved' && request.run_id)
        .map((request) => {
            const run = runs.find((item) => item.id === request.run_id);
            const runId = request.run_id ?? '';

            return {
                id: runId,
                name: request.run_name || request.request.name || runId,
                projectName: request.project_name,
                applicant: request.applicant,
                status: run?.status ?? request.status,
                image: request.request.image,
                resources: formatRunRequestResourcesText(request.request),
                url: run?.service?.url,
                requestDetailsPath: CONSOLE_ROUTES.RUN_REQUEST_DETAILS.FORMAT(request.project_name, request.id),
                runDetailsPath: CONSOLE_ROUTES.RUN_DETAILS.FORMAT(request.project_name, runId),
                logsPath: `${CONSOLE_ROUTES.RUN_DETAILS.FORMAT(request.project_name, runId)}#logs`,
            };
        });
};

export const statusTone = (status?: string | null): 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'pending' => {
    if (!status) {
        return 'neutral';
    }
    if (['running', 'approved', 'done', 'ready', 'active'].includes(status)) {
        return 'success';
    }
    if (['pending', 'submitted', 'provisioning', 'pulling', 'terminating'].includes(status)) {
        return 'pending';
    }
    if (['failed', 'rejected', 'aborted', 'terminated', 'error'].includes(status)) {
        return 'danger';
    }
    if (['warning', 'busy'].includes(status)) {
        return 'warning';
    }
    return 'info';
};
