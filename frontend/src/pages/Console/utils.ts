import { GlobalUserRole, ProjectUserRole } from 'types';

import { CONSOLE_ROUTES, LEGACY_CONSOLE_PATHS } from './constants';

type RunRequestStats = Record<TRunRequestStatus, number> & {
    total: number;
};

const navCopy = {
    zh: {
        dashboard: '工作台',
        runs: '运行任务',
        resources: '资源',
        fleets: '集群',
        instances: '实例',
        offers: '资源报价',
        models: '模型服务',
        volumes: '存储卷',
        workspace: '工作区',
        projects: '项目',
        admin: '管理',
        approvals: '审批',
        servers: '服务器管理',
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
        resources: 'Resources',
        fleets: 'Fleets',
        instances: 'Instances',
        offers: 'Offers',
        models: 'Models',
        volumes: 'Volumes',
        workspace: 'Workspace',
        projects: 'Projects',
        admin: 'Admin',
        approvals: 'Approvals',
        servers: 'Servers',
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

const parseEnv = (value: string): Record<string, string> | undefined => {
    const env = splitLines(value).reduce<Record<string, string>>((result, line) => {
        const separatorIndex = line.indexOf('=');
        if (separatorIndex < 0) {
            result[line] = '';
        } else {
            result[line.slice(0, separatorIndex).trim()] = line.slice(separatorIndex + 1);
        }
        return result;
    }, {});

    return Object.keys(env).length ? env : undefined;
};

const parsePorts = (value: string): number[] | undefined => {
    const ports = splitComma(value)
        .map((port) => Number(port))
        .filter((port) => Number.isInteger(port) && port > 0);
    return ports.length ? ports : undefined;
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

export const getConsoleNavSections = (role: IConsoleUserRole, locale: TLocale = 'zh'): IConsoleNavSection[] => {
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
                { label: text.servers, href: CONSOLE_ROUTES.ADMIN_SERVERS, icon: 'MonitorCog', adminOnly: true },
                ...(role.canUseGlobalAdmin
                    ? [
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
                ...(process.env.UI_VERSION === 'sky'
                    ? [{ label: text.billing, href: CONSOLE_ROUTES.ACCOUNT_BILLING, icon: 'CreditCard' }]
                    : []),
            ],
        },
    ].filter(Boolean) as IConsoleNavSection[];
};

export const canAccessConsoleRoute = (role: IConsoleUserRole, pathname: string, uiVersion = process.env.UI_VERSION): boolean => {
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
        /^\/resources\/runs\/[^/]+\/[^/]+/.test(pathname)
    ) {
        return true;
    }
    if (
        pathname === CONSOLE_ROUTES.ACCOUNT_PROFILE ||
        pathname === CONSOLE_ROUTES.ACCOUNT_KEYS ||
        pathname === CONSOLE_ROUTES.ACCOUNT_PROJECTS
    ) {
        return true;
    }
    if (pathname === CONSOLE_ROUTES.ACCOUNT_BILLING) {
        return uiVersion === 'sky';
    }
    if (pathname === CONSOLE_ROUTES.RUN_APPROVALS || pathname === CONSOLE_ROUTES.ADMIN_SERVERS) {
        return role.canUseProjectAdmin;
    }
    if (pathname.startsWith('/resources/') || pathname.startsWith('/workspace/projects')) {
        return role.canUseGlobalAdmin;
    }
    if (pathname.startsWith('/admin/users') || pathname === CONSOLE_ROUTES.ADMIN_EVENTS) {
        return role.canUseGlobalAdmin;
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

    return pathname.startsWith(`${itemHref}/`);
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
    if (values.cpu.trim()) resources.cpu = values.cpu.trim();
    if (values.memory.trim()) resources.memory = values.memory.trim();
    if (values.gpu.trim()) resources.gpu = values.gpu.trim();
    if (values.disk.trim()) resources.disk = values.disk.trim();

    const fleets = splitComma(values.fleets);

    return {
        project_name: values.project_name,
        request: {
            image: values.image.trim(),
            commands: splitLines(values.commands),
            name: values.name.trim() || undefined,
            env: parseEnv(values.env),
            ports: parsePorts(values.ports),
            nodes: Number(values.nodes) || 1,
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
