import React from 'react';
import { Link, useParams } from 'react-router-dom';

import { useNotifications } from 'hooks';
import { getServerError } from 'libs';
import { ROUTES } from 'routes';
import {
    useApproveGpuRequestMutation,
    useGetGpuRequestQuery,
    useRejectGpuRequestMutation,
    useRetryGpuRequestMutation,
} from 'services/gpuRequest';
import { useGetRunQuery } from 'services/run';

import { StatusBadge, usePortalContext } from './components';
import { PORTAL_ROUTES } from './constants';
import { canManagePortalProject, formatGpuRequestResourcesText } from './utils';

import styles from './styles.module.scss';

export const PortalGpuRequestDetails: React.FC = () => {
    const params = useParams();
    const [pushNotification] = useNotifications();
    const { role } = usePortalContext();
    const projectName = params.projectName ?? '';
    const requestId = params.requestId ?? '';
    const { data: request, isLoading } = useGetGpuRequestQuery(
        {
            project_name: projectName,
            id: requestId,
        },
        {
            skip: !projectName || !requestId,
        },
    );
    const { data: run } = useGetRunQuery(
        {
            project_name: projectName,
            id: request?.run_id ?? '',
        },
        {
            skip: !projectName || !request?.run_id,
        },
    );

    const [approveGpuRequest, { isLoading: isApproving }] = useApproveGpuRequestMutation();
    const [rejectGpuRequest, { isLoading: isRejecting }] = useRejectGpuRequestMutation();
    const [retryGpuRequest, { isLoading: isRetrying }] = useRetryGpuRequestMutation();
    const actionLoading = isApproving || isRejecting || isRetrying;

    const notifyError = (error: unknown) => {
        pushNotification({
            type: 'error' as const,
            content: getServerError(error),
        });
    };

    const approve = () => {
        if (!request) return;

        approveGpuRequest({ project_name: request.project_name, id: request.id })
            .unwrap()
            .then(() =>
                pushNotification({
                    type: 'success' as const,
                    content: '申请已审批通过',
                }),
            )
            .catch(notifyError);
    };

    const reject = () => {
        if (!request) return;

        const reason = window.prompt('请输入拒绝原因');
        if (!reason?.trim()) return;

        rejectGpuRequest({ project_name: request.project_name, id: request.id, reason: reason.trim() })
            .unwrap()
            .then(() =>
                pushNotification({
                    type: 'success' as const,
                    content: '申请已拒绝',
                }),
            )
            .catch(notifyError);
    };

    const retry = () => {
        if (!request) return;

        retryGpuRequest({ project_name: request.project_name, id: request.id })
            .unwrap()
            .then(() =>
                pushNotification({
                    type: 'success' as const,
                    content: '已重新尝试创建容器',
                }),
            )
            .catch(notifyError);
    };

    if (isLoading) {
        return <div className={styles.muted}>加载详情中...</div>;
    }

    if (!request) {
        return (
            <div className={styles.panel}>
                <div className={styles.empty}>没有找到这条申请。</div>
            </div>
        );
    }

    const canManageProject = canManagePortalProject(role, request.project_name);
    const canApprove = canManageProject && request.status === 'pending';
    const canRetry = canManageProject && request.status === 'failed';

    return (
        <div className={styles.contentNarrow}>
            <div className={styles.toolbar}>
                <div>
                    <h2 className={styles.panelTitle}>{request.request.name || 'GPU 申请详情'}</h2>
                    <div className={styles.muted}>申请编号：{request.id}</div>
                </div>
                <div className={styles.topbarActions}>
                    <Link className={styles.button} to={PORTAL_ROUTES.GPU_REQUESTS}>
                        返回列表
                    </Link>
                    {canManageProject && (
                        <>
                            <button
                                className={styles.buttonPrimary}
                                type="button"
                                disabled={!canApprove || actionLoading}
                                onClick={approve}
                            >
                                通过
                            </button>
                            <button
                                className={styles.buttonDanger}
                                type="button"
                                disabled={!canApprove || actionLoading}
                                onClick={reject}
                            >
                                拒绝
                            </button>
                            <button
                                className={styles.button}
                                type="button"
                                disabled={!canRetry || actionLoading}
                                onClick={retry}
                            >
                                重试
                            </button>
                        </>
                    )}
                </div>
            </div>

            <section className={styles.panel}>
                <div className={styles.panelHeader}>
                    <h3 className={styles.panelTitle}>审批状态</h3>
                    <StatusBadge status={request.status} />
                </div>
                <div className={styles.panelBody}>
                    <div className={styles.detailsList}>
                        <div>
                            <div className={styles.detailsLabel}>项目</div>
                            <div className={styles.detailsValue}>{request.project_name}</div>
                        </div>
                        <div>
                            <div className={styles.detailsLabel}>申请人</div>
                            <div className={styles.detailsValue}>{request.applicant}</div>
                        </div>
                        <div>
                            <div className={styles.detailsLabel}>审批人</div>
                            <div className={styles.detailsValue}>{request.reviewed_by || '-'}</div>
                        </div>
                        <div>
                            <div className={styles.detailsLabel}>审批说明</div>
                            <div className={styles.detailsValue}>{request.review_message || '-'}</div>
                        </div>
                    </div>
                </div>
            </section>

            <section className={styles.panel} style={{ marginTop: 16 }}>
                <div className={styles.panelHeader}>
                    <h3 className={styles.panelTitle}>容器配置</h3>
                </div>
                <div className={styles.panelBody}>
                    <div className={styles.detailsList}>
                        <div>
                            <div className={styles.detailsLabel}>镜像</div>
                            <div className={styles.detailsValue}>{request.request.image}</div>
                        </div>
                        <div>
                            <div className={styles.detailsLabel}>资源</div>
                            <div className={styles.detailsValue}>{formatGpuRequestResourcesText(request.request)}</div>
                        </div>
                        <div>
                            <div className={styles.detailsLabel}>节点数</div>
                            <div className={styles.detailsValue}>{request.request.nodes ?? 1}</div>
                        </div>
                        <div>
                            <div className={styles.detailsLabel}>端口</div>
                            <div className={styles.detailsValue}>{request.request.ports?.join(', ') || '-'}</div>
                        </div>
                        <div>
                            <div className={styles.detailsLabel}>最长运行时间</div>
                            <div className={styles.detailsValue}>{request.request.max_duration || '-'}</div>
                        </div>
                        <div>
                            <div className={styles.detailsLabel}>指定服务器/Fleet</div>
                            <div className={styles.detailsValue}>{request.request.fleets?.join(', ') || '-'}</div>
                        </div>
                    </div>
                </div>
            </section>

            <section className={styles.panel} style={{ marginTop: 16 }}>
                <div className={styles.panelHeader}>
                    <h3 className={styles.panelTitle}>启动命令</h3>
                </div>
                <div className={styles.panelBody}>
                    <pre className={styles.codeBlock}>{request.request.commands.join('\n')}</pre>
                </div>
            </section>

            <section className={styles.panel} style={{ marginTop: 16 }}>
                <div className={styles.panelHeader}>
                    <h3 className={styles.panelTitle}>容器运行信息</h3>
                    {run && <StatusBadge status={run.status} />}
                </div>
                <div className={styles.panelBody}>
                    {!request.run_id && <div className={styles.muted}>审批通过后会在这里显示容器状态和连接入口。</div>}
                    {request.run_id && (
                        <div className={styles.detailsList}>
                            <div>
                                <div className={styles.detailsLabel}>容器名称</div>
                                <div className={styles.detailsValue}>{request.run_name || request.run_id}</div>
                            </div>
                            <div>
                                <div className={styles.detailsLabel}>服务地址</div>
                                <div className={styles.detailsValue}>
                                    {run?.service?.url ? (
                                        <a href={run.service.url} target="_blank" rel="noreferrer">
                                            {run.service.url}
                                        </a>
                                    ) : (
                                        '-'
                                    )}
                                </div>
                            </div>
                            <div>
                                <div className={styles.detailsLabel}>高级详情</div>
                                <div className={styles.detailsValue}>
                                    <Link
                                        to={
                                            request.run_id
                                                ? ROUTES.PROJECT.DETAILS.RUNS.DETAILS.FORMAT(
                                                      request.project_name,
                                                      request.run_id,
                                                  )
                                                : '#'
                                        }
                                    >
                                        打开 Run 详情
                                    </Link>
                                </div>
                            </div>
                            <div>
                                <div className={styles.detailsLabel}>日志</div>
                                <div className={styles.detailsValue}>
                                    <Link
                                        to={
                                            request.run_id
                                                ? ROUTES.PROJECT.DETAILS.RUNS.DETAILS.LOGS.FORMAT(
                                                      request.project_name,
                                                      request.run_id,
                                                  )
                                                : '#'
                                        }
                                    >
                                        查看日志
                                    </Link>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
};
