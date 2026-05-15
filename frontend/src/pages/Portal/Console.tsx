import React from 'react';
import { Link } from 'react-router-dom';

import { EmptyState, usePortalContext } from './components';
import { CONSOLE_ENTRY_PATH } from './constants';

import styles from './styles.module.scss';

export const PortalConsole: React.FC = () => {
    const { role } = usePortalContext();

    if (!role.canManagePortal) {
        return (
            <section className={styles.panel}>
                <EmptyState title="没有高级控制台权限" message="普通用户只需要使用 GPU 申请和我的容器页面。" />
            </section>
        );
    }

    return (
        <section className={styles.panel}>
            <div className={styles.panelHeader}>
                <h2 className={styles.panelTitle}>高级控制台</h2>
            </div>
            <div className={styles.panelBody}>
                <div className={styles.consoleMessage}>
                    <p>高级控制台保留原 dstack 的完整管理能力，包括 Runs、Fleets、Projects、Users 等工程视图。</p>
                    <Link className={styles.buttonPrimary} to={CONSOLE_ENTRY_PATH}>
                        进入原 dstack 控制台
                    </Link>
                </div>
            </div>
        </section>
    );
};
