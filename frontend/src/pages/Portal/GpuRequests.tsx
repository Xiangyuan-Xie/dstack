import React from 'react';
import { Link } from 'react-router-dom';

import { EmptyState, StatusBadge, usePortalContext } from './components';
import { PORTAL_ROUTES } from './constants';
import { usePortalGpuRequests } from './hooks';
import { formatGpuRequestResourcesText } from './utils';

import styles from './styles.module.scss';

export const PortalGpuRequests: React.FC = () => {
    const { role } = usePortalContext();
    const { data: requests = [], isLoading, refetch } = usePortalGpuRequests(role.canManagePortal);

    return (
        <section className={styles.panel}>
            <div className={styles.panelHeader}>
                <div>
                    <h2 className={styles.panelTitle}>GPU 申请</h2>
                    <div className={styles.muted}>申请记录、审批状态与关联容器</div>
                </div>
                <div className={styles.topbarActions}>
                    <button className={styles.button} type="button" onClick={refetch}>
                        刷新
                    </button>
                    <Link className={styles.buttonPrimary} to={PORTAL_ROUTES.GPU_REQUEST_CREATE}>
                        新建申请
                    </Link>
                </div>
            </div>

            <div className={styles.panelBody}>
                {isLoading && <div className={styles.muted}>加载申请中...</div>}
                {!isLoading && !requests.length && (
                    <EmptyState
                        title="暂无 GPU 申请"
                        message="提交申请后，审批结果和关联容器会显示在这里。"
                        action={
                            <Link className={styles.buttonPrimary} to={PORTAL_ROUTES.GPU_REQUEST_CREATE}>
                                新建申请
                            </Link>
                        }
                    />
                )}
                {!!requests.length && (
                    <div className={styles.tableViewport}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>申请名称</th>
                                    <th>申请人</th>
                                    <th>状态</th>
                                    <th>镜像</th>
                                    <th>资源</th>
                                    <th>关联容器</th>
                                </tr>
                            </thead>
                            <tbody>
                                {requests.map((request) => (
                                    <tr key={request.id}>
                                        <td>
                                            <Link
                                                to={PORTAL_ROUTES.GPU_REQUEST_DETAILS.FORMAT(request.project_name, request.id)}
                                            >
                                                {request.request.name || request.id}
                                            </Link>
                                        </td>
                                        <td>{request.applicant}</td>
                                        <td>
                                            <StatusBadge status={request.status} />
                                        </td>
                                        <td>{request.request.image}</td>
                                        <td>{formatGpuRequestResourcesText(request.request)}</td>
                                        <td>
                                            {request.run_id ? (
                                                <Link
                                                    to={PORTAL_ROUTES.GPU_REQUEST_DETAILS.FORMAT(
                                                        request.project_name,
                                                        request.id,
                                                    )}
                                                >
                                                    {request.run_name || request.run_id}
                                                </Link>
                                            ) : (
                                                '-'
                                            )}
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
