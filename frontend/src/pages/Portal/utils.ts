import { ROUTES } from 'routes';
import { GlobalUserRole, ProjectUserRole } from 'types';

import { PORTAL_ROUTES } from './constants';

type GpuRequestStats = Record<TGpuRequestStatus, number> & {
    total: number;
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

export const getPortalUserRole = (projects: IProject[], user?: IUser | null): IPortalUserRole => {
    const isGlobalAdmin = user?.global_role === GlobalUserRole.ADMIN;
    const manageableProjectNames = projects
        .filter((project) => {
            const projectRole = project.members.find((member) => member.user.username === user?.username)?.project_role;
            return projectRole === ProjectUserRole.ADMIN || projectRole === ProjectUserRole.MANAGER;
        })
        .map((project) => project.project_name);

    return {
        isGlobalAdmin,
        canManagePortal: isGlobalAdmin || manageableProjectNames.length > 0,
        manageableProjectNames,
    };
};

export const getPortalNavItems = (role: IPortalUserRole): IPortalNavItem[] =>
    [
        { label: '工作台', href: PORTAL_ROUTES.DASHBOARD },
        { label: 'GPU 申请', href: PORTAL_ROUTES.GPU_REQUESTS },
        role.canManagePortal
            ? { label: '容器管理', href: PORTAL_ROUTES.ADMIN_CONTAINERS, adminOnly: true }
            : { label: '我的容器', href: PORTAL_ROUTES.GPU_CONTAINERS },
        role.canManagePortal && { label: '审批中心', href: PORTAL_ROUTES.ADMIN_APPROVALS, adminOnly: true },
        role.canManagePortal && { label: '服务器管理', href: PORTAL_ROUTES.ADMIN_SERVERS, adminOnly: true },
        role.canManagePortal && { label: '高级控制台', href: PORTAL_ROUTES.CONSOLE, adminOnly: true },
    ].filter(Boolean) as IPortalNavItem[];

export const canManagePortalProject = (role: IPortalUserRole, projectName: string): boolean => {
    return role.isGlobalAdmin || role.manageableProjectNames.includes(projectName);
};

export const getGpuRequestStats = (requests: IGpuRequest[]): GpuRequestStats => {
    return requests.reduce<GpuRequestStats>(
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

export const buildGpuRequestCreateParams = (values: IGpuRequestFormValues): TGpuRequestCreateParams => {
    const resources: TGpuRequestResources = {};
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

export const formatGpuRequestResourcesText = (request: IGpuRequestSpec): string => {
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

export const getContainerSummaries = (requests: IGpuRequest[], runs: IRun[] = []): IContainerSummary[] => {
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
                resources: formatGpuRequestResourcesText(request.request),
                url: run?.service?.url,
                runDetailsPath: ROUTES.PROJECT.DETAILS.RUNS.DETAILS.FORMAT(request.project_name, runId),
                logsPath: ROUTES.PROJECT.DETAILS.RUNS.DETAILS.LOGS.FORMAT(request.project_name, runId),
            };
        });
};

export const isPortalPath = (pathname: string): boolean => {
    return (
        pathname === ROUTES.BASE ||
        pathname === PORTAL_ROUTES.DASHBOARD ||
        pathname.startsWith('/gpu/') ||
        pathname.startsWith('/admin/') ||
        pathname === PORTAL_ROUTES.CONSOLE
    );
};
