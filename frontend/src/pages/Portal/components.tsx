import React, { useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import classNames from 'classnames';

import { Notifications } from 'components/Notifications';

import { useAppSelector } from 'hooks';
import { useLocalStorageState } from 'hooks/useLocalStorageState';
import { ROUTES } from 'routes';
import { useGetProjectsQuery, useLazyGetProjectQuery } from 'services/project';

import { selectUserData } from 'App/slice';

import { PORTAL_ROUTES } from './constants';
import { getPortalNavItems, getPortalUserRole } from './utils';

import styles from './styles.module.scss';

type PortalContextValue = {
    projects: IProject[];
    selectedProjectName: string;
    setSelectedProjectName: (projectName: string) => void;
    role: IPortalUserRole;
    user: IUser | null | undefined;
};

const PortalContext = React.createContext<PortalContextValue | null>(null);

export const usePortalContext = () => {
    const context = React.useContext(PortalContext);
    if (!context) {
        throw new Error('usePortalContext must be used within PortalLayout');
    }
    return context;
};

export const PortalLayout: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const user = useAppSelector(selectUserData);
    const { data: projectsData } = useGetProjectsQuery({ include_not_joined: false });
    const [getProject] = useLazyGetProjectQuery();
    const [projectDetails, setProjectDetails] = useState<Record<string, IProject>>({});
    const projectList = projectsData?.data ?? [];
    const projects = useMemo(
        () => projectList.map((project) => projectDetails[project.project_name] ?? project),
        [projectDetails, projectList],
    );
    const [selectedProjectName, setSelectedProjectName] = useLocalStorageState<string>('portal-project-name', '');
    const role = useMemo(() => getPortalUserRole(projects, user), [projects, user]);
    const navItems = useMemo(() => getPortalNavItems(role), [role]);

    useEffect(() => {
        if (!projects.length) {
            return;
        }

        const hasSelectedProject = projects.some((project) => project.project_name === selectedProjectName);
        if (!selectedProjectName || !hasSelectedProject) {
            setSelectedProjectName(projects[0].project_name);
        }
    }, [projects, selectedProjectName, setSelectedProjectName]);

    useEffect(() => {
        projectList.forEach((project) => {
            if (projectDetails[project.project_name]) {
                return;
            }
            getProject({ name: project.project_name })
                .unwrap()
                .then((projectDetail) => {
                    setProjectDetails((currentDetails) => ({
                        ...currentDetails,
                        [projectDetail.project_name]: projectDetail,
                    }));
                })
                .catch(() => undefined);
        });
    }, [getProject, projectDetails, projectList]);

    const signOut = () => {
        navigate(ROUTES.LOGOUT);
    };

    return (
        <PortalContext.Provider
            value={{
                projects,
                selectedProjectName,
                setSelectedProjectName,
                role,
                user,
            }}
        >
            <div className={styles.portal}>
                <aside className={styles.sidebar}>
                    <div className={styles.brand}>
                        <div className={styles.brandTitle}>GPU 管理平台</div>
                        <div className={styles.brandSubtitle}>申请、审批与容器运行</div>
                    </div>

                    <nav className={styles.nav}>
                        {navItems.map((item) => (
                            <Link
                                key={item.href}
                                className={classNames(styles.navItem, {
                                    [styles.navItemActive]:
                                        item.href === PORTAL_ROUTES.DASHBOARD
                                            ? location.pathname === item.href
                                            : location.pathname.startsWith(item.href),
                                })}
                                to={item.href}
                            >
                                {item.label}
                            </Link>
                        ))}
                    </nav>

                    <div className={styles.sidebarFooter}>
                        <div>{user?.username || '已登录用户'}</div>
                        <div>{role.canManagePortal ? '管理员视图' : '用户视图'}</div>
                    </div>
                </aside>

                <main className={styles.main}>
                    <header className={styles.topbar}>
                        <div className={styles.pageTitle}>
                            <h1>GPU 资源管理</h1>
                            <span>项目、申请、容器与服务器</span>
                        </div>

                        <div className={styles.topbarActions}>
                            <button className={styles.button} type="button" onClick={signOut}>
                                退出
                            </button>
                        </div>
                    </header>

                    <div className={styles.content}>
                        <Notifications />
                        <Outlet />
                    </div>
                </main>
            </div>
        </PortalContext.Provider>
    );
};

export const StatusBadge: React.FC<{ status: TJobStatus | TGpuRequestStatus }> = ({ status }) => {
    const className = classNames(styles.status, {
        [styles.statusPending]: status === 'pending' || status === 'submitted' || status === 'provisioning',
        [styles.statusApproved]: status === 'approved' || status === 'running' || status === 'done',
        [styles.statusRejected]: status === 'rejected' || status === 'aborted' || status === 'terminated',
        [styles.statusFailed]: status === 'failed',
        [styles.statusNeutral]:
            status !== 'pending' &&
            status !== 'submitted' &&
            status !== 'provisioning' &&
            status !== 'approved' &&
            status !== 'running' &&
            status !== 'done' &&
            status !== 'rejected' &&
            status !== 'aborted' &&
            status !== 'terminated' &&
            status !== 'failed',
    });

    const textMap: Partial<Record<TJobStatus | TGpuRequestStatus, string>> = {
        pending: '待审批',
        approved: '已通过',
        rejected: '已拒绝',
        failed: '失败',
        submitted: '已提交',
        provisioning: '准备资源',
        pulling: '拉取镜像',
        running: '运行中',
        terminating: '停止中',
        terminated: '已停止',
        aborted: '已终止',
        done: '已完成',
    };

    return <span className={className}>{textMap[status] ?? status}</span>;
};

export const EmptyState: React.FC<{ title: string; message?: string; action?: React.ReactNode }> = ({
    title,
    message,
    action,
}) => (
    <div className={styles.empty}>
        <strong>{title}</strong>
        {message && <p>{message}</p>}
        {action}
    </div>
);
