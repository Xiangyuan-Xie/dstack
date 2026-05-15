import React from 'react';
import { Link } from 'react-router-dom';

import { EmptyState, StatusBadge, usePortalContext } from './components';
import { PORTAL_ROUTES } from './constants';
import { usePortalGpuRequests, usePortalRuns } from './hooks';
import { getContainerSummaries, getGpuRequestStats } from './utils';

import styles from './styles.module.scss';

export const PortalDashboard: React.FC = () => {
    const { role } = usePortalContext();
    const { data: requests = [], isLoading: isLoadingRequests } = usePortalGpuRequests(role.canManagePortal);
    const { data: runs = [], isLoading: isLoadingRuns } = usePortalRuns();
    const stats = getGpuRequestStats(requests);
    const containers = getContainerSummaries(requests, runs).slice(0, 5);
    const pendingRequests = requests.filter((request) => request.status === 'pending').slice(0, 6);

    return (
        <div className={styles.contentNarrow}>
            <div className={styles.toolbar}>
                <div>
                    <h2 className={styles.panelTitle}>工作台</h2>
                    <div className={styles.muted}>跨项目汇总 GPU 申请、审批与容器状态</div>
                </div>
                <Link className={styles.buttonPrimary} to={PORTAL_ROUTES.GPU_REQUEST_CREATE}>
                    新建 GPU 申请
                </Link>
            </div>

            <div className={styles.grid}>
                <div className={styles.card}>
                    <div className={styles.statLabel}>全部申请</div>
                    <div className={styles.statValue}>{stats.total}</div>
                </div>
                <div className={styles.card}>
                    <div className={styles.statLabel}>待审批</div>
                    <div className={styles.statValue}>{stats.pending}</div>
                </div>
                <div className={styles.card}>
                    <div className={styles.statLabel}>已通过</div>
                    <div className={styles.statValue}>{stats.approved}</div>
                </div>
                <div className={styles.card}>
                    <div className={styles.statLabel}>运行容器</div>
                    <div className={styles.statValue}>{containers.length}</div>
                </div>
            </div>

            <div className={styles.twoColumnGrid} style={{ marginTop: 18 }}>
                <section className={styles.panel}>
                    <div className={styles.panelHeader}>
                        <h3 className={styles.panelTitle}>最近申请</h3>
                        <Link className={styles.button} to={PORTAL_ROUTES.GPU_REQUESTS}>
                            查看全部
                        </Link>
                    </div>
                    <div className={styles.panelBody}>
                        {isLoadingRequests && <div className={styles.muted}>加载申请中...</div>}
                        {!isLoadingRequests && !requests.length && (
                            <EmptyState title="还没有申请" message="提交第一条 GPU 申请后，审批状态会显示在这里。" />
                        )}
                        {!!requests.length && (
                            <div className={styles.tableViewport}>
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th>名称</th>
                                            <th>状态</th>
                                            <th>资源</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {requests.slice(0, 6).map((request) => (
                                            <tr key={request.id}>
                                                <td>
                                                    <Link
                                                        to={PORTAL_ROUTES.GPU_REQUEST_DETAILS.FORMAT(
                                                            request.project_name,
                                                            request.id,
                                                        )}
                                                    >
                                                        {request.request.name || request.id}
                                                    </Link>
                                                </td>
                                                <td>
                                                    <StatusBadge status={request.status} />
                                                </td>
                                                <td>
                                                    {request.request.resources?.gpu
                                                        ? `GPU ${request.request.resources.gpu}`
                                                        : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </section>

                <section className={styles.panel}>
                    <div className={styles.panelHeader}>
                        <h3 className={styles.panelTitle}>{role.canManagePortal ? '待处理审批' : '我的容器'}</h3>
                        <Link
                            className={styles.button}
                            to={role.canManagePortal ? PORTAL_ROUTES.ADMIN_APPROVALS : PORTAL_ROUTES.GPU_CONTAINERS}
                        >
                            打开
                        </Link>
                    </div>
                    <div className={styles.panelBody}>
                        {role.canManagePortal ? (
                            pendingRequests.length ? (
                                <div className={styles.tableViewport}>
                                    <table className={styles.table}>
                                        <tbody>
                                            {pendingRequests.map((request) => (
                                                <tr key={request.id}>
                                                    <td>
                                                        <Link
                                                            to={PORTAL_ROUTES.GPU_REQUEST_DETAILS.FORMAT(
                                                                request.project_name,
                                                                request.id,
                                                            )}
                                                        >
                                                            {request.request.name || request.id}
                                                        </Link>
                                                    </td>
                                                    <td>{request.applicant}</td>
                                                    <td>
                                                        <StatusBadge status={request.status} />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <EmptyState title="暂无待审批申请" />
                            )
                        ) : isLoadingRuns ? (
                            <div className={styles.muted}>加载容器中...</div>
                        ) : containers.length ? (
                            <div className={styles.tableViewport}>
                                <table className={styles.table}>
                                    <tbody>
                                        {containers.map((container) => (
                                            <tr key={container.id}>
                                                <td>
                                                    <Link to={container.runDetailsPath}>{container.name}</Link>
                                                </td>
                                                <td>
                                                    <StatusBadge status={container.status} />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <EmptyState title="暂无容器实例" />
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
};
