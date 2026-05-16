import React, { FormEvent, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { Activity, Plus, RefreshCcw, Save } from 'lucide-react';
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
import { formatFleetBackend, getFleetPrice } from 'libs/fleet';
import { formatResources } from 'libs/resources';
import { runStatusForDeleting, runStatusForStopping } from 'libs/runStatus';
import {
    useCreateBackendViaYamlMutation,
    useDeleteProjectBackendMutation,
    useGetBackendYamlQuery,
    useGetProjectBackendsQuery,
    useUpdateBackendViaYamlMutation,
} from 'services/backend';
import { useGetAllEventsQuery } from 'services/events';
import { useApplyFleetMutation, useDeleteFleetMutation, useGetFleetDetailsQuery, useGetFleetsQuery } from 'services/fleet';
import { useGetGpusListQuery } from 'services/gpu';
import {
    useApproveGpuRequestMutation,
    useCreateGpuRequestMutation,
    useGetAllGpuRequestsQuery,
    useGetGpuRequestQuery,
    useRejectGpuRequestMutation,
    useRetryGpuRequestMutation,
} from 'services/gpuRequest';
import { useDeleteInstancesMutation, useGetInstanceDetailsQuery, useGetInstancesQuery } from 'services/instance';
import {
    useAddProjectMemberMutation,
    useCreateProjectMutation,
    useDeleteProjectsMutation,
    useGetProjectQuery,
    useGetProjectReposQuery,
    useGetProjectsQuery,
    useGetProjectLogsQuery,
    useRemoveProjectMemberMutation,
    useUpdateProjectMutation,
} from 'services/project';
import { useAddPublicKeyMutation, useDeletePublicKeysMutation, useListPublicKeysQuery } from 'services/publicKeys';
import {
    useApplyRunMutation,
    useDeleteRunsMutation,
    useGetMetricsQuery,
    useGetModelsQuery,
    useGetRunQuery,
    useGetRunsQuery,
    useStopRunsMutation,
} from 'services/run';
import { useDeleteSecretsMutation, useGetAllSecretsQuery, useUpdateSecretMutation } from 'services/secrets';
import {
    useCreateUserMutation,
    useDeleteUsersMutation,
    useGetUserBillingInfoQuery,
    useGetUserListQuery,
    useGetUserQuery,
    useRefreshTokenMutation,
    useUpdateUserMutation,
} from 'services/user';
import { useDeleteVolumesMutation, useGetAllVolumesQuery } from 'services/volume';

import { selectUserData } from 'App/slice';

import { CONSOLE_ROUTES } from './constants';
import { useConsoleContext } from './Layout';
import {
    buildGpuRequestCreateParams,
    canManageConsoleProject,
    formatGpuRequestResourcesText,
    getContainerSummaries,
    getGpuRequestStats,
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

const valueOrDash = (value?: React.ReactNode | null) => (value === null || value === undefined || value === '' ? '-' : value);

const useLocaleText = () => {
    const { locale } = useConsoleContext();
    return {
        locale,
        isZh: locale === 'zh',
        text: (zh: string, en: string) => (locale === 'zh' ? zh : en),
    };
};

const useFilteredItems = <T,>(items: T[], query: string, fields: Array<(item: T) => string | null | undefined>) => {
    return useMemo(() => {
        const normalized = query.trim().toLowerCase();
        if (!normalized) return items;
        return items.filter((item) => fields.some((field) => field(item)?.toLowerCase().includes(normalized)));
    }, [fields, items, query]);
};

const RequestStatus = ({ status }: { status?: TGpuRequestStatus | TJobStatus | string | null }) => (
    <StatusBadge tone={statusTone(status)}>{status ?? '-'}</StatusBadge>
);

export const DashboardPage: React.FC = () => {
    const { role } = useConsoleContext();
    const { text } = useLocaleText();
    const requests = useGetAllGpuRequestsQuery({ include_all: role.canUseProjectAdmin, limit: 100 });
    const runs = useGetRunsQuery({ limit: 100, job_submissions_limit: 1 });
    const fleets = useGetFleetsQuery({ include_imported: true, limit: 100 }, { skip: !role.canUseProjectAdmin });
    const instances = useGetInstancesQuery({ only_active: true, include_imported: true, limit: 100 }, { skip: !role.canUseProjectAdmin });
    const events = useGetAllEventsQuery({ limit: 8 }, { skip: !role.canUseGlobalAdmin });
    const stats = getGpuRequestStats(requests.data ?? []);
    const containers = getContainerSummaries(requests.data ?? [], runs.data ?? []);
    const runningContainers = containers.filter((container) => container.status === 'running').length;
    const runningRuns = (runs.data ?? []).filter((run) => run.status === 'running').length;

    return (
        <>
            <PageHeader
                title={text('工作台', 'Dashboard')}
                description={text(
                    role.canUseGlobalAdmin
                        ? '跨项目查看 GPU 申请、容器、运行任务和基础设施状态。'
                        : '查看你的 GPU 申请、容器状态和审批进展。',
                    role.canUseGlobalAdmin
                        ? 'Cross-project GPU request and infrastructure overview.'
                        : 'Review your GPU requests, containers, and approval progress.',
                )}
            />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard label={text('待审批申请', 'Pending requests')} value={stats.pending} accent="amber" />
                <MetricCard
                    label={role.canUseGlobalAdmin ? text('运行中任务', 'Running runs') : text('运行中容器', 'Running containers')}
                    value={role.canUseGlobalAdmin ? runningRuns : runningContainers}
                    accent="teal"
                />
                {role.canUseProjectAdmin ? (
                    <>
                        <MetricCard label={text('集群', 'Fleets')} value={fleets.data?.length ?? 0} accent="blue" />
                        <MetricCard label={text('活跃实例', 'Active instances')} value={instances.data?.length ?? 0} accent="slate" />
                    </>
                ) : (
                    <>
                        <MetricCard label={text('已批准申请', 'Approved requests')} value={stats.approved} accent="blue" />
                        <MetricCard label={text('失败申请', 'Failed requests')} value={stats.failed} accent="slate" />
                    </>
                )}
            </div>
            <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
                <Panel title={text('最近 GPU 申请', 'Recent GPU requests')}>
                    <DataTable
                        items={(requests.data ?? []).slice(0, 8)}
                        loading={requests.isLoading}
                        keyGetter={(item) => item.id}
                        empty={<EmptyState title={text('暂无申请', 'No requests yet')} />}
                        columns={[
                            { id: 'name', header: text('名称', 'Name'), cell: (item) => item.request.name ?? item.id },
                            { id: 'project', header: text('项目', 'Project'), cell: (item) => item.project_name },
                            ...(role.canUseProjectAdmin
                                ? [{ id: 'applicant', header: text('申请人', 'Applicant'), cell: (item: IGpuRequest) => item.applicant }]
                                : []),
                            {
                                id: 'status',
                                header: text('状态', 'Status'),
                                cell: (item) => <RequestStatus status={item.status} />,
                            },
                            { id: 'created', header: text('创建时间', 'Created'), cell: (item) => formatDate(item.created_at) },
                        ]}
                    />
                </Panel>
                {role.canUseGlobalAdmin ? (
                    <Panel title={text('最近事件', 'Recent events')}>
                        <div className="grid gap-3">
                            {(events.data ?? []).map((event) => (
                                <div key={event.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">{event.message}</div>
                                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                        {formatDate(event.recorded_at)} · {event.actor_user ?? 'system'}
                                    </div>
                                </div>
                            ))}
                            {!events.isLoading && !(events.data ?? []).length && (
                                <EmptyState title={text('暂无事件', 'No events')} />
                            )}
                        </div>
                    </Panel>
                ) : (
                    <Panel title={text('我的容器', 'My containers')}>
                        <DataTable
                            items={containers.slice(0, 6)}
                            loading={requests.isLoading || runs.isLoading}
                            keyGetter={(item) => item.id}
                            empty={<EmptyState title={text('暂无容器', 'No containers')} />}
                            columns={[
                                { id: 'name', header: text('名称', 'Name'), cell: (item) => item.name },
                                { id: 'project', header: text('项目', 'Project'), cell: (item) => item.projectName },
                                {
                                    id: 'status',
                                    header: text('状态', 'Status'),
                                    cell: (item) => <RequestStatus status={item.status} />,
                                },
                            ]}
                        />
                    </Panel>
                )}
            </div>
        </>
    );
};

export const GpuRequestsPage: React.FC<{ approvals?: boolean }> = ({ approvals }) => {
    const navigate = useNavigate();
    const { role } = useConsoleContext();
    const { text } = useLocaleText();
    const [query, setQuery] = useState('');
    const requests = useGetAllGpuRequestsQuery({ include_all: approvals || role.canUseProjectAdmin, limit: 500 });
    const items = useFilteredItems(
        approvals ? (requests.data ?? []).filter((request) => request.status === 'pending') : (requests.data ?? []),
        query,
        [(item) => item.request.name, (item) => item.project_name, (item) => item.applicant, (item) => item.status],
    );

    return (
        <>
            <PageHeader
                title={approvals ? text('审批中心', 'Approvals') : text('GPU 申请', 'GPU Requests')}
                description={
                    approvals
                        ? text('审批项目成员提交的 GPU 容器申请。', 'Review GPU container requests from project members.')
                        : text('提交申请并跟踪审批、容器创建和关联运行任务。', 'Submit and track GPU container requests.')
                }
                actions={
                    !approvals && (
                        <Button
                            variant="primary"
                            icon={<Plus className="h-4 w-4" />}
                            onClick={() => navigate(CONSOLE_ROUTES.GPU_REQUEST_CREATE)}
                        >
                            {text('新建申请', 'New request')}
                        </Button>
                    )
                }
            />
            <Panel
                title={text('申请列表', 'Requests')}
                actions={
                    <SearchInput
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={text('搜索申请', 'Search requests')}
                    />
                }
            >
                <DataTable
                    items={items}
                    loading={requests.isLoading}
                    keyGetter={(item) => item.id}
                    empty={<EmptyState title={text('暂无申请', 'No requests')} />}
                    columns={[
                        {
                            id: 'name',
                            header: text('名称', 'Name'),
                            cell: (item) => (
                                <button
                                    className="font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-300"
                                    onClick={() =>
                                        navigate(CONSOLE_ROUTES.GPU_REQUEST_DETAILS.FORMAT(item.project_name, item.id))
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
                            header: text('申请人', 'Applicant'),
                            cell: (item) => item.applicant,
                            sortValue: (item) => item.applicant,
                        },
                        {
                            id: 'resources',
                            header: text('资源', 'Resources'),
                            cell: (item) => formatGpuRequestResourcesText(item.request),
                        },
                        {
                            id: 'status',
                            header: text('状态', 'Status'),
                            cell: (item) => <RequestStatus status={item.status} />,
                            sortValue: (item) => item.status,
                        },
                        {
                            id: 'created',
                            header: text('创建时间', 'Created'),
                            cell: (item) => formatDate(item.created_at),
                            sortValue: (item) => item.created_at,
                        },
                    ]}
                />
            </Panel>
        </>
    );
};

export const GpuRequestCreatePage: React.FC = () => {
    const navigate = useNavigate();
    const { projects } = useConsoleContext();
    const { text } = useLocaleText();
    const [createGpuRequest, createState] = useCreateGpuRequestMutation();
    const [pushNotification] = useNotifications();
    const [values, setValues] = useState<IGpuRequestFormValues>({
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
        max_duration: '',
        fleets: '',
    });

    const update = (key: keyof IGpuRequestFormValues, value: string) => setValues((current) => ({ ...current, [key]: value }));

    const onSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (!values.project_name || !values.image.trim() || !values.commands.trim()) {
            pushNotification({
                type: 'error',
                header: text('请填写项目、镜像和启动命令', 'Project, image, and commands are required'),
            });
            return;
        }
        const result = await createGpuRequest(buildGpuRequestCreateParams(values)).unwrap();
        navigate(CONSOLE_ROUTES.GPU_REQUEST_DETAILS.FORMAT(result.project_name, result.id));
    };

    return (
        <>
            <PageHeader title={text('新建 GPU 申请', 'New GPU Request')} />
            <form className="grid gap-6" onSubmit={onSubmit}>
                <Panel title={text('基础信息', 'Basics')}>
                    <div className="grid gap-4 md:grid-cols-2">
                        <Field label={text('项目', 'Project')}>
                            <SelectInput
                                value={values.project_name}
                                onChange={(event) => update('project_name', event.target.value)}
                            >
                                <option value="">{text('请选择项目', 'Select a project')}</option>
                                {projects.map((project) => (
                                    <option key={project.project_name} value={project.project_name}>
                                        {project.project_name}
                                    </option>
                                ))}
                            </SelectInput>
                        </Field>
                        <Field label={text('申请名称', 'Name')}>
                            <TextInput
                                value={values.name}
                                onChange={(event) => update('name', event.target.value)}
                                placeholder="train-qwen"
                            />
                        </Field>
                        <Field label={text('镜像', 'Image')}>
                            <TextInput
                                value={values.image}
                                onChange={(event) => update('image', event.target.value)}
                                placeholder="pytorch/pytorch:2.5.1-cuda12.4-cudnn9-runtime"
                            />
                        </Field>
                        <Field label={text('可选 Fleet', 'Optional fleets')}>
                            <TextInput
                                value={values.fleets}
                                onChange={(event) => update('fleets', event.target.value)}
                                placeholder="gpu-a, gpu-b"
                            />
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
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
                        {[
                            ['nodes', text('节点数', 'Nodes'), '1'],
                            ['gpu', 'GPU', '1'],
                            ['cpu', 'CPU', '8'],
                            ['memory', text('内存', 'Memory'), '32GB'],
                            ['disk', text('磁盘', 'Disk'), '200GB'],
                            ['max_duration', text('最长运行', 'Max duration'), '4h'],
                        ].map(([key, label, placeholder]) => (
                            <Field key={key} label={label}>
                                <TextInput
                                    value={values[key as keyof IGpuRequestFormValues]}
                                    onChange={(event) => update(key as keyof IGpuRequestFormValues, event.target.value)}
                                    placeholder={placeholder}
                                />
                            </Field>
                        ))}
                    </div>
                </Panel>
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <Button className="w-full sm:w-auto" type="button" onClick={() => navigate(CONSOLE_ROUTES.GPU_REQUESTS)}>
                        {text('取消', 'Cancel')}
                    </Button>
                    <Button className="w-full sm:w-auto" type="submit" variant="primary" loading={createState.isLoading}>
                        {text('提交申请', 'Submit request')}
                    </Button>
                </div>
            </form>
        </>
    );
};

export const GpuRequestDetailsPage: React.FC = () => {
    const { projectName = '', requestId = '' } = useParams();
    const navigate = useNavigate();
    const { role } = useConsoleContext();
    const { text } = useLocaleText();
    const request = useGetGpuRequestQuery({ project_name: projectName, id: requestId });
    const run = useGetRunQuery(
        { project_name: projectName, id: request.data?.run_id ?? '' },
        { skip: !request.data?.run_id },
    );
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
    const [approve, approveState] = useApproveGpuRequestMutation();
    const [retry, retryState] = useRetryGpuRequestMutation();
    const [reject, rejectState] = useRejectGpuRequestMutation();
    const [rejectOpen, setRejectOpen] = useState(false);
    const [reason, setReason] = useState('');
    const canReview = request.data && canManageConsoleProject(role, request.data.project_name);

    const approveRequest = async () => {
        const result = await approve({ project_name: projectName, id: requestId }).unwrap();
        navigate(CONSOLE_ROUTES.GPU_REQUEST_DETAILS.FORMAT(result.project_name, result.id));
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
                <Panel title={text('申请详情', 'Request details')}>
                    {request.data ? (
                        <CodeBlock value={request.data.request} />
                    ) : (
                        <EmptyState title={text('申请不存在', 'Request not found')} />
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
                                <span className="font-medium">{formatGpuRequestResourcesText(request.data.request)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500 dark:text-slate-400">Run</span>
                                <span className="font-medium">{request.data.run_name ?? request.data.run_id ?? '-'}</span>
                            </div>
                            {run.data && (
                                <>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500 dark:text-slate-400">{text('容器状态', 'Container status')}</span>
                                        <RequestStatus status={run.data.status} />
                                    </div>
                                    {run.data.service?.url && (
                                        <div className="flex justify-between gap-4">
                                            <span className="text-slate-500 dark:text-slate-400">{text('访问地址', 'URL')}</span>
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
                                            <span className="text-slate-500 dark:text-slate-400">{text('提交状态', 'Submission')}</span>
                                            <RequestStatus status={submission.status} />
                                        </div>
                                    )}
                                </>
                            )}
                            {request.data.run_id && role.canUseGlobalAdmin && (
                                <Button
                                    className="w-full"
                                    onClick={() =>
                                        navigate(
                                            CONSOLE_ROUTES.RESOURCES_RUN_DETAILS.FORMAT(
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
                    <Panel title={text('容器运行信息', 'Container runtime')}>
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
                            columns={[
                                { id: 'name', header: text('名称', 'Name'), cell: (item) => item.job_spec.job_name },
                                { id: 'image', header: text('镜像', 'Image'), cell: (item) => item.job_spec.image_name },
                                {
                                    id: 'status',
                                    header: text('状态', 'Status'),
                                    cell: (item) => (
                                        <RequestStatus status={item.job_submissions?.[item.job_submissions.length - 1]?.status} />
                                    ),
                                },
                                { id: 'commands', header: text('命令', 'Commands'), cell: (item) => item.job_spec.commands.join(' && ') },
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
                            <CodeBlock
                                value={
                                    submission
                                        ? { job_submission_id: submission.id, status: submission.status }
                                        : text('暂无日志提交', 'No log submission yet')
                                }
                            />
                        )}
                    </Panel>
                </div>
            )}
            <Modal
                open={rejectOpen}
                title={text('拒绝申请', 'Reject request')}
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

export const ContainersPage: React.FC<{ adminView?: boolean }> = ({ adminView }) => {
    const { role } = useConsoleContext();
    const { text } = useLocaleText();
    const requests = useGetAllGpuRequestsQuery({ include_all: adminView || role.canUseProjectAdmin, limit: 500 });
    const runs = useGetRunsQuery({ limit: 500, job_submissions_limit: 1 });
    const containers = getContainerSummaries(requests.data ?? [], runs.data ?? []);

    return (
        <>
            <PageHeader title={adminView ? text('容器管理', 'Container Management') : text('我的容器', 'My Containers')} />
            <Panel title={text('容器实例', 'Container instances')}>
                <DataTable
                    items={containers}
                    loading={requests.isLoading || runs.isLoading}
                    keyGetter={(item) => item.id}
                    empty={<EmptyState title={text('暂无容器', 'No containers')} />}
                    columns={[
                        { id: 'name', header: text('名称', 'Name'), cell: (item) => item.name },
                        { id: 'project', header: text('项目', 'Project'), cell: (item) => item.projectName },
                        { id: 'applicant', header: text('申请人', 'Applicant'), cell: (item) => item.applicant },
                        {
                            id: 'status',
                            header: text('状态', 'Status'),
                            cell: (item) => <RequestStatus status={item.status} />,
                        },
                        { id: 'image', header: text('镜像', 'Image'), cell: (item) => item.image },
                        {
                            id: 'actions',
                            header: text('操作', 'Actions'),
                            cell: (item) => (
                                <Button className="min-w-20" onClick={() => (window.location.href = item.requestDetailsPath)}>
                                    {text('详情', 'Details')}
                                </Button>
                            ),
                        },
                    ]}
                />
            </Panel>
        </>
    );
};

export const RunsPage: React.FC = () => {
    const navigate = useNavigate();
    const { text } = useLocaleText();
    const [query, setQuery] = useState('');
    const runs = useGetRunsQuery({ limit: 500, job_submissions_limit: 1 });
    const items = useFilteredItems(runs.data ?? [], query, [
        (item) => item.run_spec.run_name,
        (item) => item.project_name,
        (item) => item.user,
        (item) => item.status,
    ]);

    return (
        <>
            <PageHeader
                title={text('运行任务', 'Runs')}
                actions={
                    <Button
                        variant="primary"
                        icon={<Plus className="h-4 w-4" />}
                        onClick={() => navigate(CONSOLE_ROUTES.RESOURCES_RUN_CREATE)}
                    >
                        {text('创建任务', 'Create run')}
                    </Button>
                }
            />
            <Panel
                title={text('任务列表', 'Run list')}
                actions={<SearchInput value={query} onChange={(event) => setQuery(event.target.value)} />}
            >
                <DataTable
                    items={items}
                    loading={runs.isLoading}
                    keyGetter={(item) => item.id}
                    empty={<EmptyState title={text('暂无运行任务', 'No runs')} />}
                    columns={[
                        {
                            id: 'name',
                            header: text('名称', 'Name'),
                            cell: (item) => (
                                <button
                                    className="font-semibold text-blue-600 dark:text-blue-300"
                                    onClick={() =>
                                        navigate(CONSOLE_ROUTES.RESOURCES_RUN_DETAILS.FORMAT(item.project_name, item.id))
                                    }
                                >
                                    {item.run_spec.run_name ?? item.id}
                                </button>
                            ),
                        },
                        { id: 'project', header: text('项目', 'Project'), cell: (item) => item.project_name },
                        { id: 'user', header: text('用户', 'User'), cell: (item) => item.user },
                        {
                            id: 'status',
                            header: text('状态', 'Status'),
                            cell: (item) => <RequestStatus status={item.status} />,
                        },
                        {
                            id: 'submitted',
                            header: text('提交时间', 'Submitted'),
                            cell: (item) => formatDate(item.submitted_at),
                        },
                        {
                            id: 'cost',
                            header: text('费用', 'Cost'),
                            cell: (item) => centsToFormattedString(item.cost ?? 0, '$'),
                        },
                    ]}
                />
            </Panel>
        </>
    );
};

export const RunCreatePage: React.FC = () => {
    const navigate = useNavigate();
    const { projects } = useConsoleContext();
    const { text } = useLocaleText();
    const [applyRun, applyState] = useApplyRunMutation();
    const [values, setValues] = useState({
        project: projects[0]?.project_name ?? '',
        name: '',
        image: '',
        commands: '',
        gpu: '',
        cpu: '',
        memory: '',
        fleets: '',
    });

    const update = (key: keyof typeof values, value: string) => setValues((current) => ({ ...current, [key]: value }));

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        const configuration: TTaskConfigurationRequest = {
            type: 'task',
            image: values.image,
            commands: values.commands
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean),
            resources: {
                ...(values.gpu ? { gpu: values.gpu } : {}),
                ...(values.cpu ? { cpu: values.cpu } : {}),
                ...(values.memory ? { memory: values.memory } : {}),
            },
            fleets: values.fleets
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean),
        };
        const result = await applyRun({
            project_name: values.project,
            force: true,
            plan: { run_spec: { run_name: values.name, configuration } },
        }).unwrap();
        navigate(CONSOLE_ROUTES.RESOURCES_RUN_DETAILS.FORMAT(result.project_name, result.id));
    };

    return (
        <>
            <PageHeader title={text('创建运行任务', 'Create run')} />
            <form className="grid gap-6" onSubmit={submit}>
                <Panel title={text('任务配置', 'Run configuration')}>
                    <div className="grid gap-4 md:grid-cols-2">
                        <Field label={text('项目', 'Project')}>
                            <SelectInput value={values.project} onChange={(event) => update('project', event.target.value)}>
                                {projects.map((project) => (
                                    <option key={project.project_name} value={project.project_name}>
                                        {project.project_name}
                                    </option>
                                ))}
                            </SelectInput>
                        </Field>
                        <Field label={text('名称', 'Name')}>
                            <TextInput value={values.name} onChange={(event) => update('name', event.target.value)} />
                        </Field>
                        <Field label={text('镜像', 'Image')}>
                            <TextInput value={values.image} onChange={(event) => update('image', event.target.value)} />
                        </Field>
                        <Field label="Fleet">
                            <TextInput
                                value={values.fleets}
                                onChange={(event) => update('fleets', event.target.value)}
                                placeholder="gpu-a"
                            />
                        </Field>
                        <Field label="GPU">
                            <TextInput value={values.gpu} onChange={(event) => update('gpu', event.target.value)} />
                        </Field>
                        <Field label="CPU">
                            <TextInput value={values.cpu} onChange={(event) => update('cpu', event.target.value)} />
                        </Field>
                        <Field label={text('内存', 'Memory')}>
                            <TextInput value={values.memory} onChange={(event) => update('memory', event.target.value)} />
                        </Field>
                    </div>
                    <div className="mt-4">
                        <Field label={text('命令', 'Commands')}>
                            <TextArea value={values.commands} onChange={(event) => update('commands', event.target.value)} />
                        </Field>
                    </div>
                </Panel>
                <div className="flex justify-end gap-3">
                    <Button type="submit" variant="primary" loading={applyState.isLoading}>
                        {text('创建', 'Create')}
                    </Button>
                </div>
            </form>
        </>
    );
};

export const RunDetailsPage: React.FC = () => {
    const { projectName = '', runId = '' } = useParams();
    const { text } = useLocaleText();
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
    const stop = () => stopRuns({ project_name: projectName, runs_names: [runName], abort: true });
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
                    data && (
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
                        <CodeBlock
                            value={
                                submission
                                    ? { job_submission_id: submission.id, status: submission.status }
                                    : text('暂无日志提交', 'No log submission yet')
                            }
                        />
                    </Panel>
                </div>
                <Panel title="Inspect">
                    <CodeBlock value={data ?? {}} />
                </Panel>
            </div>
        </>
    );
};

export const FleetsPage: React.FC<{ servers?: boolean }> = ({ servers }) => {
    const navigate = useNavigate();
    const { text } = useLocaleText();
    const fleets = useGetFleetsQuery({ include_imported: true, limit: 500 });

    return (
        <>
            <PageHeader
                title={servers ? text('服务器管理', 'Servers') : text('集群', 'Fleets')}
                actions={
                    !servers && (
                        <Button
                            variant="primary"
                            icon={<Plus className="h-4 w-4" />}
                            onClick={() => navigate(CONSOLE_ROUTES.RESOURCES_FLEET_CREATE)}
                        >
                            {text('创建集群', 'Create fleet')}
                        </Button>
                    )
                }
            />
            <Panel title={text('集群列表', 'Fleet list')}>
                <DataTable
                    items={fleets.data ?? []}
                    loading={fleets.isLoading}
                    keyGetter={(item) => item.id}
                    empty={<EmptyState title={text('暂无集群', 'No fleets')} />}
                    columns={[
                        {
                            id: 'name',
                            header: text('名称', 'Name'),
                            cell: (item) => (
                                <button
                                    className="font-semibold text-blue-600 dark:text-blue-300"
                                    onClick={() =>
                                        navigate(CONSOLE_ROUTES.RESOURCES_FLEET_DETAILS.FORMAT(item.project_name, item.id))
                                    }
                                >
                                    {item.name}
                                </button>
                            ),
                        },
                        { id: 'project', header: text('项目', 'Project'), cell: (item) => item.project_name },
                        {
                            id: 'status',
                            header: text('状态', 'Status'),
                            cell: (item) => <RequestStatus status={item.status} />,
                        },
                        {
                            id: 'backend',
                            header: text('后端', 'Backend'),
                            cell: (item) => formatFleetBackend(item.spec.configuration),
                        },
                        { id: 'instances', header: text('实例', 'Instances'), cell: (item) => item.instances.length },
                        { id: 'price', header: text('价格', 'Price'), cell: (item) => valueOrDash(getFleetPrice(item)) },
                    ]}
                />
            </Panel>
        </>
    );
};

export const FleetCreatePage: React.FC = () => {
    const navigate = useNavigate();
    const { projects } = useConsoleContext();
    const { text } = useLocaleText();
    const [applyFleet, applyState] = useApplyFleetMutation();
    const [projectName, setProjectName] = useState(projects[0]?.project_name ?? '');
    const [name, setName] = useState('');
    const [yaml, setYaml] = useState('type: fleet\nnodes:\n  min: 0\n  max: 1\n');

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        const spec = {
            configuration: { type: 'fleet', name },
            configuration_path: 'console.yaml',
            profile: { name, default: true },
        } as IFleetSpec;
        const result = await applyFleet({ projectName, force: true, plan: { spec } }).unwrap();
        navigate(CONSOLE_ROUTES.RESOURCES_FLEET_DETAILS.FORMAT(result.project_name, result.id));
    };

    return (
        <>
            <PageHeader title={text('创建集群', 'Create fleet')} />
            <form className="grid gap-6" onSubmit={submit}>
                <Panel title={text('配置', 'Configuration')}>
                    <div className="grid gap-4 md:grid-cols-2">
                        <Field label={text('项目', 'Project')}>
                            <SelectInput value={projectName} onChange={(event) => setProjectName(event.target.value)}>
                                {projects.map((project) => (
                                    <option key={project.project_name} value={project.project_name}>
                                        {project.project_name}
                                    </option>
                                ))}
                            </SelectInput>
                        </Field>
                        <Field label={text('名称', 'Name')}>
                            <TextInput value={name} onChange={(event) => setName(event.target.value)} />
                        </Field>
                    </div>
                    <div className="mt-4">
                        <Field label="YAML">
                            <TextArea value={yaml} onChange={(event) => setYaml(event.target.value)} />
                        </Field>
                    </div>
                </Panel>
                <div className="flex justify-end">
                    <Button type="submit" variant="primary" loading={applyState.isLoading}>
                        {text('创建', 'Create')}
                    </Button>
                </div>
            </form>
        </>
    );
};

export const FleetDetailsPage: React.FC = () => {
    const { projectName = '', fleetId = '' } = useParams();
    const { text } = useLocaleText();
    const [deleteFleet, deleteState] = useDeleteFleetMutation();
    const fleet = useGetFleetDetailsQuery({ projectName, fleetId });

    return (
        <>
            <PageHeader
                title={fleet.data?.name ?? fleetId}
                description={projectName}
                actions={
                    fleet.data && (
                        <Button
                            variant="danger"
                            loading={deleteState.isLoading}
                            onClick={() => deleteFleet({ projectName, fleetNames: [fleet.data!.name] })}
                        >
                            {text('删除', 'Delete')}
                        </Button>
                    )
                }
            />
            <div className="grid gap-6">
                <Panel title={text('实例', 'Instances')}>
                    <DataTable
                        items={fleet.data?.instances ?? []}
                        loading={fleet.isLoading}
                        keyGetter={(item) => item.id}
                        columns={[
                            { id: 'name', header: text('名称', 'Name'), cell: (item) => item.name },
                            {
                                id: 'status',
                                header: text('状态', 'Status'),
                                cell: (item) => <RequestStatus status={item.status} />,
                            },
                            { id: 'backend', header: text('后端', 'Backend'), cell: (item) => item.backend },
                            { id: 'region', header: text('区域', 'Region'), cell: (item) => item.region },
                            {
                                id: 'resources',
                                header: text('资源', 'Resources'),
                                cell: (item) => (item.instance_type ? formatResources(item.instance_type.resources) : '-'),
                            },
                        ]}
                    />
                </Panel>
                <Panel title="Inspect">
                    <CodeBlock value={fleet.data ?? {}} />
                </Panel>
            </div>
        </>
    );
};

export const InstancesPage: React.FC = () => {
    const navigate = useNavigate();
    const { text } = useLocaleText();
    const instances = useGetInstancesQuery({ include_imported: true, limit: 500 });

    return (
        <>
            <PageHeader title={text('实例', 'Instances')} />
            <Panel title={text('实例列表', 'Instances')}>
                <DataTable
                    items={instances.data ?? []}
                    loading={instances.isLoading}
                    keyGetter={(item) => item.id}
                    columns={[
                        {
                            id: 'name',
                            header: text('名称', 'Name'),
                            cell: (item) => (
                                <button
                                    className="font-semibold text-blue-600 dark:text-blue-300"
                                    onClick={() =>
                                        navigate(
                                            CONSOLE_ROUTES.RESOURCES_INSTANCE_DETAILS.FORMAT(item.project_name ?? '-', item.id),
                                        )
                                    }
                                >
                                    {item.name}
                                </button>
                            ),
                        },
                        { id: 'fleet', header: 'Fleet', cell: (item) => item.fleet_name },
                        {
                            id: 'status',
                            header: text('状态', 'Status'),
                            cell: (item) => <RequestStatus status={item.status} />,
                        },
                        { id: 'backend', header: text('后端', 'Backend'), cell: (item) => item.backend },
                        { id: 'region', header: text('区域', 'Region'), cell: (item) => item.region },
                    ]}
                />
            </Panel>
        </>
    );
};

export const InstanceDetailsPage: React.FC = () => {
    const { projectName = '', instanceId = '' } = useParams();
    const { text } = useLocaleText();
    const instance = useGetInstanceDetailsQuery({ projectName, instanceId });
    const [deleteInstances, deleteState] = useDeleteInstancesMutation();

    return (
        <>
            <PageHeader
                title={instance.data?.name ?? instanceId}
                description={projectName}
                actions={
                    instance.data && (
                        <Button
                            variant="danger"
                            loading={deleteState.isLoading}
                            onClick={() =>
                                deleteInstances({
                                    projectName,
                                    fleetName: instance.data!.fleet_name,
                                    instancesNums: [instance.data!.instance_num],
                                })
                            }
                        >
                            {text('删除实例', 'Delete instance')}
                        </Button>
                    )
                }
            />
            <Panel title="Inspect">
                <CodeBlock value={instance.data ?? {}} />
            </Panel>
        </>
    );
};

export const OffersPage: React.FC = () => {
    const { projects } = useConsoleContext();
    const { text } = useLocaleText();
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
    const { text } = useLocaleText();
    const models = useGetModelsQuery({ limit: 500 });

    return (
        <>
            <PageHeader title={text('模型服务', 'Models')} />
            <Panel title={text('模型列表', 'Models')}>
                <DataTable
                    items={models.data ?? []}
                    loading={models.isLoading}
                    keyGetter={(item) => item.id}
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
                <CodeBlock value={modelRun?.service?.model ?? {}} />
            </Panel>
        </>
    );
};

export const VolumesPage: React.FC = () => {
    const { text } = useLocaleText();
    const volumes = useGetAllVolumesQuery({ limit: 500 });
    const [deleteVolumes] = useDeleteVolumesMutation();

    return (
        <>
            <PageHeader title={text('存储卷', 'Volumes')} />
            <Panel title={text('存储卷列表', 'Volumes')}>
                <DataTable
                    items={volumes.data ?? []}
                    loading={volumes.isLoading}
                    keyGetter={(item) => item.id}
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
                                <Button
                                    variant="danger"
                                    onClick={() => deleteVolumes({ project_name: item.project_name, names: [item.name] })}
                                >
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
    const { text } = useLocaleText();
    const projects = useGetProjectsQuery({ include_not_joined: true, limit: 500 });
    const [deleteProjects] = useDeleteProjectsMutation();

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
                                <Button variant="danger" onClick={() => deleteProjects([item.project_name])}>
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
    const { text } = useLocaleText();
    const project = useGetProjectQuery({ name: projectName });
    const repos = useGetProjectReposQuery({ project_name: projectName });
    const backends = useGetProjectBackendsQuery({ projectName });
    const secrets = useGetAllSecretsQuery({ project_name: projectName });
    const events = useGetAllEventsQuery({ within_projects: [projectName], limit: 20 });
    const [updateProject] = useUpdateProjectMutation();
    const [addMember, addMemberState] = useAddProjectMemberMutation();
    const [removeMember] = useRemoveProjectMemberMutation();
    const [updateSecret] = useUpdateSecretMutation();
    const [deleteSecrets] = useDeleteSecretsMutation();
    const [memberName, setMemberName] = useState('');
    const [secretName, setSecretName] = useState('');
    const [secretValue, setSecretValue] = useState('');

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
                <Panel title={text('设置', 'Settings')}>
                    <div className="flex flex-wrap gap-3">
                        <Button
                            onClick={() => updateProject({ project_name: projectName, is_public: !project.data?.isPublic })}
                        >
                            {project.data?.isPublic ? text('设为私有', 'Make private') : text('设为公开', 'Make public')}
                        </Button>
                    </div>
                </Panel>
                <Panel title={text('成员', 'Members')}>
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row">
                        <TextInput
                            value={memberName}
                            onChange={(event) => setMemberName(event.target.value)}
                            placeholder="username"
                        />
                        <Button
                            loading={addMemberState.isLoading}
                            onClick={() => addMember({ project_name: projectName, username: memberName })}
                        >
                            {text('添加成员', 'Add member')}
                        </Button>
                    </div>
                    <DataTable
                        items={project.data?.members ?? []}
                        loading={project.isLoading}
                        keyGetter={(item) => item.user.username}
                        columns={[
                            { id: 'user', header: text('用户', 'User'), cell: (item) => item.user.username },
                            { id: 'role', header: text('角色', 'Role'), cell: (item) => item.project_role },
                            {
                                id: 'actions',
                                header: text('操作', 'Actions'),
                                cell: (item) => (
                                    <Button
                                        variant="danger"
                                        onClick={() =>
                                            removeMember({ project_name: projectName, username: item.user.username })
                                        }
                                    >
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
                        columns={[
                            { id: 'name', header: text('名称', 'Name'), cell: (item) => item.name },
                            { id: 'type', header: text('类型', 'Type'), cell: (item) => item.config?.type },
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
                        columns={[
                            { id: 'name', header: text('名称', 'Name'), cell: (item) => item.name },
                            {
                                id: 'actions',
                                header: text('操作', 'Actions'),
                                cell: (item) => (
                                    <Button
                                        variant="danger"
                                        onClick={() => deleteSecrets({ project_name: projectName, names: [item.name] })}
                                    >
                                        {text('删除', 'Delete')}
                                    </Button>
                                ),
                            },
                        ]}
                    />
                </Panel>
                <Panel title="Repos">
                    <CodeBlock value={repos.data ?? []} />
                </Panel>
                <Panel title={text('事件', 'Events')}>
                    <DataTable
                        items={events.data ?? []}
                        loading={events.isLoading}
                        keyGetter={(item) => item.id}
                        columns={[
                            { id: 'time', header: text('时间', 'Time'), cell: (item) => formatDate(item.recorded_at) },
                            { id: 'message', header: text('消息', 'Message'), cell: (item) => item.message },
                            { id: 'actor', header: text('操作者', 'Actor'), cell: (item) => item.actor_user ?? 'system' },
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
    const [yaml, setYaml] = useState('type: local\npath: ~/.dstack/server/config.yml\n');
    const backendYaml = useGetBackendYamlQuery({ projectName, backendName }, { skip: create || !backendName });
    const [createBackend, createState] = useCreateBackendViaYamlMutation();
    const [updateBackend, updateState] = useUpdateBackendViaYamlMutation();
    const [deleteBackend] = useDeleteProjectBackendMutation();

    useMemo(() => {
        if (backendYaml.data?.config_yaml) {
            setYaml(backendYaml.data.config_yaml);
        }
    }, [backendYaml.data]);

    const save = () => {
        const backend = { config_yaml: yaml };
        return create ? createBackend({ projectName, backend }) : updateBackend({ projectName, backend });
    };

    return (
        <>
            <PageHeader
                title={create ? text('新建 Backend', 'New backend') : backendName}
                actions={
                    !create && (
                        <Button variant="danger" onClick={() => deleteBackend({ projectName, backends_names: [backendName] })}>
                            {text('删除', 'Delete')}
                        </Button>
                    )
                }
            />
            <Panel title="YAML">
                <TextArea className="min-h-96 font-mono" value={yaml} onChange={(event) => setYaml(event.target.value)} />
                <div className="mt-4 flex justify-end">
                    <Button
                        variant="primary"
                        icon={<Save className="h-4 w-4" />}
                        loading={createState.isLoading || updateState.isLoading}
                        onClick={save}
                    >
                        {text('保存', 'Save')}
                    </Button>
                </div>
            </Panel>
        </>
    );
};

export const GatewayPage: React.FC<{ create?: boolean }> = ({ create }) => {
    const { projectName = '', gatewayName = '' } = useParams();
    return (
        <>
            <PageHeader title={create ? 'New gateway' : gatewayName} description={projectName} />
            <Panel title="Gateway">
                <CodeBlock value={{ projectName, gatewayName, create }} />
            </Panel>
        </>
    );
};

export const UsersPage: React.FC = () => {
    const navigate = useNavigate();
    const { text } = useLocaleText();
    const users = useGetUserListQuery({ limit: 500 });
    const [deleteUsers] = useDeleteUsersMutation();

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
                        { id: 'role', header: text('角色', 'Role'), cell: (item) => item.global_role },
                        { id: 'email', header: 'Email', cell: (item) => valueOrDash(item.email) },
                        {
                            id: 'active',
                            header: text('状态', 'Status'),
                            cell: (item) => <RequestStatus status={item.active ? 'active' : 'disabled'} />,
                        },
                        {
                            id: 'actions',
                            header: text('操作', 'Actions'),
                            cell: (item) => (
                                <Button variant="danger" onClick={() => deleteUsers([item.username])}>
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

export const UserCreatePage: React.FC = () => {
    const navigate = useNavigate();
    const { text } = useLocaleText();
    const [createUser, createState] = useCreateUserMutation();
    const [values, setValues] = useState({ username: '', email: '', global_role: 'user' as TUserRole, active: true });

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        const user = await createUser({ ...values, id: '', permissions: [] }).unwrap();
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
                                <option value="user">user</option>
                                <option value="admin">admin</option>
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
    const { text } = useLocaleText();
    const user = useGetUserQuery({ name: userName });
    const billing = useGetUserBillingInfoQuery({ username: userName }, { skip: process.env.UI_VERSION !== 'sky' });
    const [updateUser] = useUpdateUserMutation();
    const [refreshToken] = useRefreshTokenMutation();
    const [pushNotification] = useNotifications();

    const refresh = async () => {
        const result = await refreshToken({ username: userName }).unwrap();
        copyToClipboard(result.creds.token, () =>
            pushNotification({ type: 'success', header: text('Token 已复制', 'Token copied') }),
        );
    };

    return (
        <>
            <PageHeader
                title={userName}
                actions={
                    <>
                        <Button icon={<RefreshCcw className="h-4 w-4" />} onClick={refresh}>
                            {text('刷新 Token', 'Refresh token')}
                        </Button>
                        {user.data && (
                            <Button onClick={() => updateUser({ username: userName, active: !user.data!.active })}>
                                {user.data.active ? text('禁用', 'Disable') : text('启用', 'Enable')}
                            </Button>
                        )}
                    </>
                }
            />
            <div className="grid gap-6 xl:grid-cols-2">
                <Panel title={text('用户信息', 'User info')}>
                    <CodeBlock value={user.data ?? {}} />
                </Panel>
                {process.env.UI_VERSION === 'sky' && (
                    <Panel title={text('账单', 'Billing')}>
                        <CodeBlock value={billing.data ?? {}} />
                    </Panel>
                )}
            </div>
        </>
    );
};

export const EventsPage: React.FC = () => {
    const { text } = useLocaleText();
    const events = useGetAllEventsQuery({ limit: 500 });
    return (
        <>
            <PageHeader title={text('系统事件', 'Events')} />
            <Panel title={text('事件列表', 'Events')}>
                <DataTable
                    items={events.data ?? []}
                    loading={events.isLoading}
                    keyGetter={(item) => item.id}
                    columns={[
                        { id: 'time', header: text('时间', 'Time'), cell: (item) => formatDate(item.recorded_at) },
                        { id: 'message', header: text('消息', 'Message'), cell: (item) => item.message },
                        { id: 'actor', header: text('操作者', 'Actor'), cell: (item) => item.actor_user ?? 'system' },
                    ]}
                />
            </Panel>
        </>
    );
};

export const AccountProfilePage: React.FC = () => {
    const user = useAppSelector(selectUserData);
    const { text } = useLocaleText();
    return (
        <>
            <PageHeader title={text('个人资料', 'Profile')} />
            <Panel title={text('账户信息', 'Account')}>
                <CodeBlock value={user ?? {}} />
            </Panel>
        </>
    );
};

export const AccountProjectsPage: React.FC = () => {
    return <ProjectsPage />;
};

export const AccountKeysPage: React.FC = () => {
    const { text } = useLocaleText();
    const keys = useListPublicKeysQuery();
    const [addKey] = useAddPublicKeyMutation();
    const [deleteKeys] = useDeletePublicKeysMutation();
    const [key, setKey] = useState('');
    const [name, setName] = useState('');

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
                        columns={[
                            { id: 'name', header: text('名称', 'Name'), cell: (item) => item.name },
                            { id: 'fingerprint', header: 'Fingerprint', cell: (item) => item.fingerprint },
                            {
                                id: 'actions',
                                header: text('操作', 'Actions'),
                                cell: (item) => (
                                    <Button variant="danger" onClick={() => deleteKeys([item.id])}>
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
                <CodeBlock value={billing.data ?? {}} />
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
