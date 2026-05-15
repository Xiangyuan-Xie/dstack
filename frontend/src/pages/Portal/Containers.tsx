import React from 'react';
import { Link } from 'react-router-dom';

import { EmptyState, StatusBadge, usePortalContext } from './components';
import { usePortalGpuRequests, usePortalRuns } from './hooks';
import { getContainerSummaries } from './utils';

import styles from './styles.module.scss';

type Props = {
    adminView?: boolean;
};

export const PortalContainers: React.FC<Props> = ({ adminView = false }) => {
    const { role } = usePortalContext();
    const includeAll = adminView && role.canManagePortal;
    const { data: requests = [], isLoading: isLoadingRequests } = usePortalGpuRequests(includeAll);
    const { data: runs = [], isLoading: isLoadingRuns, refetch } = usePortalRuns();
    const containers = getContainerSummaries(requests, runs);

    if (adminView && !role.canManagePortal) {
        return (
            <section className={styles.panel}>
                <EmptyState title="没有容器管理权限" message="只有项目管理员、项目经理或全局管理员可以查看全部容器。" />
            </section>
        );
    }

    return (
        <section className={styles.panel}>
            <div className={styles.panelHeader}>
                <div>
                    <h2 className={styles.panelTitle}>{adminView ? '容器管理' : '我的容器'}</h2>
                    <div className={styles.muted}>
                        {adminView ? '查看可管理项目通过申请创建的容器实例。' : '这里只展示你申请并审批通过的容器。'}
                    </div>
                </div>
                <button className={styles.button} type="button" onClick={refetch}>
                    刷新
                </button>
            </div>

            <div className={styles.panelBody}>
                {(isLoadingRequests || isLoadingRuns) && <div className={styles.muted}>加载容器中...</div>}
                {!isLoadingRequests && !isLoadingRuns && !containers.length && (
                    <EmptyState title="暂无容器实例" message="GPU 申请审批通过后，容器会出现在这里。" />
                )}
                {!!containers.length && (
                    <div className={styles.tableViewport}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>容器</th>
                                    <th>申请人</th>
                                    <th>状态</th>
                                    <th>镜像</th>
                                    <th>资源</th>
                                    <th>连接</th>
                                    <th>日志</th>
                                </tr>
                            </thead>
                            <tbody>
                                {containers.map((container) => (
                                    <tr key={container.id}>
                                        <td>
                                            <Link to={container.runDetailsPath}>{container.name}</Link>
                                            <div className={styles.muted}>{container.projectName}</div>
                                        </td>
                                        <td>{container.applicant}</td>
                                        <td>
                                            <StatusBadge status={container.status} />
                                        </td>
                                        <td>{container.image}</td>
                                        <td>{container.resources}</td>
                                        <td>
                                            {container.url ? (
                                                <a href={container.url} target="_blank" rel="noreferrer">
                                                    打开
                                                </a>
                                            ) : (
                                                '-'
                                            )}
                                        </td>
                                        <td>
                                            <Link to={container.logsPath}>日志</Link>
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
