import React from 'react';
import { Link } from 'react-router-dom';

import { formatResources } from 'libs/resources';
import { ROUTES } from 'routes';
import { useGetFleetsQuery } from 'services/fleet';

import { EmptyState, StatusBadge, usePortalContext } from './components';

import styles from './styles.module.scss';

const getFleetStatus = (status: IFleet['status']): TJobStatus => {
    if (status === 'active') return 'running';
    if (status === 'failed') return 'failed';
    if (status === 'terminated') return 'terminated';
    return 'pending';
};

export const PortalServers: React.FC = () => {
    const { role } = usePortalContext();
    const {
        data: fleets = [],
        isLoading,
        refetch,
    } = useGetFleetsQuery(
        {
            include_imported: true,
        },
        {
            skip: !role.canManagePortal,
        },
    );

    if (!role.canManagePortal) {
        return (
            <section className={styles.panel}>
                <EmptyState title="没有服务器管理权限" message="只有项目管理员、项目经理或全局管理员可以查看服务器资源。" />
            </section>
        );
    }

    return (
        <section className={styles.panel}>
            <div className={styles.panelHeader}>
                <div>
                    <h2 className={styles.panelTitle}>服务器管理</h2>
                    <div className={styles.muted}>GPU 服务器池、实例数量与资源概览</div>
                </div>
                <div className={styles.topbarActions}>
                    <button className={styles.button} type="button" onClick={refetch}>
                        刷新
                    </button>
                    <Link className={styles.button} to={ROUTES.FLEETS.LIST}>
                        高级 Fleet 管理
                    </Link>
                </div>
            </div>

            <div className={styles.panelBody}>
                {isLoading && <div className={styles.muted}>加载服务器中...</div>}
                {!isLoading && !fleets.length && (
                    <EmptyState title="暂无服务器池" message="可在高级控制台中添加 fleet 或 worker。" />
                )}
                {!!fleets.length && (
                    <div className={styles.tableViewport}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>服务器池</th>
                                    <th>状态</th>
                                    <th>实例</th>
                                    <th>资源</th>
                                    <th>高级详情</th>
                                </tr>
                            </thead>
                            <tbody>
                                {fleets.map((fleet) => {
                                    const firstInstance = fleet.instances[0];
                                    const resources = firstInstance?.instance_type?.resources;

                                    return (
                                        <tr key={fleet.id}>
                                            <td>
                                                {fleet.name}
                                                <div className={styles.muted}>{fleet.project_name}</div>
                                            </td>
                                            <td>
                                                <StatusBadge status={getFleetStatus(fleet.status)} />
                                                {fleet.status_message && (
                                                    <div className={styles.muted}>{fleet.status_message}</div>
                                                )}
                                            </td>
                                            <td>{fleet.instances.length}</td>
                                            <td>{resources ? formatResources(resources) : '-'}</td>
                                            <td>
                                                <Link to={ROUTES.FLEETS.DETAILS.FORMAT(fleet.project_name, fleet.id)}>
                                                    打开
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </section>
    );
};
