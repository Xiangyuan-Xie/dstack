import React from 'react';
import { Link } from 'react-router-dom';

import { useNotifications } from 'hooks';
import { getServerError } from 'libs';
import { useApproveGpuRequestMutation, useRejectGpuRequestMutation, useRetryGpuRequestMutation } from 'services/gpuRequest';

import { EmptyState, StatusBadge, usePortalContext } from './components';
import { PORTAL_ROUTES } from './constants';
import { usePortalGpuRequests } from './hooks';
import { formatGpuRequestResourcesText } from './utils';

import styles from './styles.module.scss';

export const PortalApprovals: React.FC = () => {
    const [pushNotification] = useNotifications();
    const { role } = usePortalContext();
    const { data: requests = [], isLoading, refetch } = usePortalGpuRequests(role.canManagePortal);
    const [approveGpuRequest, { isLoading: isApproving }] = useApproveGpuRequestMutation();
    const [rejectGpuRequest, { isLoading: isRejecting }] = useRejectGpuRequestMutation();
    const [retryGpuRequest, { isLoading: isRetrying }] = useRetryGpuRequestMutation();
    const actionLoading = isApproving || isRejecting || isRetrying;
    const reviewableRequests = requests.filter((request) => request.status === 'pending' || request.status === 'failed');

    const notifyError = (error: unknown) => {
        pushNotification({
            type: 'error' as const,
            content: getServerError(error),
        });
    };

    const approve = (request: IGpuRequest) => {
        approveGpuRequest({ project_name: request.project_name, id: request.id })
            .unwrap()
            .then(() =>
                pushNotification({
                    type: 'success' as const,
                    content: '申请已通过，正在创建容器',
                }),
            )
            .catch(notifyError);
    };

    const reject = (request: IGpuRequest) => {
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

    const retry = (request: IGpuRequest) => {
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

    if (!role.canManagePortal) {
        return (
            <section className={styles.panel}>
                <EmptyState title="没有审批权限" message="只有项目管理员、项目经理或全局管理员可以访问审批中心。" />
            </section>
        );
    }

    return (
        <section className={styles.panel}>
            <div className={styles.panelHeader}>
                <div>
                    <h2 className={styles.panelTitle}>审批中心</h2>
                    <div className={styles.muted}>待审批申请与失败重试</div>
                </div>
                <button className={styles.button} type="button" onClick={refetch}>
                    刷新
                </button>
            </div>

            <div className={styles.panelBody}>
                {isLoading && <div className={styles.muted}>加载审批列表中...</div>}
                {!isLoading && !reviewableRequests.length && <EmptyState title="暂无需要处理的申请" />}
                {!!reviewableRequests.length && (
                    <div className={styles.tableViewport}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>申请</th>
                                    <th>申请人</th>
                                    <th>状态</th>
                                    <th>镜像</th>
                                    <th>资源</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reviewableRequests.map((request) => (
                                    <tr key={request.id}>
                                        <td>
                                            <Link
                                                to={PORTAL_ROUTES.GPU_REQUEST_DETAILS.FORMAT(request.project_name, request.id)}
                                            >
                                                {request.request.name || request.id}
                                            </Link>
                                            <div className={styles.muted}>{request.project_name}</div>
                                        </td>
                                        <td>{request.applicant}</td>
                                        <td>
                                            <StatusBadge status={request.status} />
                                        </td>
                                        <td>{request.request.image}</td>
                                        <td>{formatGpuRequestResourcesText(request.request)}</td>
                                        <td>
                                            <div className={styles.topbarActions}>
                                                {request.status === 'pending' && (
                                                    <>
                                                        <button
                                                            className={styles.buttonPrimary}
                                                            type="button"
                                                            disabled={actionLoading}
                                                            onClick={() => approve(request)}
                                                        >
                                                            通过
                                                        </button>
                                                        <button
                                                            className={styles.buttonDanger}
                                                            type="button"
                                                            disabled={actionLoading}
                                                            onClick={() => reject(request)}
                                                        >
                                                            拒绝
                                                        </button>
                                                    </>
                                                )}
                                                {request.status === 'failed' && (
                                                    <button
                                                        className={styles.button}
                                                        type="button"
                                                        disabled={actionLoading}
                                                        onClick={() => retry(request)}
                                                    >
                                                        重试
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </section>
    );
};
