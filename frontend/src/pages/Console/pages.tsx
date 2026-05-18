import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { Activity, ArrowLeft, Check, Copy, Pencil, Plus, RefreshCcw, Save, UserCircle, X } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
    Button,
    CodeBlock,
    DataTable,
    EmptyState,
    Field,
    MetricCard,
    Modal,
    PageHeader,
    Panel,
    SearchInput,
    SelectInput,
    StatusBadge,
    TextArea,
    TextInput,
} from 'ui';

import { useConfirmationDialog, useNotifications } from 'hooks';
import { useAppSelector } from 'hooks';
import { centsToFormattedString, copyToClipboard } from 'libs';
import { formatFleetBackend } from 'libs/fleet';
import { formatResources } from 'libs/resources';
import { runStatusForDeleting, runStatusForStopping } from 'libs/runStatus';
import { useGetFeishuConfigQuery, useUpdateFeishuConfigMutation } from 'services/adminOAuth';
import { useDeleteProjectBackendMutation, useGetProjectBackendsQuery } from 'services/backend';
import { useGetAllEventsQuery } from 'services/events';
import { useGetGpusListQuery } from 'services/gpu';
import { useGetInstancesQuery } from 'services/instance';
import {
    useAddProjectMemberMutation,
    useCreateProjectMutation,
    useDeleteProjectsMutation,
    useGetProjectLogsQuery,
    useGetProjectQuery,
    useGetProjectReposQuery,
    useGetProjectsQuery,
    useRemoveProjectMemberMutation,
    useUpdateProjectMutation,
} from 'services/project';
import { useAddPublicKeyMutation, useDeletePublicKeysMutation, useListPublicKeysQuery } from 'services/publicKeys';
import {
    useCreateResourcePoolMutation,
    useDeleteResourcePoolsMutation,
    useGetProjectResourcePoolsQuery,
    useGetResourcePoolDetailsQuery,
    useGetResourcePoolsQuery,
    useUpdateResourcePoolAssignmentMutation,
    useUpdateResourcePoolMutation,
} from 'services/resourcePool';
import {
    useApplyRunMutation,
    useDeleteRunsMutation,
    useGetMetricsQuery,
    useGetModelsQuery,
    useGetRunQuery,
    useGetRunsQuery,
    useStopRunsMutation,
} from 'services/run';
import { useGetRuntimeImagesQuery, useUpdateRuntimeImagesMutation } from 'services/runtimeImages';
import {
    useApproveRunRequestMutation,
    useCreateRunRequestMutation,
    useGetAllRunRequestsQuery,
    useGetRunRequestQuery,
    useRejectRunRequestMutation,
    useRetryRunRequestMutation,
} from 'services/runRequest';
import { useDeleteSecretsMutation, useGetAllSecretsQuery, useUpdateSecretMutation } from 'services/secrets';
import {
    useCreateUserMutation,
    useDeleteUsersMutation,
    useGetUserBillingInfoQuery,
    useGetUserListQuery,
    useGetUserQuery,
    useLazyGetUserListQuery,
    useRefreshTokenMutation,
    useUpdateMyUserMutation,
    useUpdateUserMutation,
} from 'services/user';
import { useDeleteVolumesMutation, useGetAllVolumesQuery } from 'services/volume';
import {
    useCreateWorkerRegistrationTokenMutation,
    useDeleteWorkerRegistrationTokenMutation,
    useGetWorkerRegistrationTokensQuery,
} from 'services/worker';

import { getBaseUrl } from 'App/helpers';
import { selectUserData } from 'App/slice';

import { CONSOLE_ROUTES } from './constants';
import { useConsoleContext } from './Layout';
import {
    buildRunRequestCreateParams,
    canManageConsoleProject,
    formatEventActor,
    formatEventMessage,
    formatRunRequestResourcesText,
    formatStatusLabel,
    getRunRequestStats,
    statusTone,
} from './utils';

const formatDate = (value?: string | number | Date | null) => {
    if (!value) return '-';
    try {
        return format(new Date(value), 'yyyy-MM-dd HH:mm');
    } catch {
        return String(value);
    }
};

const formatDateWithSeconds = (value?: string | number | Date | null) => {
    if (!value) return '-';
    try {
        return format(new Date(value), 'yyyy-MM-dd HH:mm:ss');
    } catch {
        return String(value);
    }
};

const valueOrDash = (value?: React.ReactNode | null) => (value === null || value === undefined || value === '' ? '-' : value);

const RESOURCE_NAME_REGEX = /^[a-z][a-z0-9-]{1,40}$/;

const useLocaleText = () => {
    const { locale } = useConsoleContext();
    return {
        locale,
        isZh: locale === 'zh',
        text: (zh: string, en: string) => (locale === 'zh' ? zh : en),
        emptyTitle: locale === 'zh' ? '暂无数据' : 'No data',
    };
};

const ProfileInfoItem = ({ label, value }: { label: React.ReactNode; value: React.ReactNode }) => (
    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
        <div className="mt-2 break-words text-sm font-semibold text-slate-950 dark:text-slate-50">{value}</div>
    </div>
);

const getProfileRoleText = (role: IConsoleUserRole, locale: TLocale) => {
    if (role.canUseGlobalAdmin) {
        return locale === 'zh' ? '最高管理员' : 'Global administrator';
    }
    if (role.canUseProjectAdmin) {
        return locale === 'zh' ? '项目管理员' : 'Project administrator';
    }
    return locale === 'zh' ? '普通用户' : 'Regular user';
};

const getUserRoleText = (globalRole: TUserRole | null | undefined, locale: TLocale) => {
    if (globalRole === 'admin') {
        return locale === 'zh' ? '最高管理员' : 'Global administrator';
    }
    return locale === 'zh' ? '普通用户' : 'Regular user';
};

const getProjectRoleText = (projectRole: TProjectRole | null | undefined, locale: TLocale) => {
    if (projectRole === 'admin') {
        return locale === 'zh' ? '项目拥有者' : 'Project owner';
    }
    if (projectRole === 'manager') {
        return locale === 'zh' ? '项目管理员' : 'Project administrator';
    }
    return locale === 'zh' ? '项目成员' : 'Project member';
};

const formatFleetType = (
    fleet: Pick<IFleet, 'spec'> & { instances: Array<Pick<IInstance, 'backend'> | IResourcePoolInstance> },
    locale: TLocale,
) => {
    if (fleet.spec.profile?.name === 'registered' || fleet.instances.some((instance) => instance.backend === 'registered')) {
        return locale === 'zh' ? '自有服务器' : 'Self-hosted server';
    }
    return formatFleetBackend(fleet.spec.configuration);
};

const formatUsagePercent = (value?: number | null) => {
    if (value === null || value === undefined) return null;
    return `${Math.round(value)}%`;
};

const formatUsageGiB = (used?: number | null, total?: number | null) => {
    if (used === null || used === undefined || total === null || total === undefined) return null;
    return `${used} / ${total}GiB`;
};

const formatCpuCapacity = (cpuCount: number | null | undefined, locale: TLocale) =>
    `${cpuCount ?? 0} ${locale === 'zh' ? '核心' : 'cores'}`;

const formatAggregateGpuCapacity = (
    resources: Pick<IResourcePoolResources, 'gpu_count' | 'gpus'> | null | undefined,
    locale: TLocale,
) => {
    const gpuCount = resources?.gpu_count ?? 0;
    if (!gpuCount) {
        return locale === 'zh' ? '无 GPU' : 'No GPU';
    }
    const memoryGiB = resources?.gpus.reduce((sum, gpu) => sum + (gpu.memory_gib ?? 0) * gpu.count, 0) ?? 0;
    const gpuUnit = locale === 'zh' ? '张' : 'GPU';
    return memoryGiB ? `${gpuCount} ${gpuUnit} / ${memoryGiB}GiB` : `${gpuCount} ${gpuUnit}`;
};

const formatDetailedGpuCapacity = (
    resources: Pick<IResourcePoolResources, 'gpu_count' | 'gpus'> | null | undefined,
    locale: TLocale,
) => {
    if (!resources?.gpu_count) {
        return locale === 'zh' ? '无 GPU' : 'No GPU';
    }
    const gpuText = resources.gpus
        .map((gpu) => {
            const memory = gpu.memory_gib ? ` / ${gpu.memory_gib}GiB` : '';
            return `${gpu.name} x${gpu.count}${memory}`;
        })
        .join(', ');
    return gpuText || `${resources.gpu_count} GPU`;
};

const ProjectChips = ({ names }: { names: string[] | null | undefined }) => {
    const visibleNames = (names ?? []).filter(Boolean);
    if (visibleNames.length === 0) {
        return <span className="text-sm text-slate-500 dark:text-slate-400">-</span>;
    }

    return (
        <div className="flex min-w-0 flex-wrap gap-1.5">
            {visibleNames.map((name) => (
                <span
                    key={name}
                    className="inline-flex max-w-full items-center rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200"
                >
                    <span className="truncate">{name}</span>
                </span>
            ))}
        </div>
    );
};

const ResourceSummaryStack = ({
    resources,
    locale,
    detailedGpu = false,
}: {
    resources: IResourcePoolResources | IResourcePoolResourceSummary | null | undefined;
    locale: TLocale;
    detailedGpu?: boolean;
}) => {
    const text = (zh: string, en: string) => (locale === 'zh' ? zh : en);
    if (!resources) return <span>-</span>;
    const rows = [
        { label: 'CPU', value: formatCpuCapacity(resources.cpu_count, locale) },
        { label: text('内存', 'Memory'), value: `${resources.memory_gib ?? 0}GiB` },
        {
            label: 'GPU',
            value: detailedGpu ? formatDetailedGpuCapacity(resources, locale) : formatAggregateGpuCapacity(resources, locale),
        },
        { label: text('磁盘', 'Disk'), value: `${resources.disk_gib ?? 0}GiB` },
    ];

    return (
        <div className="grid min-w-40 gap-1.5 text-sm text-slate-700 dark:text-slate-200">
            {rows.map((row) => (
                <div key={row.label} className="flex min-w-0 items-center justify-between gap-3">
                    <span className="shrink-0 text-xs font-semibold text-slate-500 dark:text-slate-400">{row.label}</span>
                    <span className="min-w-0 whitespace-normal break-words text-right font-semibold">{row.value}</span>
                </div>
            ))}
        </div>
    );
};

const formatAggregateResourceCapacity = (resources: IResourcePoolResources | IResourcePoolResourceSummary, locale: TLocale) => {
    return [
        formatCpuCapacity(resources.cpu_count, locale),
        `${resources.memory_gib ?? 0}GiB`,
        formatAggregateGpuCapacity(resources, locale),
        `${resources.disk_gib ?? 0}GiB`,
    ].join(' / ');
};

const UsageMeter = ({ label, value, percent }: { label: React.ReactNode; value: string; percent?: number | null }) => {
    const width = Math.max(0, Math.min(100, percent ?? 0));
    return (
        <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/40">
            <div className="flex min-w-0 items-start justify-between gap-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <span className="shrink-0">{label}</span>
                <span className="min-w-0 whitespace-normal break-words text-right text-slate-900 dark:text-slate-100">
                    {value}
                </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div className="h-full rounded-full bg-teal-500" style={{ width: `${width}%` }} />
            </div>
        </div>
    );
};

const ResourceUsageDashboard = ({
    usage,
    locale,
    compact = false,
}: {
    usage?: IResourcePoolUsage | IResourcePoolUsageSummary | null;
    locale: TLocale;
    compact?: boolean;
}) => {
    const text = (zh: string, en: string) => (locale === 'zh' ? zh : en);
    const meters = [
        {
            key: 'cpu',
            label: 'CPU',
            value: formatUsagePercent(usage?.cpu_percent),
            percent: usage?.cpu_percent,
        },
        {
            key: 'memory',
            label: text('内存', 'Memory'),
            value: formatUsageGiB(usage?.memory_used_gib, usage?.memory_total_gib),
            percent:
                usage?.memory_used_gib !== null && usage?.memory_used_gib !== undefined && usage?.memory_total_gib
                    ? (usage.memory_used_gib / usage.memory_total_gib) * 100
                    : null,
        },
        {
            key: 'gpu-memory',
            label: text('GPU 显存', 'GPU memory'),
            value: formatUsageGiB(usage?.gpu_memory_used_gib, usage?.gpu_memory_total_gib),
            percent:
                usage?.gpu_memory_used_gib !== null && usage?.gpu_memory_used_gib !== undefined && usage?.gpu_memory_total_gib
                    ? (usage.gpu_memory_used_gib / usage.gpu_memory_total_gib) * 100
                    : null,
        },
        {
            key: 'gpu-util',
            label: text('GPU 利用率', 'GPU util'),
            value: formatUsagePercent(usage?.gpu_util_percent),
            percent: usage?.gpu_util_percent,
        },
        {
            key: 'disk',
            label: text('磁盘', 'Disk'),
            value: formatUsageGiB(usage?.disk_used_gib, usage?.disk_total_gib),
            percent:
                usage?.disk_used_gib !== null && usage?.disk_used_gib !== undefined && usage?.disk_total_gib
                    ? (usage.disk_used_gib / usage.disk_total_gib) * 100
                    : null,
        },
    ].filter((meter) => meter.value);

    if (meters.length === 0) {
        return (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/70 px-4 py-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
                {text('暂无使用数据', 'No usage data')}
            </div>
        );
    }

    return (
        <div className={compact ? 'grid min-w-96 gap-2 xl:grid-cols-2' : 'grid gap-3 sm:grid-cols-2 xl:grid-cols-5'}>
            {meters.map((meter) => (
                <UsageMeter key={meter.key} label={meter.label} value={meter.value!} percent={meter.percent} />
            ))}
        </div>
    );
};

type RunResourceLimitKey = 'nodes' | 'gpu' | 'cpu' | 'memory' | 'disk';

type RunResourceLimits = Record<RunResourceLimitKey, number>;

const getRunResourceLimits = (resourcePools: IResourcePool[], selectedFleetName: string): RunResourceLimits => {
    const selectedPools = selectedFleetName
        ? resourcePools.filter((pool) => pool.name === selectedFleetName)
        : resourcePools;
    const instances = selectedPools.flatMap((pool) => pool.instances);
    return instances.reduce<RunResourceLimits>(
        (limits, instance) => ({
            nodes: limits.nodes + 1,
            gpu: Math.max(limits.gpu, instance.resources.gpu_count ?? 0),
            cpu: Math.max(limits.cpu, instance.resources.cpu_count ?? 0),
            memory: Math.max(limits.memory, instance.resources.memory_gib ?? 0),
            disk: Math.max(limits.disk, instance.resources.disk_gib ?? 0),
        }),
        { nodes: 0, gpu: 0, cpu: 0, memory: 0, disk: 0 },
    );
};

const parseResourceNumber = (value: string): number | null => {
    if (!value.trim()) return null;
    const parsed = Number(value.replace(/[^\d.]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
};

const formatResourceFormValue = (key: RunResourceLimitKey, value: number) =>
    key === 'memory' || key === 'disk' ? `${value}GB` : String(value);

const clampResourceFormValue = (key: RunResourceLimitKey, value: string, max: number) => {
    const parsed = parseResourceNumber(value);
    if (parsed === null) return value;
    const min = key === 'nodes' ? 1 : 0;
    return formatResourceFormValue(key, Math.max(min, Math.min(parsed, Math.max(max, min))));
};

const formatDurationFormValue = (hours: number) => `${Math.max(1, Math.min(hours, 168))}h`;

const ResourceSliderField = ({
    label,
    sliderLabel,
    inputLabel,
    value,
    max,
    min = 0,
    step = 1,
    unit,
    maxLabel = 'Max',
    onChange,
}: {
    label: string;
    sliderLabel: string;
    inputLabel: string;
    value: string;
    max: number;
    min?: number;
    step?: number;
    unit: string;
    maxLabel?: string;
    onChange: (value: string) => void;
}) => {
    const numericValue = parseResourceNumber(value);
    const boundedMax = Math.max(max, min);
    const rangeValue = Math.max(min, Math.min(numericValue ?? min, boundedMax));
    const inputValue = numericValue === null ? '' : String(numericValue);

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950/40 dark:shadow-none">
            <div className="flex min-w-0 items-start justify-between gap-4">
                <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-950 dark:text-slate-50">{label}</div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {maxLabel}: {boundedMax} {unit}
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 dark:border-slate-800 dark:bg-slate-900">
                    <TextInput
                        aria-label={inputLabel}
                        type="number"
                        min={min}
                        max={boundedMax}
                        step={step}
                        value={inputValue}
                        className="h-8 w-20 border-0 bg-transparent px-1 text-right text-sm font-semibold shadow-none focus:ring-0"
                        onChange={(event) => onChange(event.target.value)}
                    />
                    {unit && (
                        <span className="shrink-0 text-xs font-semibold text-slate-500 dark:text-slate-400">
                            {unit}
                        </span>
                    )}
                </div>
            </div>
            <input
                aria-label={sliderLabel}
                className="mt-4 h-1.5 w-full cursor-pointer accent-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                type="range"
                min={min}
                max={boundedMax}
                step={step}
                value={rangeValue}
                disabled={boundedMax <= min}
                onChange={(event) => onChange(event.target.value)}
            />
        </div>
    );
};

const useFilteredItems = <T,>(items: T[], query: string, fields: Array<(item: T) => string | null | undefined>) => {
    return useMemo(() => {
        const normalized = query.trim().toLowerCase();
        if (!normalized) return items;
        return items.filter((item) => fields.some((field) => field(item)?.toLowerCase().includes(normalized)));
    }, [fields, items, query]);
};

const RequestStatus = ({ status }: { status?: TRunRequestStatus | TJobStatus | string | null }) => {
    const { locale } = useLocaleText();
    return <StatusBadge tone={statusTone(status)}>{formatStatusLabel(status, locale)}</StatusBadge>;
};

const DetailGrid: React.FC<{ items: Array<{ label: React.ReactNode; value: React.ReactNode }> }> = ({ items }) => (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, index) => (
            <ProfileInfoItem key={`${item.label}-${index}`} label={item.label} value={valueOrDash(item.value)} />
        ))}
    </div>
);

type TUnifiedRunItem = {
    id: string;
    project_name: string;
    name: string;
    applicant: string;
    request_status?: TRunRequestStatus;
    run_status?: TJobStatus;
    resources: string;
    image?: string;
    service_url?: string | null;
    created_at?: string;
    submitted_at?: string;
    request?: IRunRequest;
    run?: IRun;
};

const getRunResourcesText = (run: IRun): string => {
    const resources = run.latest_job_submission?.job_provisioning_data?.instance_type?.resources;
    if (resources) {
        return formatResources(resources);
    }
    return '-';
};

const getUnifiedRunItems = (requests: IRunRequest[], runs: IRun[]): TUnifiedRunItem[] => {
    const runsById = new Map(runs.map((run) => [run.id, run]));
    const requestRunIds = new Set(requests.map((request) => request.run_id).filter(Boolean));
    const requestItems: TUnifiedRunItem[] = requests.map((request) => {
        const run = request.run_id ? runsById.get(request.run_id) : undefined;
        return {
            id: request.run_id ?? request.id,
            project_name: request.project_name,
            name: request.run_name ?? request.request.name ?? request.id,
            applicant: request.applicant,
            request_status: request.status,
            run_status: run?.status,
            resources: formatRunRequestResourcesText(request.request),
            image: request.request.image,
            service_url: run?.service?.url,
            created_at: request.created_at,
            submitted_at: run?.submitted_at,
            request,
            run,
        };
    });
    const directRunItems = runs
        .filter((run) => !requestRunIds.has(run.id))
        .map<TUnifiedRunItem>((run) => ({
            id: run.id,
            project_name: run.project_name,
            name: run.run_spec.run_name ?? run.id,
            applicant: run.user,
            request_status: 'approved',
            run_status: run.status,
            resources: getRunResourcesText(run),
            service_url: run.service?.url,
            submitted_at: run.submitted_at,
            run,
        }));
    return [...requestItems, ...directRunItems].sort((a, b) => {
        const aTime = new Date(a.submitted_at ?? a.created_at ?? 0).getTime();
        const bTime = new Date(b.submitted_at ?? b.created_at ?? 0).getTime();
        return bTime - aTime;
    });
};

export const DashboardPage: React.FC = () => {
    const { role, locale } = useConsoleContext();
    const { emptyTitle, text } = useLocaleText();
    const requests = useGetAllRunRequestsQuery({ include_all: role.canUseProjectAdmin, limit: 100 });
    const runs = useGetRunsQuery({ limit: 100, job_submissions_limit: 1 });
    const resourcePools = useGetResourcePoolsQuery({ only_active: false, limit: 100 }, { skip: !role.canUseGlobalAdmin });
    const instances = useGetInstancesQuery(
        { only_active: true, include_imported: true, limit: 100 },
        { skip: !role.canUseProjectAdmin },
    );
    const events = useGetAllEventsQuery({ limit: 8 }, { skip: !role.canUseGlobalAdmin });
    const stats = getRunRequestStats(requests.data ?? []);
    const runItems = getUnifiedRunItems(requests.data ?? [], runs.data ?? []);
    const runningRuns = (runs.data ?? []).filter((run) => run.status === 'running').length;

    return (
        <>
            <PageHeader
                title={text('工作台', 'Dashboard')}
                description={text(
                    role.canUseGlobalAdmin
                        ? '跨项目查看运行任务、审批和基础设施状态。'
                        : '查看你的运行任务、审批状态和运行进展。',
                    role.canUseGlobalAdmin
                        ? 'Cross-project run, approval, and infrastructure overview.'
                        : 'Review your runs, approvals, and runtime progress.',
                )}
            />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard label={text('待审批任务', 'Pending approvals')} value={stats.pending} accent="amber" />
                <MetricCard label={text('运行中任务', 'Running runs')} value={runningRuns} accent="teal" />
                {role.canUseProjectAdmin ? (
                    <>
                        <MetricCard label={text('资源池', 'Fleets')} value={resourcePools.data?.length ?? 0} accent="blue" />
                        <MetricCard
                            label={text('活跃实例', 'Active instances')}
                            value={instances.data?.length ?? 0}
                            accent="slate"
                        />
                    </>
                ) : (
                    <>
                        <MetricCard label={text('已批准任务', 'Approved runs')} value={stats.approved} accent="blue" />
                        <MetricCard label={text('失败任务', 'Failed runs')} value={stats.failed} accent="slate" />
                    </>
                )}
            </div>
            <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
                <Panel title={text('最近运行任务', 'Recent runs')}>
                    <DataTable
                        items={runItems.slice(0, 8)}
                        loading={requests.isLoading || runs.isLoading}
                        keyGetter={(item) => item.id}
                        empty={<EmptyState title={text('暂无运行任务', 'No runs yet')} />}
                        emptyTitle={emptyTitle}
                        columns={[
                            { id: 'name', header: text('名称', 'Name'), cell: (item) => item.name },
                            { id: 'project', header: text('项目', 'Project'), cell: (item) => item.project_name },
                            ...(role.canUseProjectAdmin
                                ? [
                                      {
                                          id: 'applicant',
                                          header: text('提交人', 'Applicant'),
                                          cell: (item: TUnifiedRunItem) => item.applicant,
                                      },
                                  ]
                                : []),
                            {
                                id: 'requestStatus',
                                header: text('审批', 'Approval'),
                                cell: (item) => <RequestStatus status={item.request_status} />,
                            },
                            {
                                id: 'runStatus',
                                header: text('运行', 'Runtime'),
                                cell: (item) => <RequestStatus status={item.run_status} />,
                            },
                            {
                                id: 'created',
                                header: text('提交时间', 'Submitted'),
                                cell: (item) => formatDate(item.submitted_at ?? item.created_at),
                            },
                        ]}
                    />
                </Panel>
                {role.canUseGlobalAdmin ? (
                    <Panel title={text('最近事件', 'Recent events')}>
                        <div className="grid gap-3">
                            {(events.data ?? []).map((event) => (
                                <div key={event.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                                        {formatEventMessage(event.message, locale)}
                                    </div>
                                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                        {formatDate(event.recorded_at)} · {formatEventActor(event.actor_user, locale)}
                                    </div>
                                </div>
                            ))}
                            {!events.isLoading && !(events.data ?? []).length && (
                                <EmptyState title={text('暂无事件', 'No events')} />
                            )}
                        </div>
                    </Panel>
                ) : (
                    <Panel title={text('我的运行任务', 'My runs')}>
                        <DataTable
                            items={runItems.slice(0, 6)}
                            loading={requests.isLoading || runs.isLoading}
                            keyGetter={(item) => item.id}
                            empty={<EmptyState title={text('暂无运行任务', 'No runs')} />}
                            emptyTitle={emptyTitle}
                            columns={[
                                { id: 'name', header: text('名称', 'Name'), cell: (item) => item.name },
                                { id: 'project', header: text('项目', 'Project'), cell: (item) => item.project_name },
                                {
                                    id: 'status',
                                    header: text('状态', 'Status'),
                                    cell: (item) => <RequestStatus status={item.run_status ?? item.request_status} />,
                                },
                            ]}
                        />
                    </Panel>
                )}
            </div>
        </>
    );
};

export const RunApprovalsPage: React.FC = () => {
    const navigate = useNavigate();
    const { role } = useConsoleContext();
    const { emptyTitle, text } = useLocaleText();
    const [query, setQuery] = useState('');
    const requests = useGetAllRunRequestsQuery({ include_all: role.canUseProjectAdmin, limit: 500 });
    const items = useFilteredItems(
        (requests.data ?? []).filter((request) => request.status === 'pending'),
        query,
        [(item) => item.request.name, (item) => item.project_name, (item) => item.applicant, (item) => item.status],
    );

    return (
        <>
            <PageHeader
                title={text('审批', 'Approvals')}
                description={text('审批项目成员提交的运行任务。', 'Review submitted runs from project members.')}
            />
            <Panel
                title={text('待审批任务', 'Pending runs')}
                actions={
                    <SearchInput
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={text('搜索任务', 'Search runs')}
                    />
                }
            >
                <DataTable
                    items={items}
                    loading={requests.isLoading}
                    keyGetter={(item) => item.id}
                    empty={<EmptyState title={text('暂无待审批任务', 'No pending runs')} />}
                    emptyTitle={emptyTitle}
                    columns={[
                        {
                            id: 'name',
                            header: text('名称', 'Name'),
                            cell: (item) => (
                                <button
                                    className="font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-300"
                                    onClick={() =>
                                        navigate(CONSOLE_ROUTES.RUN_REQUEST_DETAILS.FORMAT(item.project_name, item.id))
                                    }
                                >
                                    {item.request.name ?? item.id}
                                </button>
                            ),
                            sortValue: (item) => item.request.name ?? item.id,
                        },
                        {
                            id: 'project',
                            header: text('项目', 'Project'),
                            cell: (item) => item.project_name,
                            sortValue: (item) => item.project_name,
                        },
                        {
                            id: 'applicant',
                            header: text('提交人', 'Applicant'),
                            cell: (item) => item.applicant,
                            sortValue: (item) => item.applicant,
                        },
                        {
                            id: 'resources',
                            header: text('资源', 'Resources'),
                            cell: (item) => formatRunRequestResourcesText(item.request),
                        },
                        {
                            id: 'status',
                            header: text('状态', 'Status'),
                            cell: (item) => <RequestStatus status={item.status} />,
                            sortValue: (item) => item.status,
                        },
                        {
                            id: 'created',
                            header: text('提交时间', 'Submitted'),
                            cell: (item) => formatDate(item.created_at),
                            sortValue: (item) => item.created_at,
                        },
                    ]}
                />
            </Panel>
        </>
    );
};

export const RunRequestCreatePage: React.FC = () => {
    const navigate = useNavigate();
    const { projects, role } = useConsoleContext();
    const { locale, text } = useLocaleText();
    const [createRunRequest, createState] = useCreateRunRequestMutation();
    const [applyRun, applyState] = useApplyRunMutation();
    const [pushNotification] = useNotifications();
    const [values, setValues] = useState<IRunRequestFormValues>({
        project_name: projects[0]?.project_name ?? '',
        name: '',
        image: '',
        commands: '',
        env: '',
        ports: '',
        nodes: '1',
        cpu: '',
        memory: '',
        gpu: '',
        disk: '',
        max_duration: '4h',
        fleets: '',
    });
    const runtimeImages = useGetRuntimeImagesQuery();
    const projectResourcePools = useGetProjectResourcePoolsQuery(
        { projectName: values.project_name },
        { skip: !values.project_name },
    );
    const resourceLimits = useMemo(
        () => getRunResourceLimits(projectResourcePools.data ?? [], values.fleets),
        [projectResourcePools.data, values.fleets],
    );

    const update = (key: keyof IRunRequestFormValues, value: string) => setValues((current) => ({ ...current, [key]: value }));
    const updateResource = (key: RunResourceLimitKey, value: string) => {
        const formattedValue = value.trim() ? formatResourceFormValue(key, Number(value)) : '';
        setValues((current) => ({
            ...current,
            [key]: formattedValue ? clampResourceFormValue(key, formattedValue, resourceLimits[key]) : formattedValue,
        }));
    };
    const updateDuration = (value: string) => {
        const hours = parseResourceNumber(value);
        setValues((current) => ({
            ...current,
            max_duration: hours === null ? '' : formatDurationFormValue(hours),
        }));
    };
    const updateProject = (projectName: string) => {
        setValues((current) => ({ ...current, project_name: projectName, fleets: '' }));
    };

    useEffect(() => {
        setValues((current) => ({
            ...current,
            image:
                current.image || runtimeImages.data?.length
                    ? current.image || runtimeImages.data?.[0]?.image || ''
                    : '',
            nodes: clampResourceFormValue('nodes', current.nodes || '1', resourceLimits.nodes || 1),
            gpu: clampResourceFormValue('gpu', current.gpu, resourceLimits.gpu),
            cpu: clampResourceFormValue('cpu', current.cpu, resourceLimits.cpu),
            memory: clampResourceFormValue('memory', current.memory, resourceLimits.memory),
            disk: clampResourceFormValue('disk', current.disk, resourceLimits.disk),
        }));
    }, [
        resourceLimits.cpu,
        resourceLimits.disk,
        resourceLimits.gpu,
        resourceLimits.memory,
        resourceLimits.nodes,
        runtimeImages.data,
    ]);

    const onSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (!runtimeImages.data?.length) {
            pushNotification({
                type: 'error',
                header: text('请先配置任务镜像', 'Configure runtime images first'),
            });
            return;
        }
        if (!values.project_name || !values.image.trim() || !values.commands.trim()) {
            pushNotification({
                type: 'error',
                header: text('请填写项目、镜像和启动命令', 'Project, image, and commands are required'),
            });
            return;
        }
        const createParams = buildRunRequestCreateParams(values);
        if (canManageConsoleProject(role, values.project_name)) {
            const configuration: TTaskConfigurationRequest = {
                type: 'task',
                image: createParams.request.image,
                commands: createParams.request.commands,
                env: createParams.request.env
                    ? Object.entries(createParams.request.env).map(([key, value]) => `${key}=${value}`)
                    : undefined,
                ports: createParams.request.ports,
                nodes: createParams.request.nodes,
                resources: createParams.request.resources,
                max_duration: createParams.request.max_duration ?? undefined,
                fleets: createParams.request.fleets ?? undefined,
            };
            const result = await applyRun({
                project_name: values.project_name,
                force: true,
                plan: {
                    run_spec: {
                        run_name: createParams.request.name ?? '',
                        configuration,
                    },
                },
            }).unwrap();
            navigate(CONSOLE_ROUTES.RUN_DETAILS.FORMAT(result.project_name, result.id));
            return;
        }
        const result = await createRunRequest(createParams).unwrap();
        navigate(CONSOLE_ROUTES.RUN_REQUEST_DETAILS.FORMAT(result.project_name, result.id));
    };
    const selectedProjectCanDirectCreate = values.project_name ? canManageConsoleProject(role, values.project_name) : false;

    return (
        <>
            <PageHeader
                title={text('新建运行任务', 'New Run')}
                description={text(
                    selectedProjectCanDirectCreate
                        ? '你可以在该项目中直接创建运行任务。'
                        : '普通用户提交后需要项目管理员审批。',
                    selectedProjectCanDirectCreate
                        ? 'You can create a run directly in this project.'
                        : 'Regular users submit runs for project administrator approval.',
                )}
            />
            <form className="grid gap-6" onSubmit={onSubmit}>
                <Panel title={text('基础信息', 'Basics')}>
                    <div className="grid gap-4 md:grid-cols-2">
                        <Field label={text('项目', 'Project')}>
                            <SelectInput value={values.project_name} onChange={(event) => updateProject(event.target.value)}>
                                <option value="">{text('请选择项目', 'Select a project')}</option>
                                {projects.map((project) => (
                                    <option key={project.project_name} value={project.project_name}>
                                        {project.project_name}
                                    </option>
                                ))}
                            </SelectInput>
                        </Field>
                        <Field label={text('任务名称', 'Name')}>
                            <TextInput
                                value={values.name}
                                onChange={(event) => update('name', event.target.value)}
                                placeholder="train-qwen"
                            />
                        </Field>
                        <Field label={text('镜像', 'Image')}>
                            <SelectInput
                                aria-label={text('镜像', 'Image')}
                                value={values.image}
                                onChange={(event) => update('image', event.target.value)}
                                disabled={runtimeImages.isLoading || !runtimeImages.data?.length}
                            >
                                {(runtimeImages.data ?? []).map((image) => (
                                    <option key={image.image} value={image.image}>
                                        {image.name} - {image.image}
                                    </option>
                                ))}
                            </SelectInput>
                            {!runtimeImages.isLoading && !runtimeImages.data?.length && (
                                <span className="mt-1.5 block text-xs text-amber-700 dark:text-amber-300">
                                    {text(
                                        '请最高管理员先在系统设置配置镜像',
                                        'Ask a global administrator to configure runtime images first.',
                                    )}
                                </span>
                            )}
                        </Field>
                        <Field
                            label={text('资源池', 'Fleet')}
                            hint={text(
                                '不选择时自动使用该项目已授权的资源范围。',
                                'Leave empty to use the project authorized resource scope automatically.',
                            )}
                        >
                            <SelectInput
                                aria-label={text('资源池', 'Fleet')}
                                value={values.fleets}
                                onChange={(event) => update('fleets', event.target.value)}
                                disabled={projectResourcePools.isLoading || !projectResourcePools.data?.length}
                            >
                                <option value="">{text('自动选择', 'Auto select')}</option>
                                {(projectResourcePools.data ?? []).map((pool) => (
                                    <option key={pool.id} value={pool.name}>
                                        {pool.name}
                                    </option>
                                ))}
                            </SelectInput>
                        </Field>
                    </div>
                </Panel>
                <Panel title={text('启动配置', 'Startup')}>
                    <div className="grid gap-4">
                        <Field label={text('启动命令', 'Commands')}>
                            <TextArea
                                value={values.commands}
                                onChange={(event) => update('commands', event.target.value)}
                                placeholder="python train.py"
                            />
                        </Field>
                        <div className="grid gap-4 md:grid-cols-2">
                            <Field label={text('环境变量', 'Environment variables')}>
                                <TextArea
                                    value={values.env}
                                    onChange={(event) => update('env', event.target.value)}
                                    placeholder="KEY=value"
                                />
                            </Field>
                            <Field label={text('端口', 'Ports')}>
                                <TextArea
                                    value={values.ports}
                                    onChange={(event) => update('ports', event.target.value)}
                                    placeholder="8888, 6006"
                                />
                            </Field>
                        </div>
                    </div>
                </Panel>
                <Panel title={text('资源规格', 'Resources')}>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <ResourceSliderField
                            label={text('节点数', 'Nodes')}
                            sliderLabel={text('节点数 滑条', 'Nodes slider')}
                            inputLabel={text('节点数 数值', 'Nodes value')}
                            value={values.nodes}
                            min={1}
                            max={resourceLimits.nodes || 1}
                            unit={text('台', 'nodes')}
                            maxLabel={text('可用上限', 'Available max')}
                            onChange={(value) => updateResource('nodes', value)}
                        />
                        <ResourceSliderField
                            label="GPU"
                            sliderLabel={text('GPU 数量', 'GPU count')}
                            inputLabel={text('GPU 数值', 'GPU value')}
                            value={values.gpu}
                            max={resourceLimits.gpu}
                            unit={locale === 'zh' ? '张' : 'GPU'}
                            maxLabel={text('可用上限', 'Available max')}
                            onChange={(value) => updateResource('gpu', value)}
                        />
                        <ResourceSliderField
                            label="CPU"
                            sliderLabel={text('CPU 核心', 'CPU cores')}
                            inputLabel={text('CPU 数值', 'CPU value')}
                            value={values.cpu}
                            max={resourceLimits.cpu}
                            unit={locale === 'zh' ? '核心' : 'cores'}
                            maxLabel={text('可用上限', 'Available max')}
                            onChange={(value) => updateResource('cpu', value)}
                        />
                        <ResourceSliderField
                            label={text('内存', 'Memory')}
                            sliderLabel={text('内存 GiB', 'Memory GiB')}
                            inputLabel={text('内存 数值', 'Memory value')}
                            value={values.memory}
                            max={resourceLimits.memory}
                            unit="GiB"
                            maxLabel={text('可用上限', 'Available max')}
                            onChange={(value) => updateResource('memory', value)}
                        />
                        <ResourceSliderField
                            label={text('磁盘', 'Disk')}
                            sliderLabel={text('磁盘 GiB', 'Disk GiB')}
                            inputLabel={text('磁盘 数值', 'Disk value')}
                            value={values.disk}
                            max={resourceLimits.disk}
                            unit="GiB"
                            maxLabel={text('可用上限', 'Available max')}
                            onChange={(value) => updateResource('disk', value)}
                        />
                        <ResourceSliderField
                            label={text('最长运行', 'Max duration')}
                            sliderLabel={text('最长运行 小时', 'Max duration hours')}
                            inputLabel={text('最长运行 数值', 'Max duration value')}
                            value={values.max_duration}
                            min={1}
                            max={168}
                            unit={text('小时', 'hours')}
                            maxLabel={text('可申请上限', 'Request limit')}
                            onChange={updateDuration}
                        />
                    </div>
                </Panel>
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <Button className="w-full sm:w-auto" type="button" onClick={() => navigate(CONSOLE_ROUTES.RUNS)}>
                        {text('取消', 'Cancel')}
                    </Button>
                    <Button
                        className="w-full sm:w-auto"
                        type="submit"
                        variant="primary"
                        loading={createState.isLoading || applyState.isLoading}
                    >
                        {selectedProjectCanDirectCreate
                            ? text('创建任务', 'Create run')
                            : text('提交审批', 'Submit for approval')}
                    </Button>
                </div>
            </form>
        </>
    );
};

export const RunRequestDetailsPage: React.FC = () => {
    const { projectName = '', requestId = '' } = useParams();
    const navigate = useNavigate();
    const { role } = useConsoleContext();
    const { emptyTitle, locale, text } = useLocaleText();
    const request = useGetRunRequestQuery({ project_name: projectName, id: requestId });
    const run = useGetRunQuery({ project_name: projectName, id: request.data?.run_id ?? '' }, { skip: !request.data?.run_id });
    const job = run.data?.jobs?.[0];
    const submission = job?.job_submissions?.[job.job_submissions.length - 1];
    const logs = useGetProjectLogsQuery(
        {
            project_name: projectName,
            run_name: run.data?.run_spec.run_name ?? request.data?.run_name ?? '',
            job_submission_id: submission?.id ?? '',
            limit: 20,
            descending: true,
        },
        { skip: !run.data || !submission },
    );
    const [approve, approveState] = useApproveRunRequestMutation();
    const [retry, retryState] = useRetryRunRequestMutation();
    const [reject, rejectState] = useRejectRunRequestMutation();
    const [rejectOpen, setRejectOpen] = useState(false);
    const [reason, setReason] = useState('');
    const canReview = request.data && canManageConsoleProject(role, request.data.project_name);

    const approveRequest = async () => {
        const result = await approve({ project_name: projectName, id: requestId }).unwrap();
        navigate(CONSOLE_ROUTES.RUN_REQUEST_DETAILS.FORMAT(result.project_name, result.id));
    };

    const rejectRequest = async () => {
        await reject({ project_name: projectName, id: requestId, reason }).unwrap();
        setRejectOpen(false);
    };

    return (
        <>
            <PageHeader
                title={request.data?.request.name ?? requestId}
                description={request.data ? `${request.data.project_name} · ${request.data.applicant}` : undefined}
                actions={
                    canReview && (
                        <>
                            {request.data?.status === 'pending' && (
                                <>
                                    <Button variant="primary" loading={approveState.isLoading} onClick={approveRequest}>
                                        {text('通过', 'Approve')}
                                    </Button>
                                    <Button variant="danger" onClick={() => setRejectOpen(true)}>
                                        {text('拒绝', 'Reject')}
                                    </Button>
                                </>
                            )}
                            {request.data?.status === 'failed' && (
                                <Button
                                    loading={retryState.isLoading}
                                    onClick={() => retry({ project_name: projectName, id: requestId })}
                                >
                                    {text('重试', 'Retry')}
                                </Button>
                            )}
                        </>
                    )
                }
            />
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
                <Panel title={text('任务详情', 'Run details')}>
                    {request.data ? (
                        <DetailGrid
                            items={[
                                { label: text('名称', 'Name'), value: request.data.request.name },
                                { label: text('镜像', 'Image'), value: request.data.request.image },
                                {
                                    label: text('命令', 'Commands'),
                                    value: request.data.request.commands?.join(' && '),
                                },
                                {
                                    label: text('环境变量', 'Environment'),
                                    value: request.data.request.env
                                        ? Object.keys(request.data.request.env).join(', ')
                                        : undefined,
                                },
                                {
                                    label: text('端口', 'Ports'),
                                    value: request.data.request.ports?.join(', '),
                                },
                                {
                                    label: text('节点数', 'Nodes'),
                                    value: request.data.request.nodes ?? 1,
                                },
                                {
                                    label: text('资源', 'Resources'),
                                    value: formatRunRequestResourcesText(request.data.request),
                                },
                                {
                                    label: text('最长运行时间', 'Max duration'),
                                    value: request.data.request.max_duration,
                                },
                                {
                                    label: text('资源池', 'Fleets'),
                                    value: request.data.request.fleets?.join(', '),
                                },
                            ]}
                        />
                    ) : (
                        <EmptyState title={text('任务不存在', 'Run request not found')} />
                    )}
                </Panel>
                {request.data && (
                    <Panel title={text('状态', 'Status')}>
                        <div className="grid gap-4 text-sm">
                            <div className="flex items-center justify-between">
                                <span className="text-slate-500 dark:text-slate-400">{text('状态', 'Status')}</span>
                                <RequestStatus status={request.data.status} />
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500 dark:text-slate-400">{text('资源', 'Resources')}</span>
                                <span className="font-medium">{formatRunRequestResourcesText(request.data.request)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500 dark:text-slate-400">Run</span>
                                <span className="font-medium">{request.data.run_name ?? request.data.run_id ?? '-'}</span>
                            </div>
                            {run.data && (
                                <>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500 dark:text-slate-400">
                                            {text('运行状态', 'Run status')}
                                        </span>
                                        <RequestStatus status={run.data.status} />
                                    </div>
                                    {run.data.service?.url && (
                                        <div className="flex justify-between gap-4">
                                            <span className="text-slate-500 dark:text-slate-400">
                                                {text('访问地址', 'URL')}
                                            </span>
                                            <a
                                                className="truncate font-medium text-blue-600 dark:text-blue-300"
                                                href={run.data.service.url}
                                                rel="noreferrer"
                                                target="_blank"
                                            >
                                                {run.data.service.url}
                                            </a>
                                        </div>
                                    )}
                                    {submission && (
                                        <div className="flex justify-between">
                                            <span className="text-slate-500 dark:text-slate-400">
                                                {text('提交状态', 'Submission')}
                                            </span>
                                            <RequestStatus status={submission.status} />
                                        </div>
                                    )}
                                </>
                            )}
                            {request.data.run_id && (
                                <Button
                                    className="w-full"
                                    onClick={() =>
                                        navigate(
                                            CONSOLE_ROUTES.RUN_DETAILS.FORMAT(
                                                request.data!.project_name,
                                                request.data!.run_id!,
                                            ),
                                        )
                                    }
                                >
                                    {text('查看运行任务', 'View run')}
                                </Button>
                            )}
                            {(request.data.review_message || request.data.status === 'failed') && (
                                <div className="rounded-lg bg-slate-50 p-3 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                    {request.data.review_message ?? '-'}
                                </div>
                            )}
                        </div>
                    </Panel>
                )}
            </div>
            {run.data && (
                <div className="mt-6 grid gap-6">
                    <Panel title={text('运行信息', 'Run runtime')}>
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <MetricCard label={text('状态', 'Status')} value={<RequestStatus status={run.data.status} />} />
                            <MetricCard label={text('镜像', 'Image')} value={request.data?.request.image ?? '-'} />
                            <MetricCard label={text('用户', 'User')} value={run.data.user} />
                            <MetricCard label={text('提交时间', 'Submitted')} value={formatDate(run.data.submitted_at)} />
                        </div>
                    </Panel>
                    <Panel title="Jobs">
                        <DataTable
                            items={run.data.jobs ?? []}
                            keyGetter={(item) => item.job_spec.job_name}
                            emptyTitle={emptyTitle}
                            columns={[
                                { id: 'name', header: text('名称', 'Name'), cell: (item) => item.job_spec.job_name },
                                { id: 'image', header: text('镜像', 'Image'), cell: (item) => item.job_spec.image_name },
                                {
                                    id: 'status',
                                    header: text('状态', 'Status'),
                                    cell: (item) => (
                                        <RequestStatus
                                            status={item.job_submissions?.[item.job_submissions.length - 1]?.status}
                                        />
                                    ),
                                },
                                {
                                    id: 'commands',
                                    header: text('命令', 'Commands'),
                                    cell: (item) => item.job_spec.commands.join(' && '),
                                },
                            ]}
                        />
                    </Panel>
                    <Panel title={text('基础日志', 'Basic logs')}>
                        {logs.data?.logs.length ? (
                            <CodeBlock
                                value={logs.data.logs
                                    .map((log) => `[${formatDate(log.timestamp)}] ${log.log_source}: ${log.message}`)
                                    .join('\n')}
                            />
                        ) : (
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
                                {submission
                                    ? `${text('日志提交', 'Log submission')}: ${submission.id} · ${formatStatusLabel(submission.status, locale)}`
                                    : text('暂无日志提交', 'No log submission yet')}
                            </div>
                        )}
                    </Panel>
                </div>
            )}
            <Modal
                open={rejectOpen}
                title={text('拒绝任务', 'Reject run')}
                onClose={() => setRejectOpen(false)}
                footer={
                    <>
                        <Button onClick={() => setRejectOpen(false)}>{text('取消', 'Cancel')}</Button>
                        <Button variant="danger" loading={rejectState.isLoading} onClick={rejectRequest}>
                            {text('拒绝', 'Reject')}
                        </Button>
                    </>
                }
            >
                <Field label={text('拒绝原因', 'Reason')}>
                    <TextArea value={reason} onChange={(event) => setReason(event.target.value)} />
                </Field>
            </Modal>
        </>
    );
};

export const RunsPage: React.FC = () => {
    const navigate = useNavigate();
    const { role } = useConsoleContext();
    const { emptyTitle, text } = useLocaleText();
    const [query, setQuery] = useState('');
    const runs = useGetRunsQuery({ limit: 500, job_submissions_limit: 1 });
    const requests = useGetAllRunRequestsQuery({ include_all: role.canUseProjectAdmin, limit: 500 });
    const runItems = useMemo(() => getUnifiedRunItems(requests.data ?? [], runs.data ?? []), [requests.data, runs.data]);
    const items = useFilteredItems(runItems, query, [
        (item) => item.name,
        (item) => item.project_name,
        (item) => item.applicant,
        (item) => item.request_status,
        (item) => item.run_status,
    ]);

    return (
        <>
            <PageHeader
                title={text('运行任务', 'Runs')}
                actions={
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Button
                            variant="primary"
                            icon={<Plus className="h-4 w-4" />}
                            onClick={() => navigate(CONSOLE_ROUTES.RUN_CREATE)}
                        >
                            {text('新建运行任务', 'New run')}
                        </Button>
                    </div>
                }
            />
            <Panel
                title={text('任务列表', 'Run list')}
                actions={
                    <SearchInput
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={text('搜索任务', 'Search runs')}
                    />
                }
            >
                <DataTable
                    items={items}
                    loading={runs.isLoading || requests.isLoading}
                    keyGetter={(item) => item.id}
                    empty={<EmptyState title={text('暂无运行任务', 'No runs')} />}
                    emptyTitle={emptyTitle}
                    columns={[
                        {
                            id: 'name',
                            header: text('名称', 'Name'),
                            cell: (item) => (
                                <button
                                    className="font-semibold text-blue-600 dark:text-blue-300"
                                    onClick={() => {
                                        if (item.run) {
                                            navigate(CONSOLE_ROUTES.RUN_DETAILS.FORMAT(item.project_name, item.run.id));
                                        } else if (item.request) {
                                            navigate(
                                                CONSOLE_ROUTES.RUN_REQUEST_DETAILS.FORMAT(item.project_name, item.request.id),
                                            );
                                        }
                                    }}
                                >
                                    {item.name}
                                </button>
                            ),
                        },
                        { id: 'project', header: text('项目', 'Project'), cell: (item) => item.project_name },
                        { id: 'user', header: text('提交人', 'Applicant'), cell: (item) => item.applicant },
                        { id: 'resources', header: text('资源', 'Resources'), cell: (item) => item.resources },
                        {
                            id: 'approval',
                            header: text('审批', 'Approval'),
                            cell: (item) => <RequestStatus status={item.request_status} />,
                        },
                        {
                            id: 'runtime',
                            header: text('运行', 'Runtime'),
                            cell: (item) => <RequestStatus status={item.run_status} />,
                        },
                        {
                            id: 'url',
                            header: text('服务地址', 'Service URL'),
                            cell: (item) =>
                                item.service_url ? (
                                    <a
                                        className="text-blue-600 dark:text-blue-300"
                                        href={item.service_url}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        {text('打开', 'Open')}
                                    </a>
                                ) : (
                                    '-'
                                ),
                        },
                        {
                            id: 'submitted',
                            header: text('提交时间', 'Submitted'),
                            cell: (item) => formatDate(item.submitted_at ?? item.created_at),
                        },
                    ]}
                />
            </Panel>
        </>
    );
};

export const RunDetailsPage: React.FC = () => {
    const { projectName = '', runId = '' } = useParams();
    const { role } = useConsoleContext();
    const { emptyTitle, locale, text } = useLocaleText();
    const [confirm] = useConfirmationDialog();
    const [stopRuns, stopState] = useStopRunsMutation();
    const [deleteRuns, deleteState] = useDeleteRunsMutation();
    const run = useGetRunQuery({ project_name: projectName, id: runId });
    const data = run.data;
    const job = data?.jobs?.[0];
    const submission = job?.job_submissions?.[job.job_submissions.length - 1];
    const metrics = useGetMetricsQuery(
        {
            project_name: projectName,
            run_name: data?.run_spec.run_name ?? '',
            run_id: runId,
            job_num: job?.job_spec.job_num ?? 0,
            limit: 50,
        },
        { skip: !data || !job },
    );

    const metricSeries =
        metrics.data?.[0]?.timestamps.map((timestamp, index) => ({
            timestamp,
            value: metrics.data?.[0]?.values[index] ?? 0,
        })) ?? [];

    const runName = data?.run_spec.run_name ?? runId;
    const canOperate = role.canUseGlobalAdmin || canManageConsoleProject(role, projectName);
    const stop = () =>
        confirm({
            title: text('停止运行任务', 'Stop run'),
            content: text('确认停止该运行任务？', 'Stop this run?'),
            confirmButtonLabel: text('停止', 'Stop'),
            onConfirm: () => stopRuns({ project_name: projectName, runs_names: [runName], abort: true }),
        });
    const remove = () =>
        confirm({
            title: text('删除运行任务', 'Delete run'),
            content: text('确认删除该运行任务？', 'Delete this run?'),
            confirmButtonLabel: text('删除', 'Delete'),
            onConfirm: () => deleteRuns({ project_name: projectName, runs_names: [runName] }),
        });

    return (
        <>
            <PageHeader
                title={runName}
                description={projectName}
                actions={
                    data &&
                    canOperate && (
                        <>
                            {runStatusForStopping.includes(data.status) && (
                                <Button loading={stopState.isLoading} onClick={stop}>
                                    {text('停止', 'Stop')}
                                </Button>
                            )}
                            {runStatusForDeleting.includes(data.status) && (
                                <Button variant="danger" loading={deleteState.isLoading} onClick={remove}>
                                    {text('删除', 'Delete')}
                                </Button>
                            )}
                        </>
                    )
                }
            />
            <div className="grid gap-6">
                <Panel title={text('概览', 'Overview')}>
                    {data ? (
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <MetricCard label={text('状态', 'Status')} value={<RequestStatus status={data.status} />} />
                            <MetricCard label={text('用户', 'User')} value={data.user} />
                            <MetricCard label={text('费用', 'Cost')} value={centsToFormattedString(data.cost ?? 0, '$')} />
                            <MetricCard label={text('提交时间', 'Submitted')} value={formatDate(data.submitted_at)} />
                        </div>
                    ) : (
                        <EmptyState title={text('加载中', 'Loading')} />
                    )}
                </Panel>
                <div id="jobs">
                    <Panel title={text('Jobs', 'Jobs')}>
                        <DataTable
                            items={data?.jobs ?? []}
                            loading={run.isLoading}
                            keyGetter={(item) => item.job_spec.job_name}
                            emptyTitle={emptyTitle}
                            columns={[
                                { id: 'name', header: text('名称', 'Name'), cell: (item) => item.job_spec.job_name },
                                { id: 'image', header: text('镜像', 'Image'), cell: (item) => item.job_spec.image_name },
                                {
                                    id: 'status',
                                    header: text('状态', 'Status'),
                                    cell: (item) => (
                                        <RequestStatus
                                            status={item.job_submissions?.[item.job_submissions.length - 1]?.status}
                                        />
                                    ),
                                },
                                {
                                    id: 'commands',
                                    header: text('命令', 'Commands'),
                                    cell: (item) => item.job_spec.commands.join(' && '),
                                },
                            ]}
                        />
                    </Panel>
                </div>
                <div id="metrics">
                    <Panel title={text('指标', 'Metrics')}>
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={metricSeries}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="timestamp" hide />
                                    <YAxis />
                                    <Tooltip />
                                    <Area type="monotone" dataKey="value" stroke="#2563eb" fill="#93c5fd" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </Panel>
                </div>
                <div id="logs">
                    <Panel title={text('日志入口', 'Logs')}>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
                            {submission
                                ? `${text('日志提交', 'Log submission')}: ${submission.id} · ${formatStatusLabel(submission.status, locale)}`
                                : text('暂无日志提交', 'No log submission yet')}
                        </div>
                    </Panel>
                </div>
            </div>
        </>
    );
};

export const FleetsPage: React.FC = () => {
    const navigate = useNavigate();
    const { emptyTitle, locale, text } = useLocaleText();
    const resourcePools = useGetResourcePoolsQuery(
        { only_active: false, limit: 500 },
        { pollingInterval: 5000, refetchOnMountOrArgChange: true },
    );

    return (
        <>
            <PageHeader
                title={text('资源池', 'Fleets')}
                actions={
                    <Button
                        variant="primary"
                        icon={<Plus className="h-4 w-4" />}
                        onClick={() => navigate(CONSOLE_ROUTES.RESOURCES_FLEET_CREATE)}
                    >
                        {text('创建资源池', 'Create fleet')}
                    </Button>
                }
            />
            <Panel title={text('资源池列表', 'Fleet list')}>
                <DataTable
                    items={resourcePools.data ?? []}
                    loading={resourcePools.isLoading}
                    keyGetter={(item) => item.id}
                    empty={<EmptyState title={text('暂无资源池', 'No fleets')} />}
                    emptyTitle={emptyTitle}
                    columns={[
                        {
                            id: 'name',
                            header: text('名称', 'Name'),
                            cell: (item) => (
                                <button
                                    className="font-semibold text-blue-600 dark:text-blue-300"
                                    onClick={() => navigate(CONSOLE_ROUTES.RESOURCES_FLEET_DETAILS.FORMAT('_', item.id))}
                                >
                                    {item.name}
                                </button>
                            ),
                        },
                        {
                            id: 'backend',
                            header: text('接入方式', 'Access method'),
                            cell: (item) => formatFleetType(item, locale),
                        },
                        {
                            id: 'resources',
                            header: text('资源', 'Resources'),
                            cell: (item) => <ResourceSummaryStack resources={item.resource_summary} locale={locale} />,
                            className: 'min-w-56 whitespace-normal',
                        },
                        {
                            id: 'usage',
                            header: text('当前使用', 'Current usage'),
                            cell: (item) => <ResourceUsageDashboard usage={item.usage_summary} locale={locale} compact />,
                            className: 'min-w-[28rem] whitespace-normal',
                        },
                        {
                            id: 'reporting',
                            header: text('上报实例', 'Reporting'),
                            cell: (item) =>
                                `${item.usage_summary?.reporting_instance_count ?? 0} / ${item.resource_summary.instance_count}`,
                        },
                        {
                            id: 'authorized',
                            header: text('授权项目', 'Authorized projects'),
                            cell: (item) => <ProjectChips names={item.authorized_project_names} />,
                            className: 'min-w-52 whitespace-normal',
                        },
                    ]}
                />
            </Panel>
        </>
    );
};

export const FleetCreatePage: React.FC = () => {
    const navigate = useNavigate();
    const { text } = useLocaleText();
    const [createResourcePool, createState] = useCreateResourcePoolMutation();
    const [name, setName] = useState('');
    const [nameError, setNameError] = useState<string | null>(null);

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        const trimmedName = name.trim();
        if (!RESOURCE_NAME_REGEX.test(trimmedName)) {
            setNameError(
                text("资源池名称需匹配 '^[a-z][a-z0-9-]{1,40}$'。", "Resource pool name must match '^[a-z][a-z0-9-]{1,40}$'."),
            );
            return;
        }
        setNameError(null);
        const spec = {
            configuration: {
                type: 'fleet',
                name: trimmedName,
                nodes: { min: 0 },
            },
            configuration_path: 'console.yaml',
            profile: { name: 'registered', default: true },
        } as IFleetSpec;
        const result = await createResourcePool({ force: true, plan: { spec } }).unwrap();
        navigate(CONSOLE_ROUTES.RESOURCES_INSTANCES, {
            state: {
                fleetName: result.name,
                openConnectServer: true,
            },
        });
    };

    return (
        <>
            <PageHeader
                title={text('创建资源池', 'Create fleet')}
                description={text(
                    '资源池用于组织可接入的自有服务器。创建后继续生成接入命令，把服务器注册为实例。',
                    'A fleet groups registered servers. After creation, generate a connection command to register servers as instances.',
                )}
            />
            <form className="grid gap-6" onSubmit={submit}>
                <Panel
                    title={text('基础信息', 'Basic information')}
                    description={text(
                        '当前版本创建自有服务器资源池，只需要填写基础信息。',
                        'This version creates self-hosted server fleets with basic information only.',
                    )}
                >
                    <div className="grid gap-4 md:grid-cols-2">
                        <Field
                            label={text('资源池名称', 'Fleet name')}
                            hint={text(
                                '小写字母开头，可包含小写字母、数字和短横线。',
                                'Start with a lowercase letter. Use lowercase letters, numbers, and hyphens.',
                            )}
                            error={nameError}
                        >
                            <TextInput
                                aria-label={text('资源池名称', 'Fleet name')}
                                value={name}
                                onChange={(event) => {
                                    setName(event.target.value);
                                    if (nameError) setNameError(null);
                                }}
                            />
                        </Field>
                    </div>
                    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
                        {text(
                            '接入方式：自有服务器。服务器不会在创建资源池时自动出现，需要下一步在实例页生成接入命令。',
                            'Access method: Self-hosted server. Servers are not added automatically; generate a connection command on the Instances page next.',
                        )}
                    </div>
                </Panel>
                <div className="flex justify-end">
                    <Button type="submit" variant="primary" loading={createState.isLoading}>
                        {text('创建资源池', 'Create fleet')}
                    </Button>
                </div>
            </form>
        </>
    );
};

export const FleetDetailsPage: React.FC = () => {
    const { fleetId = '' } = useParams();
    const { emptyTitle, locale, text } = useLocaleText();
    const navigate = useNavigate();
    const [confirm] = useConfirmationDialog();
    const [deleteResourcePools, deleteState] = useDeleteResourcePoolsMutation();
    const [updateResourcePool, updateState] = useUpdateResourcePoolMutation();
    const fleet = useGetResourcePoolDetailsQuery({ id: fleetId });
    const [editOpen, setEditOpen] = useState(false);
    const [editName, setEditName] = useState('');
    useEffect(() => {
        if (fleet.data?.name) {
            setEditName(fleet.data.name);
        }
    }, [fleet.data?.name]);
    const removeResourcePool = () => {
        if (!fleet.data) return;
        confirm({
            title: text('删除资源池', 'Delete resource pool'),
            content: text('确认删除该资源池？此操作不可恢复。', 'Delete this resource pool? This action cannot be undone.'),
            confirmButtonLabel: text('删除', 'Delete'),
            onConfirm: async () => {
                await deleteResourcePools({ names: [fleet.data!.name] }).unwrap();
                navigate(CONSOLE_ROUTES.RESOURCES_FLEETS);
            },
        });
    };
    const renameResourcePool = async (event: FormEvent) => {
        event.preventDefault();
        if (!fleet.data) return;
        const name = editName.trim();
        if (!name || name === fleet.data.name) {
            setEditOpen(false);
            return;
        }
        await updateResourcePool({
            resource_pool_name: fleet.data.name,
            new_resource_pool_name: name,
        }).unwrap();
        fleet.refetch?.();
    };

    return (
        <>
            <PageHeader
                title={fleet.data?.name ?? fleetId}
                description={text('全局资源池', 'Global resource pool')}
                actions={
                    <>
                        <Button
                            icon={<ArrowLeft className="h-4 w-4" />}
                            onClick={() => navigate(CONSOLE_ROUTES.RESOURCES_FLEETS)}
                        >
                            {text('返回', 'Back')}
                        </Button>
                        {fleet.data && (
                            <Button icon={<Pencil className="h-4 w-4" />} onClick={() => setEditOpen(true)}>
                                {text('编辑', 'Edit')}
                            </Button>
                        )}
                    </>
                }
            />
            <div className="grid gap-6">
                <Panel title={text('资源概览', 'Resource summary')}>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <MetricCard
                            label={text('CPU', 'CPU')}
                            value={formatCpuCapacity(fleet.data?.resource_summary.cpu_count, locale)}
                            description={`${fleet.data?.resource_summary.instance_count ?? 0} ${text('台实例', 'instances')}`}
                            accent="blue"
                        />
                        <MetricCard
                            label={text('内存', 'Memory')}
                            value={`${fleet.data?.resource_summary.memory_gib ?? 0}GiB`}
                            accent="teal"
                        />
                        <MetricCard
                            label={text('GPU', 'GPU')}
                            value={formatAggregateGpuCapacity(fleet.data?.resource_summary, locale)}
                            accent="blue"
                        />
                        <MetricCard
                            label={text('磁盘', 'Disk')}
                            value={`${fleet.data?.resource_summary.disk_gib ?? 0}GiB`}
                            accent="slate"
                        />
                    </div>
                </Panel>
                <Panel title={text('当前使用', 'Current usage')}>
                    <ResourceUsageDashboard usage={fleet.data?.usage_summary} locale={locale} />
                </Panel>
                <Panel title={text('实例', 'Instances')}>
                    <DataTable
                        items={fleet.data?.instances ?? []}
                        loading={fleet.isLoading}
                        keyGetter={(item) => item.id}
                        emptyTitle={emptyTitle}
                        columns={[
                            { id: 'name', header: text('名称', 'Name'), cell: (item) => item.name },
                            {
                                id: 'status',
                                header: text('状态', 'Status'),
                                cell: (item) => <RequestStatus status={item.status} />,
                            },
                            {
                                id: 'resources',
                                header: text('资源', 'Resources'),
                                cell: (item) => <ResourceSummaryStack resources={item.resources} locale={locale} detailedGpu />,
                                className: 'min-w-64 whitespace-normal',
                            },
                            {
                                id: 'usage',
                                header: text('当前使用', 'Current usage'),
                                cell: (item) => <ResourceUsageDashboard usage={item.usage} locale={locale} compact />,
                                className: 'min-w-[28rem] whitespace-normal',
                            },
                            {
                                id: 'authorized',
                                header: text('授权项目', 'Authorized projects'),
                                cell: (item) => <ProjectChips names={item.authorized_projects} />,
                                className: 'min-w-52 whitespace-normal',
                            },
                        ]}
                    />
                </Panel>
                <Panel title={text('项目授权', 'Project assignments')}>
                    {fleet.isLoading ? (
                        <EmptyState title={text('加载中', 'Loading')} />
                    ) : fleet.data?.assignments.length ? (
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {fleet.data.assignments.map((assignment) => (
                                <div
                                    key={assignment.project_name}
                                    className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/40"
                                >
                                    <div className="flex min-w-0 items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="truncate text-sm font-semibold text-slate-950 dark:text-slate-50">
                                                {assignment.project_name}
                                            </div>
                                            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                {assignment.whole_pool
                                                    ? text('整个资源池', 'Whole resource pool')
                                                    : text('指定实例', 'Selected instances')}
                                            </div>
                                        </div>
                                        <StatusBadge tone={assignment.whole_pool ? 'info' : 'neutral'}>
                                            {assignment.whole_pool
                                                ? text('整池', 'Whole')
                                                : text('实例', 'Instances')}
                                        </StatusBadge>
                                    </div>
                                    <div className="mt-4 text-sm text-slate-600 dark:text-slate-300">
                                        {text('实例数量', 'Instances')}:{' '}
                                        <span className="font-semibold text-slate-950 dark:text-slate-50">
                                            {assignment.whole_pool
                                                ? (fleet.data?.instances.length ?? 0)
                                                : assignment.instance_ids.length}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <EmptyState title={emptyTitle} />
                    )}
                </Panel>
            </div>
            <Modal
                open={editOpen}
                title={text('编辑资源池', 'Edit resource pool')}
                onClose={() => setEditOpen(false)}
                footer={
                    <>
                        <Button type="button" onClick={() => setEditOpen(false)}>
                            {text('取消', 'Cancel')}
                        </Button>
                        <Button type="submit" form="resource-pool-edit-form" variant="primary" loading={updateState.isLoading}>
                            {text('保存', 'Save')}
                        </Button>
                    </>
                }
            >
                <form id="resource-pool-edit-form" className="space-y-5" onSubmit={renameResourcePool}>
                    <Field label={text('资源池名称', 'Resource pool name')}>
                        <TextInput
                            aria-label={text('资源池名称', 'Resource pool name')}
                            value={editName}
                            onChange={(event) => setEditName(event.target.value)}
                        />
                    </Field>
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-500/40 dark:bg-red-500/10">
                        <div className="text-sm font-semibold text-red-700 dark:text-red-300">
                            {text('危险操作', 'Danger zone')}
                        </div>
                        <p className="mt-1 text-sm text-red-600 dark:text-red-200">
                            {text('删除资源池会移除该资源池及其接入信息。', 'Deleting a resource pool removes it and its connection information.')}
                        </p>
                        <Button
                            type="button"
                            className="mt-3"
                            variant="danger"
                            loading={deleteState.isLoading}
                            onClick={removeResourcePool}
                        >
                            {text('删除资源池', 'Delete resource pool')}
                        </Button>
                    </div>
                </form>
            </Modal>
        </>
    );
};

export const InstancesPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { emptyTitle, locale, text } = useLocaleText();
    const [confirm] = useConfirmationDialog();
    const [pushNotification] = useNotifications();
    const instances = useGetInstancesQuery(
        { include_imported: true, limit: 500 },
        { pollingInterval: 5000, refetchOnMountOrArgChange: true },
    );
    const tokens = useGetWorkerRegistrationTokensQuery();
    const resourcePools = useGetResourcePoolsQuery(
        { only_active: false, limit: 500 },
        { pollingInterval: 5000, refetchOnMountOrArgChange: true },
    );
    const [values, setValues] = useState({ fleet_name: '' });
    const [createToken, createState] = useCreateWorkerRegistrationTokenMutation();
    const [deleteToken, deleteState] = useDeleteWorkerRegistrationTokenMutation();
    const [connectOpen, setConnectOpen] = useState(false);
    const [latestToken, setLatestToken] = useState<IWorkerRegistrationToken | null>(null);
    const availableFleets = useMemo(() => resourcePools.data ?? [], [resourcePools.data]);
    const instanceResourceDetails = useMemo(() => {
        const details = new Map<string, { pool: IResourcePool; instance: IResourcePoolInstance }>();
        for (const pool of resourcePools.data ?? []) {
            for (const instance of pool.instances) {
                details.set(instance.id, { pool, instance });
            }
        }
        return details;
    }, [resourcePools.data]);
    const connectState =
        typeof location.state === 'object' && location.state
            ? (location.state as { fleetName?: string; openConnectServer?: boolean })
            : null;

    useEffect(() => {
        if (connectState?.openConnectServer) {
            setConnectOpen(true);
            setLatestToken(null);
        }
    }, [connectState?.openConnectServer]);

    useEffect(() => {
        if (resourcePools.isLoading) return;
        const firstFleetName = availableFleets[0]?.name ?? '';
        const selectedFleetExists = availableFleets.some((fleet) => fleet.name === values.fleet_name);
        if (selectedFleetExists || values.fleet_name === firstFleetName) {
            return;
        }
        const stateFleetName =
            connectState?.openConnectServer && availableFleets.some((fleet) => fleet.name === connectState.fleetName)
                ? connectState.fleetName
                : undefined;
        setValues({ fleet_name: stateFleetName ?? firstFleetName });
    }, [availableFleets, connectState?.fleetName, connectState?.openConnectServer, resourcePools.isLoading, values.fleet_name]);

    const buildServerCommand = (token?: string | null) =>
        token ? `dstack worker --server ${getBaseUrl()} --token ${token}` : '';

    const createRegistrationToken = async (event: FormEvent) => {
        event.preventDefault();
        const token = await createToken({
            fleet_name: values.fleet_name.trim(),
        }).unwrap();
        setLatestToken(token);
        pushNotification({
            type: 'success',
            header: text('接入命令已生成', 'Server connection command created'),
        });
    };

    const disableToken = (token: IWorkerRegistrationToken) => {
        confirm({
            title: text('停用注册 Token', 'Disable registration token'),
            content: text('确认停用该注册 Token？', 'Disable this registration token?'),
            confirmButtonLabel: text('停用', 'Disable'),
            onConfirm: async () => {
                await deleteToken({ id: token.id }).unwrap();
                if (latestToken?.id === token.id) {
                    setLatestToken(null);
                }
                pushNotification({
                    type: 'success',
                    header: text('Token 已停用', 'Token disabled'),
                });
            },
        });
    };

    const copyServerCommand = () => {
        const command = buildServerCommand(latestToken?.token);
        if (!command) return;
        copyToClipboard(command, () =>
            pushNotification({ type: 'success', header: text('启动命令已复制', 'Start command copied') }),
        );
    };

    const formatInstanceBackend = (backend?: string) => {
        if (backend === 'registered') {
            return text('自有服务器', 'Self-hosted server');
        }
        return backend ?? '-';
    };

    return (
        <>
            <PageHeader
                title={text('实例', 'Instances')}
                actions={
                    <Button
                        variant="primary"
                        icon={<Plus className="h-4 w-4" />}
                        onClick={() => {
                            setConnectOpen(true);
                            setLatestToken(null);
                        }}
                    >
                        {text('接入服务器', 'Connect server')}
                    </Button>
                }
            />
            <Panel title={text('实例列表', 'Instances')}>
                <DataTable
                    items={instances.data ?? []}
                    loading={instances.isLoading}
                    keyGetter={(item) => item.id}
                    emptyTitle={emptyTitle}
                    columns={[
                        {
                            id: 'name',
                            header: text('名称', 'Name'),
                            cell: (item) => (
                                <button
                                    className="font-semibold text-blue-600 dark:text-blue-300"
                                    onClick={() => navigate(CONSOLE_ROUTES.RESOURCES_INSTANCE_DETAILS.FORMAT(item.id))}
                                >
                                    {item.name}
                                </button>
                            ),
                        },
                        { id: 'fleet', header: text('资源池', 'Fleet'), cell: (item) => item.fleet_name },
                        {
                            id: 'backend',
                            header: text('接入方式', 'Access method'),
                            cell: (item) => formatInstanceBackend(item.backend),
                        },
                        {
                            id: 'resources',
                            header: text('配置', 'Configuration'),
                            cell: (item) => (
                                <ResourceSummaryStack
                                    resources={instanceResourceDetails.get(item.id)?.instance.resources}
                                    locale={locale}
                                    detailedGpu
                                />
                            ),
                            className: 'min-w-64 whitespace-normal',
                        },
                        {
                            id: 'usage',
                            header: text('当前使用', 'Current usage'),
                            cell: (item) => {
                                const usage =
                                    instanceResourceDetails.get(item.id)?.instance.usage ??
                                    (item as IInstance & { usage?: IResourcePoolUsage | null }).usage;
                                return <ResourceUsageDashboard usage={usage} locale={locale} compact />;
                            },
                            className: 'min-w-[28rem] whitespace-normal',
                        },
                        {
                            id: 'reported',
                            header: text('最近上报', 'Last report'),
                            cell: (item) => {
                                const usage =
                                    instanceResourceDetails.get(item.id)?.instance.usage ??
                                    (item as IInstance & { usage?: IResourcePoolUsage | null }).usage;
                                return formatDateWithSeconds(usage?.updated_at);
                            },
                        },
                    ]}
                />
            </Panel>
            <Panel className="mt-5" title={text('注册 Token', 'Registration tokens')}>
                <DataTable
                    items={tokens.data ?? []}
                    loading={tokens.isLoading}
                    keyGetter={(item) => item.id}
                    empty={<EmptyState title={text('暂无注册 Token', 'No registration tokens')} />}
                    emptyTitle={emptyTitle}
                    columns={[
                        { id: 'fleet', header: text('资源池', 'Fleet'), cell: (item) => item.fleet_name },
                        {
                            id: 'status',
                            header: text('状态', 'Status'),
                            cell: (item) => (
                                <StatusBadge tone={item.enabled ? 'success' : 'neutral'}>
                                    {formatStatusLabel(item.enabled ? 'enabled' : 'disabled', locale)}
                                </StatusBadge>
                            ),
                        },
                        { id: 'created', header: text('创建时间', 'Created'), cell: (item) => formatDate(item.created_at) },
                        { id: 'expires', header: text('过期时间', 'Expires'), cell: (item) => formatDate(item.expires_at) },
                        {
                            id: 'actions',
                            header: text('操作', 'Actions'),
                            cell: (item) =>
                                item.enabled ? (
                                    <Button variant="danger" loading={deleteState.isLoading} onClick={() => disableToken(item)}>
                                        {text('停用', 'Disable')}
                                    </Button>
                                ) : (
                                    <span className="text-sm text-slate-500 dark:text-slate-400">-</span>
                                ),
                        },
                    ]}
                />
            </Panel>
            <Modal
                open={connectOpen}
                title={text('接入服务器', 'Connect server')}
                onClose={() => setConnectOpen(false)}
                footer={<Button onClick={() => setConnectOpen(false)}>{text('关闭', 'Close')}</Button>}
            >
                <div className="space-y-5">
                    <form onSubmit={createRegistrationToken}>
                        <div className="space-y-4">
                            <Field
                                label={text('资源池', 'Fleet')}
                                hint={text(
                                    '服务器会作为实例加入所选资源池。',
                                    'The server will join the selected fleet as an instance.',
                                )}
                            >
                                <SelectInput
                                    aria-label={text('资源池', 'Fleet')}
                                    value={values.fleet_name}
                                    onChange={(event) => setValues({ fleet_name: event.target.value })}
                                    disabled={resourcePools.isLoading || availableFleets.length === 0}
                                >
                                    {availableFleets.map((fleet) => (
                                        <option key={fleet.id} value={fleet.name}>
                                            {fleet.name}
                                        </option>
                                    ))}
                                </SelectInput>
                            </Field>
                            {!resourcePools.isLoading && availableFleets.length === 0 && (
                                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
                                    <div>{text('还没有资源池，请先创建资源池。', 'No fleets yet. Create a fleet first.')}</div>
                                    <Button
                                        type="button"
                                        className="mt-3"
                                        onClick={() => {
                                            setConnectOpen(false);
                                            navigate(CONSOLE_ROUTES.RESOURCES_FLEET_CREATE);
                                        }}
                                    >
                                        {text('创建资源池', 'Create fleet')}
                                    </Button>
                                </div>
                            )}
                            <Button
                                type="submit"
                                variant="primary"
                                loading={createState.isLoading}
                                disabled={!values.fleet_name || availableFleets.length === 0}
                            >
                                {text('生成接入命令', 'Create connection command')}
                            </Button>
                        </div>
                    </form>
                    <Panel
                        title={text('启动命令', 'Start command')}
                        description={text(
                            'Token 只会在生成时展示一次，请复制命令到目标服务器执行。',
                            'The token is shown only when it is created. Copy the command to the target server.',
                        )}
                        actions={
                            latestToken?.token ? (
                                <Button icon={<Copy className="h-4 w-4" />} onClick={copyServerCommand}>
                                    {text('复制命令', 'Copy command')}
                                </Button>
                            ) : null
                        }
                    >
                        {latestToken?.token ? (
                            <CodeBlock value={buildServerCommand(latestToken.token)} />
                        ) : (
                            <EmptyState
                                title={text('尚未生成接入命令', 'No connection command yet')}
                                description={text(
                                    '生成后这里会显示可复制的服务器启动命令。',
                                    'After creation, the server start command appears here.',
                                )}
                            />
                        )}
                    </Panel>
                </div>
            </Modal>
        </>
    );
};

export const InstanceDetailsPage: React.FC = () => {
    const { instanceId = '' } = useParams();
    const { emptyTitle, locale, text } = useLocaleText();
    const resourcePools = useGetResourcePoolsQuery({ only_active: false, limit: 500 });
    const instanceDetails = useMemo(() => {
        for (const pool of resourcePools.data ?? []) {
            const instance = pool.instances.find((item) => item.id === instanceId);
            if (instance) {
                return { pool, instance };
            }
        }
        return null;
    }, [instanceId, resourcePools.data]);
    const instance = instanceDetails?.instance;
    const pool = instanceDetails?.pool;

    return (
        <>
            <PageHeader
                title={instance?.name ?? instanceId}
                description={pool ? `${text('资源池', 'Fleet')}: ${pool.name}` : text('全局实例', 'Global instance')}
            />
            <Panel title={text('实例信息', 'Instance information')}>
                {instance ? (
                    <DetailGrid
                        items={[
                            { label: text('名称', 'Name'), value: instance.name },
                            { label: text('资源池', 'Fleet'), value: pool?.name },
                            { label: text('编号', 'Number'), value: instance.instance_num },
                            { label: text('状态', 'Status'), value: <RequestStatus status={instance.status} /> },
                            { label: text('接入方式', 'Access method'), value: pool ? formatFleetType(pool, locale) : '-' },
                            {
                                label: text('授权项目', 'Authorized projects'),
                                value: <ProjectChips names={instance.authorized_projects} />,
                            },
                            {
                                label: 'CPU',
                                value: formatCpuCapacity(instance.resources.cpu_count, locale),
                            },
                            {
                                label: text('内存', 'Memory'),
                                value: `${instance.resources.memory_gib ?? 0}GiB`,
                            },
                            {
                                label: 'GPU',
                                value: formatDetailedGpuCapacity(instance.resources, locale),
                            },
                            {
                                label: text('磁盘', 'Disk'),
                                value: `${instance.resources.disk_gib ?? 0}GiB`,
                            },
                        ]}
                    />
                ) : resourcePools.isLoading ? (
                    <EmptyState title={text('加载中', 'Loading')} />
                ) : (
                    <EmptyState title={text('实例不存在', 'Instance not found')} description={emptyTitle} />
                )}
            </Panel>
            {instance && (
                <Panel className="mt-5" title={text('当前使用', 'Current usage')}>
                    <ResourceUsageDashboard usage={instance.usage} locale={locale} />
                </Panel>
            )}
        </>
    );
};

export const OffersPage: React.FC = () => {
    const { projects } = useConsoleContext();
    const { emptyTitle, text } = useLocaleText();
    const [projectName, setProjectName] = useState(projects[0]?.project_name ?? '');
    const offers = useGetGpusListQuery(
        {
            project_name: projectName,
            group_by: ['backend', 'region'],
            run_spec: {
                ssh_key_pub: '',
                configuration: { type: 'task', resources: {} },
            },
        },
        { skip: !projectName },
    );

    return (
        <>
            <PageHeader title={text('资源报价', 'Offers')} />
            <Panel
                title={text('GPU 资源', 'GPU resources')}
                actions={
                    <SelectInput value={projectName} onChange={(event) => setProjectName(event.target.value)}>
                        {projects.map((project) => (
                            <option key={project.project_name} value={project.project_name}>
                                {project.project_name}
                            </option>
                        ))}
                    </SelectInput>
                }
            >
                <DataTable
                    items={offers.data?.gpus ?? []}
                    loading={offers.isLoading}
                    keyGetter={(item, index = 0) => `${item.name}-${item.backend}-${item.region}-${index}`}
                    emptyTitle={emptyTitle}
                    columns={[
                        { id: 'name', header: 'GPU', cell: (item) => item.name },
                        { id: 'backend', header: text('后端', 'Backend'), cell: (item) => valueOrDash(item.backend) },
                        { id: 'region', header: text('区域', 'Region'), cell: (item) => valueOrDash(item.region) },
                        { id: 'count', header: text('数量', 'Count'), cell: (item) => `${item.count.min}..${item.count.max}` },
                        { id: 'price', header: text('价格', 'Price'), cell: (item) => `${item.price.min}..${item.price.max}` },
                    ]}
                />
            </Panel>
        </>
    );
};

export const ModelsPage: React.FC = () => {
    const navigate = useNavigate();
    const { emptyTitle, text } = useLocaleText();
    const models = useGetModelsQuery({ limit: 500 });

    return (
        <>
            <PageHeader title={text('模型服务', 'Models')} />
            <Panel title={text('模型列表', 'Models')}>
                <DataTable
                    items={models.data ?? []}
                    loading={models.isLoading}
                    keyGetter={(item) => item.id}
                    emptyTitle={emptyTitle}
                    columns={[
                        {
                            id: 'name',
                            header: text('名称', 'Name'),
                            cell: (item) => (
                                <button
                                    className="font-semibold text-blue-600 dark:text-blue-300"
                                    onClick={() =>
                                        navigate(
                                            CONSOLE_ROUTES.RESOURCES_MODEL_DETAILS.FORMAT(item.project_name, item.run_name),
                                        )
                                    }
                                >
                                    {item.name ?? item.run_name}
                                </button>
                            ),
                        },
                        { id: 'project', header: text('项目', 'Project'), cell: (item) => item.project_name },
                        { id: 'user', header: text('用户', 'User'), cell: (item) => item.user },
                        { id: 'resources', header: text('资源', 'Resources'), cell: (item) => valueOrDash(item.resources) },
                    ]}
                />
            </Panel>
        </>
    );
};

export const ModelDetailsPage: React.FC = () => {
    const { projectName = '', runName = '' } = useParams();
    const { text } = useLocaleText();
    const runs = useGetRunsQuery({ project_name: projectName, limit: 100 });
    const modelRun = runs.data?.find((run) => run.run_spec.run_name === runName);

    return (
        <>
            <PageHeader title={runName} description={projectName} />
            <Panel title={text('模型详情', 'Model details')}>
                {modelRun?.service?.model ? (
                    <DetailGrid
                        items={Object.entries(modelRun.service.model).map(([key, value]) => ({
                            label: key,
                            value: typeof value === 'string' || typeof value === 'number' ? String(value) : '-',
                        }))}
                    />
                ) : (
                    <EmptyState title={text('暂无模型详情', 'No model details')} />
                )}
            </Panel>
        </>
    );
};

export const VolumesPage: React.FC = () => {
    const { emptyTitle, text } = useLocaleText();
    const volumes = useGetAllVolumesQuery({ limit: 500 });
    const [confirm] = useConfirmationDialog();
    const [deleteVolumes] = useDeleteVolumesMutation();
    const removeVolume = (volume: IVolume) =>
        confirm({
            title: text('删除存储卷', 'Delete volume'),
            content: text('确认删除该存储卷？此操作不可恢复。', 'Delete this volume? This action cannot be undone.'),
            confirmButtonLabel: text('删除', 'Delete'),
            onConfirm: () => deleteVolumes({ project_name: volume.project_name, names: [volume.name] }),
        });

    return (
        <>
            <PageHeader title={text('存储卷', 'Volumes')} />
            <Panel title={text('存储卷列表', 'Volumes')}>
                <DataTable
                    items={volumes.data ?? []}
                    loading={volumes.isLoading}
                    keyGetter={(item) => item.id}
                    emptyTitle={emptyTitle}
                    columns={[
                        { id: 'name', header: text('名称', 'Name'), cell: (item) => item.name },
                        { id: 'project', header: text('项目', 'Project'), cell: (item) => item.project_name },
                        {
                            id: 'status',
                            header: text('状态', 'Status'),
                            cell: (item) => <RequestStatus status={item.status} />,
                        },
                        { id: 'backend', header: text('后端', 'Backend'), cell: (item) => item.configuration.backend },
                        {
                            id: 'size',
                            header: text('大小', 'Size'),
                            cell: (item) => `${item.provisioning_data?.size_gb ?? item.configuration.size ?? '-'} GB`,
                        },
                        {
                            id: 'actions',
                            header: text('操作', 'Actions'),
                            cell: (item) => (
                                <Button variant="danger" onClick={() => removeVolume(item)}>
                                    {text('删除', 'Delete')}
                                </Button>
                            ),
                        },
                    ]}
                />
            </Panel>
        </>
    );
};

export const ProjectsPage: React.FC = () => {
    const navigate = useNavigate();
    const { emptyTitle, text } = useLocaleText();
    const projects = useGetProjectsQuery({ include_not_joined: true, limit: 500 });

    return (
        <>
            <PageHeader
                title={text('项目', 'Projects')}
                actions={
                    <Button
                        variant="primary"
                        icon={<Plus className="h-4 w-4" />}
                        onClick={() => navigate(CONSOLE_ROUTES.WORKSPACE_PROJECT_CREATE)}
                    >
                        {text('创建项目', 'Create project')}
                    </Button>
                }
            />
            <Panel title={text('项目列表', 'Projects')}>
                <DataTable
                    items={projects.data?.data ?? []}
                    loading={projects.isLoading}
                    keyGetter={(item) => item.project_name}
                    emptyTitle={emptyTitle}
                    columns={[
                        {
                            id: 'name',
                            header: text('名称', 'Name'),
                            cell: (item) => (
                                <button
                                    className="font-semibold text-blue-600 dark:text-blue-300"
                                    onClick={() => navigate(CONSOLE_ROUTES.WORKSPACE_PROJECT_DETAILS.FORMAT(item.project_name))}
                                >
                                    {item.project_name}
                                </button>
                            ),
                        },
                        { id: 'owner', header: text('所有者', 'Owner'), cell: (item) => item.owner.username },
                        { id: 'members', header: text('成员', 'Members'), cell: (item) => item.members.length },
                        { id: 'created', header: text('创建时间', 'Created'), cell: (item) => formatDate(item.created_at) },
                        {
                            id: 'actions',
                            header: text('操作', 'Actions'),
                            cell: (item) => (
                                <Button
                                    onClick={() => navigate(CONSOLE_ROUTES.WORKSPACE_PROJECT_DETAILS.FORMAT(item.project_name))}
                                >
                                    {text('编辑', 'Edit')}
                                </Button>
                            ),
                        },
                    ]}
                />
            </Panel>
        </>
    );
};

export const ProjectCreatePage: React.FC = () => {
    const navigate = useNavigate();
    const { text } = useLocaleText();
    const [createProject, createState] = useCreateProjectMutation();
    const [projectName, setProjectName] = useState('');
    const [isPublic, setIsPublic] = useState(false);

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        const project = await createProject({ project_name: projectName, is_public: isPublic }).unwrap();
        navigate(CONSOLE_ROUTES.WORKSPACE_PROJECT_DETAILS.FORMAT(project.project_name));
    };

    return (
        <>
            <PageHeader title={text('创建项目', 'Create project')} />
            <form onSubmit={submit}>
                <Panel title={text('项目设置', 'Project settings')}>
                    <div className="grid gap-4 md:grid-cols-2">
                        <Field label={text('项目名称', 'Project name')}>
                            <TextInput value={projectName} onChange={(event) => setProjectName(event.target.value)} />
                        </Field>
                        <Field label={text('可见性', 'Visibility')}>
                            <SelectInput
                                value={isPublic ? 'public' : 'private'}
                                onChange={(event) => setIsPublic(event.target.value === 'public')}
                            >
                                <option value="private">{text('私有', 'Private')}</option>
                                <option value="public">{text('公开', 'Public')}</option>
                            </SelectInput>
                        </Field>
                    </div>
                </Panel>
                <div className="mt-4 flex justify-end">
                    <Button type="submit" variant="primary" loading={createState.isLoading}>
                        {text('创建', 'Create')}
                    </Button>
                </div>
            </form>
        </>
    );
};

export const ProjectDetailsPage: React.FC = () => {
    const { projectName = '' } = useParams();
    const navigate = useNavigate();
    const { emptyTitle, locale, text } = useLocaleText();
    const project = useGetProjectQuery({ name: projectName });
    const repos = useGetProjectReposQuery({ project_name: projectName });
    const backends = useGetProjectBackendsQuery({ projectName });
    const resourcePools = useGetResourcePoolsQuery({ only_active: false, limit: 500 });
    const projectResourcePools = useGetProjectResourcePoolsQuery({ projectName }, { skip: !projectName });
    const secrets = useGetAllSecretsQuery({ project_name: projectName });
    const events = useGetAllEventsQuery({ within_projects: [projectName], limit: 20 });
    const [updateProject, updateProjectState] = useUpdateProjectMutation();
    const [updateResourcePoolAssignment, updateResourcePoolAssignmentState] = useUpdateResourcePoolAssignmentMutation();
    const [deleteProjects] = useDeleteProjectsMutation();
    const [addMember, addMemberState] = useAddProjectMemberMutation();
    const [removeMember] = useRemoveProjectMemberMutation();
    const [searchUsers, userSearch] = useLazyGetUserListQuery();
    const [updateSecret] = useUpdateSecretMutation();
    const [deleteSecrets] = useDeleteSecretsMutation();
    const [confirm] = useConfirmationDialog();
    const [pushNotification] = useNotifications();
    const [memberSearch, setMemberSearch] = useState('');
    const [selectedMember, setSelectedMember] = useState<IUser | null>(null);
    const [secretName, setSecretName] = useState('');
    const [secretValue, setSecretValue] = useState('');
    const [settings, setSettings] = useState({
        projectName,
        isPublic: false,
    });
    const [resourceAssignment, setResourceAssignment] = useState({
        resourcePoolName: '',
        assignWholePool: true,
        instanceIds: [] as string[],
    });

    useEffect(() => {
        if (!project.data) return;
        setSettings({
            projectName: project.data.project_name,
            isPublic: project.data.isPublic,
        });
    }, [project.data?.project_name, project.data?.isPublic]);

    const existingMemberNames = useMemo(
        () => new Set((project.data?.members ?? []).map((member) => member.user.username)),
        [project.data?.members],
    );
    const memberCandidates = useMemo(
        () => (userSearch.data?.data ?? []).filter((candidate) => !existingMemberNames.has(candidate.username)),
        [existingMemberNames, userSearch.data?.data],
    );
    const selectedResourcePool = useMemo(
        () => resourcePools.data?.find((pool) => pool.name === resourceAssignment.resourcePoolName),
        [resourceAssignment.resourcePoolName, resourcePools.data],
    );

    useEffect(() => {
        if (resourceAssignment.resourcePoolName || !resourcePools.data?.length) return;
        setResourceAssignment((current) => ({
            ...current,
            resourcePoolName: resourcePools.data[0].name,
        }));
    }, [resourceAssignment.resourcePoolName, resourcePools.data]);

    const submitSettings = async (event: FormEvent) => {
        event.preventDefault();
        const updatedProject = await updateProject({
            project_name: projectName,
            new_project_name: settings.projectName.trim(),
            is_public: settings.isPublic,
        }).unwrap();
        if (updatedProject.project_name !== projectName) {
            navigate(CONSOLE_ROUTES.WORKSPACE_PROJECT_DETAILS.FORMAT(updatedProject.project_name));
        }
    };

    const searchProjectMember = (value: string) => {
        setMemberSearch(value);
        setSelectedMember(null);
        const namePattern = value.trim();
        if (namePattern) {
            searchUsers({ name_pattern: namePattern });
        }
    };

    const addSelectedMember = async () => {
        if (!selectedMember) return;
        await addMember({ project_name: projectName, username: selectedMember.username }).unwrap();
        setSelectedMember(null);
        setMemberSearch('');
    };

    const removeProject = () =>
        confirm({
            title: text('删除项目', 'Delete project'),
            content: text('确认删除该项目？此操作不可恢复。', 'Delete this project? This action cannot be undone.'),
            confirmButtonLabel: text('删除', 'Delete'),
            onConfirm: async () => {
                try {
                    await deleteProjects([projectName]).unwrap();
                    pushNotification({ type: 'success', header: text('项目已删除', 'Project deleted') });
                    navigate(CONSOLE_ROUTES.WORKSPACE_PROJECTS);
                } catch {
                    pushNotification({ type: 'error', header: text('项目删除失败', 'Failed to delete project') });
                }
            },
        });

    const removeProjectMember = (username: string) =>
        confirm({
            title: text('移除成员', 'Remove member'),
            content: text('确认将该成员移出项目？', 'Remove this member from the project?'),
            confirmButtonLabel: text('移除', 'Remove'),
            onConfirm: () => removeMember({ project_name: projectName, username }),
        });

    const removeSecret = (name: string) =>
        confirm({
            title: text('删除 Secret', 'Delete secret'),
            content: text('确认删除该 Secret？此操作不可恢复。', 'Delete this secret? This action cannot be undone.'),
            confirmButtonLabel: text('删除', 'Delete'),
            onConfirm: () => deleteSecrets({ project_name: projectName, names: [name] }),
        });

    const submitResourceAssignment = async (event: FormEvent) => {
        event.preventDefault();
        if (!resourceAssignment.resourcePoolName) return;
        await updateResourcePoolAssignment({
            resource_pool_name: resourceAssignment.resourcePoolName,
            project_name: projectName,
            assign_whole_pool: resourceAssignment.assignWholePool,
            instance_ids: resourceAssignment.assignWholePool ? [] : resourceAssignment.instanceIds,
        }).unwrap();
        pushNotification({ type: 'success', header: text('资源授权已更新', 'Resource assignment updated') });
    };

    const toggleAssignedInstance = (instanceId: string) => {
        setResourceAssignment((current) => ({
            ...current,
            instanceIds: current.instanceIds.includes(instanceId)
                ? current.instanceIds.filter((id) => id !== instanceId)
                : [...current.instanceIds, instanceId],
        }));
    };

    return (
        <>
            <PageHeader
                title={projectName}
                description={text(
                    '项目设置、成员、后端、网关、Secrets 和事件。',
                    'Project settings, members, backends, gateways, secrets, and events.',
                )}
            />
            <div className="grid gap-6">
                <form onSubmit={submitSettings}>
                    <Panel
                        title={text('项目设置', 'Project settings')}
                        description={text('修改项目名称和可见性。', 'Edit project name and visibility.')}
                        actions={
                            <>
                                <Button type="button" variant="danger" onClick={removeProject}>
                                    {text('删除项目', 'Delete project')}
                                </Button>
                                <Button
                                    type="submit"
                                    variant="primary"
                                    icon={<Save className="h-4 w-4" />}
                                    loading={updateProjectState.isLoading || project.isLoading}
                                >
                                    {text('保存', 'Save')}
                                </Button>
                            </>
                        }
                    >
                        <div className="grid gap-4 md:grid-cols-2">
                            <Field label={text('项目名称', 'Project name')}>
                                <TextInput
                                    value={settings.projectName}
                                    onChange={(event) =>
                                        setSettings((current) => ({ ...current, projectName: event.target.value }))
                                    }
                                />
                            </Field>
                            <Field label={text('可见性', 'Visibility')}>
                                <SelectInput
                                    value={settings.isPublic ? 'public' : 'private'}
                                    onChange={(event) =>
                                        setSettings((current) => ({
                                            ...current,
                                            isPublic: event.target.value === 'public',
                                        }))
                                    }
                                >
                                    <option value="private">{text('私有', 'Private')}</option>
                                    <option value="public">{text('公开', 'Public')}</option>
                                </SelectInput>
                            </Field>
                        </div>
                    </Panel>
                </form>
                <Panel title={text('成员', 'Members')}>
                    <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                        <div className="relative">
                            <SearchInput
                                value={memberSearch}
                                onChange={(event) => searchProjectMember(event.target.value)}
                                placeholder={text('搜索用户', 'Search users')}
                            />
                            {memberSearch.trim() && !selectedMember && (
                                <div className="absolute z-10 mt-2 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                                    {memberCandidates.length > 0 ? (
                                        memberCandidates.map((candidate) => (
                                            <button
                                                key={candidate.username}
                                                type="button"
                                                className="block w-full px-4 py-3 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                                                onClick={() => {
                                                    setSelectedMember(candidate);
                                                    setMemberSearch(candidate.username);
                                                }}
                                            >
                                                <span className="block font-semibold text-slate-950 dark:text-slate-50">
                                                    {candidate.username}
                                                </span>
                                                <span className="block text-xs text-slate-500 dark:text-slate-400">
                                                    {valueOrDash(candidate.email)}
                                                </span>
                                            </button>
                                        ))
                                    ) : (
                                        <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                                            {userSearch.isFetching
                                                ? text('搜索中...', 'Searching...')
                                                : text('没有可添加的用户', 'No users to add')}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <Button loading={addMemberState.isLoading} disabled={!selectedMember} onClick={addSelectedMember}>
                            {text('添加成员', 'Add member')}
                        </Button>
                    </div>
                    <DataTable
                        items={project.data?.members ?? []}
                        loading={project.isLoading}
                        keyGetter={(item) => item.user.username}
                        emptyTitle={emptyTitle}
                        columns={[
                            { id: 'user', header: text('用户', 'User'), cell: (item) => item.user.username },
                            {
                                id: 'role',
                                header: text('角色', 'Role'),
                                cell: (item) => getProjectRoleText(item.project_role, locale),
                            },
                            {
                                id: 'actions',
                                header: text('操作', 'Actions'),
                                cell: (item) => (
                                    <Button variant="danger" onClick={() => removeProjectMember(item.user.username)}>
                                        {text('移除', 'Remove')}
                                    </Button>
                                ),
                            },
                        ]}
                    />
                </Panel>
                <Panel title="Backends">
                    <DataTable
                        items={backends.data ?? project.data?.backends ?? []}
                        loading={backends.isLoading}
                        keyGetter={(item) => item.name}
                        emptyTitle={emptyTitle}
                        columns={[
                            { id: 'name', header: text('名称', 'Name'), cell: (item) => item.name },
                            { id: 'type', header: text('类型', 'Type'), cell: (item) => item.config?.type },
                        ]}
                    />
                </Panel>
                <Panel
                    title={text('资源授权', 'Resource assignment')}
                    description={text(
                        '项目可使用被授权的整个资源池，或资源池中的指定实例。',
                        'A project can use an assigned whole fleet or selected instances within a fleet.',
                    )}
                >
                    <form
                        className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(220px,320px)_auto]"
                        onSubmit={submitResourceAssignment}
                    >
                        <Field label={text('资源池', 'Fleet')}>
                            <SelectInput
                                value={resourceAssignment.resourcePoolName}
                                onChange={(event) =>
                                    setResourceAssignment({
                                        resourcePoolName: event.target.value,
                                        assignWholePool: true,
                                        instanceIds: [],
                                    })
                                }
                                disabled={resourcePools.isLoading || !resourcePools.data?.length}
                            >
                                {(resourcePools.data ?? []).map((pool) => (
                                    <option key={pool.id} value={pool.name}>
                                        {pool.name} - {formatAggregateResourceCapacity(pool.resource_summary, locale)}
                                    </option>
                                ))}
                            </SelectInput>
                        </Field>
                        <Field label={text('授权范围', 'Scope')}>
                            <SelectInput
                                value={resourceAssignment.assignWholePool ? 'whole' : 'instances'}
                                onChange={(event) =>
                                    setResourceAssignment((current) => ({
                                        ...current,
                                        assignWholePool: event.target.value === 'whole',
                                        instanceIds: event.target.value === 'whole' ? [] : current.instanceIds,
                                    }))
                                }
                                disabled={!selectedResourcePool}
                            >
                                <option value="whole">{text('整个资源池', 'Whole fleet')}</option>
                                <option value="instances">{text('指定实例', 'Selected instances')}</option>
                            </SelectInput>
                        </Field>
                        <div className="flex items-end">
                            <Button
                                type="submit"
                                variant="primary"
                                loading={updateResourcePoolAssignmentState.isLoading}
                                disabled={
                                    !resourceAssignment.resourcePoolName ||
                                    (!resourceAssignment.assignWholePool && resourceAssignment.instanceIds.length === 0)
                                }
                            >
                                {text('保存授权', 'Save assignment')}
                            </Button>
                        </div>
                    </form>
                    {!resourceAssignment.assignWholePool && selectedResourcePool && (
                        <div className="mb-5 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                            <div className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
                                {text('选择实例', 'Select instances')}
                            </div>
                            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                                {selectedResourcePool.instances.map((instance) => (
                                    <label
                                        key={instance.id}
                                        className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-800"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={resourceAssignment.instanceIds.includes(instance.id)}
                                            onChange={() => toggleAssignedInstance(instance.id)}
                                        />
                                        <span className="font-medium">{instance.name}</span>
                                        <span className="text-slate-500 dark:text-slate-400">
                                            {formatDetailedGpuCapacity(instance.resources, locale)}
                                        </span>
                                        <span className="text-slate-500 dark:text-slate-400">
                                            {formatStatusLabel(instance.occupancy.status, locale)}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                    <DataTable
                        items={projectResourcePools.data ?? []}
                        loading={projectResourcePools.isLoading}
                        keyGetter={(item) => item.id}
                        empty={<EmptyState title={text('暂无资源授权', 'No resource assignments')} />}
                        emptyTitle={emptyTitle}
                        columns={[
                            {
                                id: 'name',
                                header: text('资源池', 'Fleet'),
                                cell: (item) => (
                                    <button
                                        className="font-semibold text-blue-600 dark:text-blue-300"
                                        onClick={() => navigate(CONSOLE_ROUTES.RESOURCES_FLEET_DETAILS.FORMAT('_', item.id))}
                                    >
                                        {item.name}
                                    </button>
                                ),
                            },
                            {
                                id: 'status',
                                header: text('状态', 'Status'),
                                cell: (item) => <RequestStatus status={item.status} />,
                            },
                            {
                                id: 'resources',
                                header: text('资源', 'Resources'),
                                cell: (item) => <ResourceSummaryStack resources={item.resource_summary} locale={locale} />,
                                className: 'min-w-56 whitespace-normal',
                            },
                            {
                                id: 'usage',
                                header: text('当前使用', 'Current usage'),
                                cell: (item) => <ResourceUsageDashboard usage={item.usage_summary} locale={locale} compact />,
                                className: 'min-w-[28rem] whitespace-normal',
                            },
                            {
                                id: 'assignment',
                                header: text('授权范围', 'Scope'),
                                cell: (item) => {
                                    const assignment = item.assignments.find(
                                        (assignment) => assignment.project_name === projectName,
                                    );
                                    if (!assignment) return '-';
                                    return assignment.whole_pool
                                        ? text('整个资源池', 'Whole fleet')
                                        : text('指定实例', 'Selected instances');
                                },
                            },
                            {
                                id: 'instances',
                                header: text('实例', 'Instances'),
                                cell: (item) => item.instances.length,
                            },
                            {
                                id: 'idle',
                                header: text('闲置', 'Idle'),
                                cell: (item) => item.idle_instance_count,
                            },
                            {
                                id: 'busy',
                                header: text('占用', 'Busy'),
                                cell: (item) => item.busy_instance_count,
                            },
                        ]}
                    />
                </Panel>
                <Panel title="Secrets">
                    <div className="mb-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                        <TextInput
                            value={secretName}
                            onChange={(event) => setSecretName(event.target.value)}
                            placeholder="NAME"
                        />
                        <TextInput
                            value={secretValue}
                            onChange={(event) => setSecretValue(event.target.value)}
                            placeholder="value"
                        />
                        <Button
                            onClick={() => updateSecret({ project_name: projectName, name: secretName, value: secretValue })}
                        >
                            {text('保存', 'Save')}
                        </Button>
                    </div>
                    <DataTable
                        items={secrets.data ?? []}
                        loading={secrets.isLoading}
                        keyGetter={(item) => item.id}
                        emptyTitle={emptyTitle}
                        columns={[
                            { id: 'name', header: text('名称', 'Name'), cell: (item) => item.name },
                            {
                                id: 'actions',
                                header: text('操作', 'Actions'),
                                cell: (item) => (
                                    <Button variant="danger" onClick={() => removeSecret(item.name)}>
                                        {text('删除', 'Delete')}
                                    </Button>
                                ),
                            },
                        ]}
                    />
                </Panel>
                <Panel title="Repos">
                    <DataTable
                        items={repos.data ?? []}
                        loading={repos.isLoading}
                        keyGetter={(item) => item.id}
                        emptyTitle={emptyTitle}
                        columns={[
                            { id: 'name', header: text('名称', 'Name'), cell: (item) => valueOrDash(item.repo_id ?? item.id) },
                            { id: 'type', header: text('类型', 'Type'), cell: (item) => valueOrDash(item.repo_type) },
                            { id: 'created', header: text('创建时间', 'Created'), cell: (item) => formatDate(item.created_at) },
                        ]}
                    />
                </Panel>
                <Panel title={text('事件', 'Events')}>
                    <DataTable
                        items={events.data ?? []}
                        loading={events.isLoading}
                        keyGetter={(item) => item.id}
                        emptyTitle={emptyTitle}
                        columns={[
                            { id: 'time', header: text('时间', 'Time'), cell: (item) => formatDate(item.recorded_at) },
                            {
                                id: 'message',
                                header: text('消息', 'Message'),
                                cell: (item) => formatEventMessage(item.message, locale),
                            },
                            {
                                id: 'actor',
                                header: text('操作者', 'Actor'),
                                cell: (item) => formatEventActor(item.actor_user, locale),
                            },
                        ]}
                    />
                </Panel>
            </div>
        </>
    );
};

export const BackendPage: React.FC<{ create?: boolean }> = ({ create }) => {
    const { projectName = '', backendName = '' } = useParams();
    const { text } = useLocaleText();
    const [confirm] = useConfirmationDialog();
    const [deleteBackend] = useDeleteProjectBackendMutation();
    const removeBackend = () =>
        confirm({
            title: text('删除 Backend', 'Delete backend'),
            content: text('确认删除该 Backend？此操作不可恢复。', 'Delete this backend? This action cannot be undone.'),
            confirmButtonLabel: text('删除', 'Delete'),
            onConfirm: () => deleteBackend({ projectName, backends_names: [backendName] }),
        });

    return (
        <>
            <PageHeader
                title={create ? text('新建 Backend', 'New backend') : backendName}
                actions={
                    !create && (
                        <Button variant="danger" onClick={removeBackend}>
                            {text('删除', 'Delete')}
                        </Button>
                    )
                }
            />
            <Panel title={text('Backend 配置', 'Backend configuration')}>
                <EmptyState
                    title={text('请通过命令行管理 Backend', 'Manage backends from the command line')}
                    description={text(
                        '新控制台不再直接展示底层配置。请使用 dstack CLI 管理项目 Backend。',
                        'The new console no longer displays low-level configuration. Use the dstack CLI to manage project backends.',
                    )}
                />
            </Panel>
        </>
    );
};

export const GatewayPage: React.FC<{ create?: boolean }> = ({ create }) => {
    const { projectName = '', gatewayName = '' } = useParams();
    const { text } = useLocaleText();
    return (
        <>
            <PageHeader title={create ? text('新建网关', 'New gateway') : gatewayName} description={projectName} />
            <Panel title={text('网关配置', 'Gateway configuration')}>
                <EmptyState
                    title={text('请通过命令行管理网关', 'Manage gateways from the command line')}
                    description={text(
                        '新控制台不再直接展示底层配置。请使用 dstack CLI 管理项目网关。',
                        'The new console no longer displays low-level configuration. Use the dstack CLI to manage project gateways.',
                    )}
                />
            </Panel>
        </>
    );
};

export const UsersPage: React.FC = () => {
    const navigate = useNavigate();
    const { emptyTitle, locale, text } = useLocaleText();
    const users = useGetUserListQuery({ limit: 500 });

    return (
        <>
            <PageHeader
                title={text('用户管理', 'Users')}
                actions={
                    <Button
                        variant="primary"
                        icon={<Plus className="h-4 w-4" />}
                        onClick={() => navigate(CONSOLE_ROUTES.ADMIN_USER_CREATE)}
                    >
                        {text('创建用户', 'Create user')}
                    </Button>
                }
            />
            <Panel title={text('用户列表', 'Users')}>
                <DataTable
                    items={users.data?.data ?? []}
                    loading={users.isLoading}
                    keyGetter={(item) => item.username}
                    emptyTitle={emptyTitle}
                    columns={[
                        {
                            id: 'username',
                            header: text('用户名', 'Username'),
                            cell: (item) => (
                                <button
                                    className="font-semibold text-blue-600 dark:text-blue-300"
                                    onClick={() => navigate(CONSOLE_ROUTES.ADMIN_USER_DETAILS.FORMAT(item.username))}
                                >
                                    {item.username}
                                </button>
                            ),
                        },
                        {
                            id: 'role',
                            header: text('角色', 'Role'),
                            cell: (item) => (
                                <StatusBadge tone={item.global_role === 'admin' ? 'info' : 'neutral'}>
                                    {getUserRoleText(item.global_role, locale)}
                                </StatusBadge>
                            ),
                        },
                        { id: 'email', header: 'Email', cell: (item) => valueOrDash(item.email) },
                        {
                            id: 'active',
                            header: text('状态', 'Status'),
                            cell: (item) => (
                                <StatusBadge tone={item.active ? 'success' : 'danger'}>
                                    {formatStatusLabel(item.active ? 'enabled' : 'disabled', locale)}
                                </StatusBadge>
                            ),
                        },
                        {
                            id: 'actions',
                            header: text('操作', 'Actions'),
                            cell: (item) => (
                                <Button onClick={() => navigate(CONSOLE_ROUTES.ADMIN_USER_DETAILS.FORMAT(item.username))}>
                                    {text('编辑', 'Edit')}
                                </Button>
                            ),
                        },
                    ]}
                />
            </Panel>
        </>
    );
};

export const UserCreatePage: React.FC = () => {
    const navigate = useNavigate();
    const { locale, text } = useLocaleText();
    const [createUser, createState] = useCreateUserMutation();
    const [values, setValues] = useState({
        username: '',
        email: '',
        global_role: 'user' as TUserRole,
        active: true,
    });

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        const user = await createUser({ ...values, email: values.email.trim() || null }).unwrap();
        navigate(CONSOLE_ROUTES.ADMIN_USER_DETAILS.FORMAT(user.username));
    };

    return (
        <>
            <PageHeader title={text('创建用户', 'Create user')} />
            <form onSubmit={submit}>
                <Panel title={text('用户信息', 'User info')}>
                    <div className="grid gap-4 md:grid-cols-2">
                        <Field label={text('用户名', 'Username')}>
                            <TextInput
                                value={values.username}
                                onChange={(event) => setValues((current) => ({ ...current, username: event.target.value }))}
                            />
                        </Field>
                        <Field label="Email">
                            <TextInput
                                value={values.email}
                                onChange={(event) => setValues((current) => ({ ...current, email: event.target.value }))}
                            />
                        </Field>
                        <Field label={text('角色', 'Role')}>
                            <SelectInput
                                value={values.global_role}
                                onChange={(event) =>
                                    setValues((current) => ({ ...current, global_role: event.target.value as TUserRole }))
                                }
                            >
                                <option value="user">{getUserRoleText('user', locale)}</option>
                                <option value="admin">{getUserRoleText('admin', locale)}</option>
                            </SelectInput>
                        </Field>
                    </div>
                </Panel>
                <div className="mt-4 flex justify-end">
                    <Button type="submit" variant="primary" loading={createState.isLoading}>
                        {text('创建', 'Create')}
                    </Button>
                </div>
            </form>
        </>
    );
};

export const UserDetailsPage: React.FC = () => {
    const { userName = '' } = useParams();
    const { locale, text } = useLocaleText();
    const navigate = useNavigate();
    const user = useGetUserQuery({ name: userName });
    const billing = useGetUserBillingInfoQuery({ username: userName }, { skip: process.env.UI_VERSION !== 'sky' });
    const [updateUser] = useUpdateUserMutation();
    const [deleteUsers] = useDeleteUsersMutation();
    const [refreshToken, refreshState] = useRefreshTokenMutation();
    const [confirm] = useConfirmationDialog();
    const [pushNotification] = useNotifications();
    const [values, setValues] = useState<TUpdateUserParams>({
        username: userName,
        email: null,
        global_role: 'user',
        active: true,
    });

    useEffect(() => {
        if (!user.data) return;
        setValues({
            username: user.data.username,
            email: user.data.email,
            global_role: user.data.global_role,
            active: user.data.active,
        });
    }, [user.data?.username, user.data?.email, user.data?.global_role, user.data?.active]);

    const refresh = async () => {
        const result = await refreshToken({ username: userName }).unwrap();
        copyToClipboard(result.creds.token, () =>
            pushNotification({ type: 'success', header: text('Token 已复制', 'Token copied') }),
        );
    };

    const removeUser = () =>
        confirm({
            title: text('删除用户', 'Delete user'),
            content: text('确认删除该用户？此操作不可恢复。', 'Delete this user? This action cannot be undone.'),
            confirmButtonLabel: text('删除', 'Delete'),
            onConfirm: async () => {
                try {
                    await deleteUsers([userName]).unwrap();
                    pushNotification({ type: 'success', header: text('用户已删除', 'User deleted') });
                    navigate(CONSOLE_ROUTES.ADMIN_USERS);
                } catch {
                    pushNotification({ type: 'error', header: text('用户删除失败', 'Failed to delete user') });
                }
            },
        });

    const toggleUserActive = () => {
        const nextActive = !values.active;
        confirm({
            title: nextActive ? text('启用账号', 'Activate account') : text('停用账号', 'Deactivate account'),
            content: nextActive
                ? text('确认启用该用户账号？', 'Activate this user account?')
                : text('确认停用该用户账号？', 'Deactivate this user account?'),
            confirmButtonLabel: nextActive ? text('启用', 'Activate') : text('停用', 'Deactivate'),
            onConfirm: async () => {
                try {
                    await updateUser({
                        username: values.username,
                        email: values.email?.trim() || null,
                        global_role: values.global_role,
                        active: nextActive,
                    }).unwrap();
                    setValues((current) => ({ ...current, active: nextActive }));
                    pushNotification({
                        type: 'success',
                        header: nextActive ? text('用户已启用', 'User activated') : text('用户已停用', 'User deactivated'),
                    });
                } catch {
                    pushNotification({
                        type: 'error',
                        header: nextActive
                            ? text('用户启用失败', 'Failed to activate user')
                            : text('用户停用失败', 'Failed to deactivate user'),
                    });
                }
            },
        });
    };

    return (
        <>
            <PageHeader
                title={userName}
                actions={
                    <Button icon={<RefreshCcw className="h-4 w-4" />} loading={refreshState.isLoading} onClick={refresh}>
                        {text('刷新 Token', 'Refresh token')}
                    </Button>
                }
            />
            <div className="grid gap-6">
                <Panel
                    title={text('用户信息', 'User info')}
                    description={text(
                        '用户名、邮箱、创建时间、状态和角色只读。',
                        'Username, email, creation time, status, and role are read-only.',
                    )}
                >
                    <div className="grid gap-4 md:grid-cols-2">
                        <ProfileInfoItem label={text('用户 ID', 'User ID')} value={valueOrDash(user.data?.id)} />
                        <ProfileInfoItem label={text('用户名', 'Username')} value={valueOrDash(user.data?.username)} />
                        <ProfileInfoItem label={text('创建时间', 'Created')} value={formatDate(user.data?.created_at)} />
                        <ProfileInfoItem
                            label={text('当前状态', 'Current status')}
                            value={
                                <StatusBadge tone={values.active ? 'success' : 'danger'}>
                                    {formatStatusLabel(values.active ? 'enabled' : 'disabled', locale)}
                                </StatusBadge>
                            }
                        />
                        <ProfileInfoItem label="Email" value={valueOrDash(user.data?.email)} />
                        <ProfileInfoItem label={text('角色', 'Role')} value={getUserRoleText(values.global_role, locale)} />
                    </div>
                </Panel>
                <Panel
                    title={text('危险操作', 'Danger zone')}
                    description={text(
                        '停用账号会阻止用户继续使用；删除用户不可恢复。',
                        'Deactivating blocks account use. Deleting a user cannot be undone.',
                    )}
                    actions={
                        <>
                            <Button variant={values.active ? 'secondary' : 'primary'} onClick={toggleUserActive}>
                                {values.active ? text('停用账号', 'Deactivate account') : text('启用账号', 'Activate account')}
                            </Button>
                            <Button variant="danger" onClick={removeUser}>
                                {text('删除用户', 'Delete user')}
                            </Button>
                        </>
                    }
                />
                {process.env.UI_VERSION === 'sky' && (
                    <Panel title={text('账单', 'Billing')}>
                        <div className="grid gap-4">
                            <ProfileInfoItem
                                label={text('余额', 'Balance')}
                                value={billing.data ? centsToFormattedString(billing.data.balance) : '-'}
                            />
                            <ProfileInfoItem
                                label={text('默认充值金额', 'Default payment amount')}
                                value={billing.data ? centsToFormattedString(billing.data.default_payment_amount) : '-'}
                            />
                            <ProfileInfoItem
                                label={text('支付方式', 'Payment method')}
                                value={
                                    <StatusBadge tone={billing.data?.is_payment_method_attached ? 'success' : 'neutral'}>
                                        {billing.data?.is_payment_method_attached
                                            ? text('已绑定', 'Payment method attached')
                                            : text('未绑定', 'No payment method')}
                                    </StatusBadge>
                                }
                            />
                        </div>
                    </Panel>
                )}
            </div>
        </>
    );
};

export const AdminSettingsPage: React.FC = () => {
    const { locale, text } = useLocaleText();
    const [pushNotification] = useNotifications();
    const config = useGetFeishuConfigQuery();
    const [updateConfig, updateState] = useUpdateFeishuConfigMutation();
    const runtimeImages = useGetRuntimeImagesQuery();
    const [updateRuntimeImages, updateRuntimeImagesState] = useUpdateRuntimeImagesMutation();
    const [values, setValues] = useState({
        enabled: false,
        app_id: '',
        app_secret: '',
        scope: '',
    });
    const [runtimeImageRows, setRuntimeImageRows] = useState<IRuntimeImage[]>([{ name: '', image: '' }]);

    useEffect(() => {
        if (config.data) {
            setValues({
                enabled: config.data.enabled,
                app_id: config.data.app_id ?? '',
                app_secret: '',
                scope: config.data.scope ?? '',
            });
        }
    }, [config.data]);

    useEffect(() => {
        if (runtimeImages.data) {
            setRuntimeImageRows(runtimeImages.data.length ? runtimeImages.data : [{ name: '', image: '' }]);
        }
    }, [runtimeImages.data]);

    const updateRuntimeImageRow = (index: number, key: keyof IRuntimeImage, value: string) => {
        setRuntimeImageRows((rows) =>
            rows.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: value } : row)),
        );
    };

    const addRuntimeImageRow = () => {
        setRuntimeImageRows((rows) => [...rows, { name: '', image: '' }]);
    };

    const removeRuntimeImageRow = (index: number) => {
        setRuntimeImageRows((rows) => {
            const nextRows = rows.filter((_, rowIndex) => rowIndex !== index);
            return nextRows.length ? nextRows : [{ name: '', image: '' }];
        });
    };

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        const payload: IFeishuOAuthConfigUpdate = {
            enabled: values.enabled,
            app_id: values.app_id,
            scope: values.scope,
        };
        if (values.app_secret.trim()) {
            payload.app_secret = values.app_secret;
        }
        await updateConfig(payload).unwrap();
        setValues((current) => ({ ...current, app_secret: '' }));
        pushNotification({
            type: 'success',
            header: text('飞书 OAuth 配置已保存', 'Feishu OAuth configuration saved'),
        });
    };

    const submitRuntimeImages = async (event: FormEvent) => {
        event.preventDefault();
        const images = runtimeImageRows
            .map((row) => ({ name: row.name.trim(), image: row.image.trim() }))
            .filter((row) => row.name || row.image);
        await updateRuntimeImages({ images }).unwrap();
        pushNotification({
            type: 'success',
            header: text('任务镜像已保存', 'Runtime images saved'),
        });
    };

    return (
        <>
            <PageHeader
                title={text('系统设置', 'System settings')}
                description={text('配置全局登录方式和系统级能力。', 'Configure global sign-in and system-level options.')}
            />
            <form onSubmit={submit}>
                <Panel
                    title={text('飞书 OAuth', 'Feishu OAuth')}
                    description={text(
                        '数据库配置优先于环境变量；关闭后会明确禁用飞书登录。',
                        'Database settings take precedence over environment variables. Disabling here explicitly turns Feishu sign-in off.',
                    )}
                    actions={
                        <StatusBadge tone={config.data?.enabled ? 'success' : 'neutral'}>
                            {formatStatusLabel(config.data?.enabled ? 'enabled' : 'disabled', locale)}
                        </StatusBadge>
                    }
                >
                    <div className="grid gap-4 lg:grid-cols-2">
                        <Field label={text('启用状态', 'Enabled')}>
                            <SelectInput
                                value={values.enabled ? 'enabled' : 'disabled'}
                                onChange={(event) =>
                                    setValues((current) => ({ ...current, enabled: event.target.value === 'enabled' }))
                                }
                            >
                                <option value="enabled">{text('启用飞书登录', 'Enable Feishu sign-in')}</option>
                                <option value="disabled">{text('禁用飞书登录', 'Disable Feishu sign-in')}</option>
                            </SelectInput>
                        </Field>
                        <Field label={text('配置来源', 'Source')}>
                            <TextInput value={config.data?.source ?? 'none'} readOnly />
                        </Field>
                        <Field label="App ID">
                            <TextInput
                                value={values.app_id}
                                onChange={(event) => setValues((current) => ({ ...current, app_id: event.target.value }))}
                                placeholder="cli_xxx"
                            />
                        </Field>
                        <Field
                            label="App Secret"
                            hint={
                                config.data?.has_app_secret
                                    ? text(
                                          'Secret 已配置；留空表示保持不变。',
                                          'A secret is configured. Leave empty to keep it unchanged.',
                                      )
                                    : text('尚未配置 Secret。', 'No secret is configured.')
                            }
                        >
                            <TextInput
                                type="password"
                                value={values.app_secret}
                                onChange={(event) => setValues((current) => ({ ...current, app_secret: event.target.value }))}
                                placeholder={config.data?.has_app_secret ? '••••••••' : 'app secret'}
                            />
                        </Field>
                        <Field label="Scope" hint={text('多个 scope 使用空格分隔。', 'Separate multiple scopes with spaces.')}>
                            <TextInput
                                value={values.scope}
                                onChange={(event) => setValues((current) => ({ ...current, scope: event.target.value }))}
                                placeholder="contact:user.base:readonly"
                            />
                        </Field>
                    </div>
                    <div className="mt-5 flex justify-end">
                        <Button type="submit" variant="primary" loading={updateState.isLoading || config.isLoading}>
                            {text('保存设置', 'Save settings')}
                        </Button>
                    </div>
                </Panel>
            </form>
            <form className="mt-6" onSubmit={submitRuntimeImages}>
                <Panel
                    title={text('任务镜像', 'Runtime images')}
                    description={text(
                        '配置用户新建运行任务时可以选择的 Docker 镜像。',
                        'Configure the Docker images users can select when creating runs.',
                    )}
                    actions={
                        <Button type="button" icon={<Plus className="h-4 w-4" />} onClick={addRuntimeImageRow}>
                            {text('添加镜像', 'Add image')}
                        </Button>
                    }
                >
                    <div className="space-y-3">
                        {runtimeImageRows.map((row, index) => (
                            <div key={index} className="grid gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800 md:grid-cols-[minmax(0,240px)_minmax(0,1fr)_auto]">
                                <Field label={text('显示名称', 'Display name')}>
                                    <TextInput
                                        value={row.name}
                                        onChange={(event) => updateRuntimeImageRow(index, 'name', event.target.value)}
                                        placeholder="PyTorch CUDA"
                                    />
                                </Field>
                                <Field label={text('镜像地址', 'Image reference')}>
                                    <TextInput
                                        value={row.image}
                                        onChange={(event) => updateRuntimeImageRow(index, 'image', event.target.value)}
                                        placeholder="pytorch/pytorch:2.5.1-cuda12.4-cudnn9-runtime"
                                    />
                                </Field>
                                <div className="flex items-end">
                                    <Button type="button" variant="danger" onClick={() => removeRuntimeImageRow(index)}>
                                        {text('移除', 'Remove')}
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                        {text(
                            '未配置时，用户无法新建运行任务申请。',
                            'When empty, users cannot create new run requests.',
                        )}
                    </p>
                    <div className="mt-5 flex justify-end">
                        <Button
                            type="submit"
                            variant="primary"
                            loading={updateRuntimeImagesState.isLoading || runtimeImages.isLoading}
                        >
                            {text('保存镜像', 'Save images')}
                        </Button>
                    </div>
                </Panel>
            </form>
        </>
    );
};

export const EventsPage: React.FC = () => {
    const { emptyTitle, locale, text } = useLocaleText();
    const events = useGetAllEventsQuery({ limit: 500 });
    return (
        <>
            <PageHeader title={text('系统事件', 'Events')} />
            <Panel title={text('事件列表', 'Events')}>
                <DataTable
                    items={events.data ?? []}
                    loading={events.isLoading}
                    keyGetter={(item) => item.id}
                    emptyTitle={emptyTitle}
                    columns={[
                        { id: 'time', header: text('时间', 'Time'), cell: (item) => formatDate(item.recorded_at) },
                        {
                            id: 'message',
                            header: text('消息', 'Message'),
                            cell: (item) => formatEventMessage(item.message, locale),
                        },
                        {
                            id: 'actor',
                            header: text('操作者', 'Actor'),
                            cell: (item) => formatEventActor(item.actor_user, locale),
                        },
                    ]}
                />
            </Panel>
        </>
    );
};

export const AccountProfilePage: React.FC = () => {
    const user = useAppSelector(selectUserData);
    const { role, locale } = useConsoleContext();
    const { text } = useLocaleText();
    const [pushNotification] = useNotifications();
    const [updateMyUser, updateState] = useUpdateMyUserMutation();
    const [email, setEmail] = useState(user?.email ?? '');
    const [editingEmail, setEditingEmail] = useState(false);
    const profileRoleText = getProfileRoleText(role, locale);

    useEffect(() => {
        setEmail(user?.email ?? '');
    }, [user?.email]);

    const submitEmail = async (event: FormEvent) => {
        event.preventDefault();
        try {
            await updateMyUser({ email: email.trim() || null }).unwrap();
            setEditingEmail(false);
            pushNotification({
                type: 'success',
                header: text('邮箱已更新', 'Email updated'),
            });
        } catch {
            pushNotification({
                type: 'error',
                header: text('邮箱更新失败', 'Failed to update email'),
            });
        }
    };

    return (
        <>
            <PageHeader
                title={text('个人资料', 'Profile')}
                description={text(
                    '查看基础账号状态，并维护你的邮箱。',
                    'View basic account status and keep your email up to date.',
                )}
            />
            <div className="grid gap-6">
                <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
                    <div className="bg-gradient-to-r from-blue-600 via-blue-500 to-teal-400 px-6 py-7 text-white">
                        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex min-w-0 items-center gap-4">
                                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/18 ring-1 ring-white/25">
                                    <UserCircle className="h-9 w-9" />
                                </div>
                                <div className="min-w-0">
                                    <div className="truncate text-2xl font-bold">{user?.username ?? '-'}</div>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        <span className="inline-flex h-7 items-center rounded-full bg-white/18 px-3 text-xs font-semibold ring-1 ring-white/25">
                                            {profileRoleText}
                                        </span>
                                        <span className="inline-flex h-7 items-center rounded-full bg-white/18 px-3 text-xs font-semibold ring-1 ring-white/25">
                                            {user?.active ? text('已启用', 'Active') : text('已停用', 'Inactive')}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="rounded-xl bg-white/14 px-4 py-3 text-sm ring-1 ring-white/20">
                                <div className="text-xs font-semibold uppercase tracking-wide text-white/75">
                                    {text('创建时间', 'Created')}
                                </div>
                                <div className="mt-1 font-semibold">{formatDate(user?.created_at)}</div>
                            </div>
                        </div>
                    </div>
                </section>
                <Panel title={text('基础信息', 'Basic info')}>
                    <div className="grid gap-4 md:grid-cols-2">
                        <ProfileInfoItem label={text('用户名', 'Username')} value={valueOrDash(user?.username)} />
                        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                {text('邮箱', 'Email')}
                            </div>
                            {editingEmail ? (
                                <form className="mt-2 flex flex-col gap-2 sm:flex-row" onSubmit={submitEmail}>
                                    <TextInput
                                        type="email"
                                        value={email}
                                        onChange={(event) => setEmail(event.target.value)}
                                        placeholder="name@example.com"
                                    />
                                    <div className="flex gap-2">
                                        <Button
                                            type="submit"
                                            variant="primary"
                                            loading={updateState.isLoading}
                                            icon={<Check className="h-4 w-4" />}
                                        >
                                            {text('保存', 'Save')}
                                        </Button>
                                        <Button
                                            type="button"
                                            icon={<X className="h-4 w-4" />}
                                            onClick={() => {
                                                setEmail(user?.email ?? '');
                                                setEditingEmail(false);
                                            }}
                                        >
                                            {text('取消', 'Cancel')}
                                        </Button>
                                    </div>
                                </form>
                            ) : (
                                <div className="mt-2 flex items-center justify-between gap-3">
                                    <div className="break-words text-sm font-semibold text-slate-950 dark:text-slate-50">
                                        {valueOrDash(user?.email)}
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        className="h-9 w-9 min-w-0 px-0"
                                        icon={<Pencil className="h-4 w-4" />}
                                        aria-label={text('编辑邮箱', 'Edit email')}
                                        title={text('编辑邮箱', 'Edit email')}
                                        onClick={() => setEditingEmail(true)}
                                    />
                                </div>
                            )}
                        </div>
                        <ProfileInfoItem
                            label={text('账号状态', 'Status')}
                            value={
                                <StatusBadge tone={user?.active ? 'success' : 'danger'}>
                                    {formatStatusLabel(user?.active ? 'enabled' : 'disabled', locale)}
                                </StatusBadge>
                            }
                        />
                        <ProfileInfoItem label={text('创建时间', 'Created')} value={formatDate(user?.created_at)} />
                    </div>
                </Panel>
            </div>
        </>
    );
};

export const AccountKeysPage: React.FC = () => {
    const { emptyTitle, text } = useLocaleText();
    const keys = useListPublicKeysQuery();
    const [addKey] = useAddPublicKeyMutation();
    const [deleteKeys] = useDeletePublicKeysMutation();
    const [confirm] = useConfirmationDialog();
    const [key, setKey] = useState('');
    const [name, setName] = useState('');
    const removeKey = (id: string) =>
        confirm({
            title: text('删除 SSH 公钥', 'Delete SSH key'),
            content: text('确认删除该 SSH 公钥？', 'Delete this SSH key?'),
            confirmButtonLabel: text('删除', 'Delete'),
            onConfirm: () => deleteKeys([id]),
        });

    return (
        <>
            <PageHeader title={text('SSH 公钥', 'SSH Keys')} />
            <Panel title={text('添加公钥', 'Add key')}>
                <div className="grid gap-3 md:grid-cols-[1fr_2fr_auto]">
                    <TextInput value={name} onChange={(event) => setName(event.target.value)} placeholder="name" />
                    <TextInput value={key} onChange={(event) => setKey(event.target.value)} placeholder="ssh-rsa ..." />
                    <Button onClick={() => addKey({ key, name })}>{text('添加', 'Add')}</Button>
                </div>
            </Panel>
            <div className="mt-6">
                <Panel title={text('公钥列表', 'Keys')}>
                    <DataTable
                        items={keys.data ?? []}
                        loading={keys.isLoading}
                        keyGetter={(item) => item.id}
                        emptyTitle={emptyTitle}
                        columns={[
                            { id: 'name', header: text('名称', 'Name'), cell: (item) => item.name },
                            { id: 'fingerprint', header: 'Fingerprint', cell: (item) => item.fingerprint },
                            {
                                id: 'actions',
                                header: text('操作', 'Actions'),
                                cell: (item) => (
                                    <Button variant="danger" onClick={() => removeKey(item.id)}>
                                        {text('删除', 'Delete')}
                                    </Button>
                                ),
                            },
                        ]}
                    />
                </Panel>
            </div>
        </>
    );
};

export const AccountBillingPage: React.FC = () => {
    const user = useAppSelector(selectUserData);
    const { text } = useLocaleText();
    const billing = useGetUserBillingInfoQuery({ username: user?.username ?? '' }, { skip: !user?.username });
    return (
        <>
            <PageHeader title={text('账单', 'Billing')} />
            <Panel title={text('账单信息', 'Billing info')}>
                {billing.data ? (
                    <DetailGrid
                        items={Object.entries(billing.data).map(([key, value]) => ({
                            label: key,
                            value: typeof value === 'string' || typeof value === 'number' ? String(value) : '-',
                        }))}
                    />
                ) : (
                    <EmptyState title={text('暂无账单信息', 'No billing information')} />
                )}
            </Panel>
        </>
    );
};

export const NotFoundPage: React.FC = () => {
    const { text } = useLocaleText();
    return (
        <div className="flex min-h-[60vh] items-center justify-center">
            <div className="max-w-md text-center">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                    <Activity className="h-7 w-7" />
                </div>
                <h1 className="text-2xl font-bold text-slate-950 dark:text-slate-50">404</h1>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    {text(
                        '该页面在新控制台中不存在。旧控制台 URL 不再保留。',
                        'This page does not exist in the new console. Legacy console URLs are not retained.',
                    )}
                </p>
            </div>
        </div>
    );
};
