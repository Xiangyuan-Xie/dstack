import React, { createContext, ReactNode, useContext, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Outlet, useLocation } from 'react-router-dom';
import classNames from 'classnames';
import * as Icons from 'lucide-react';
import { Bell, Languages, LogOut, Menu, Moon, Sun, X } from 'lucide-react';
import { Button, ConfirmationDialogViewport, IconButton, ToastViewport } from 'ui';
import { markAllRead, selectNotificationUnreadCount, selectNotifications } from 'ui/notifications/slice';

import { useAppDispatch, useAppSelector } from 'hooks';
import { ROUTES } from 'routes';
import { useGetAllEventsQuery } from 'services/events';
import { useGetProjectsQuery } from 'services/project';

import { selectSystemMode, selectUserData, setSystemMode } from 'App/slice';

import { CONSOLE_ROUTES, LOCALE_STORAGE_KEY } from './constants';
import {
    canAccessConsoleRoute,
    getConsoleNavSections,
    getConsoleUserRole,
    getNotificationCenterItems,
    isConsoleNavItemActive,
} from './utils';

type ConsoleContextValue = {
    projects: IProject[];
    role: IConsoleUserRole;
    user: IUser | null;
    locale: TLocale;
};

const ConsoleContext = createContext<ConsoleContextValue>({
    projects: [],
    role: {
        isGlobalAdmin: false,
        canManagePortal: false,
        canUseProjectAdmin: false,
        canUseGlobalAdmin: false,
        manageableProjectNames: [],
    },
    user: null,
    locale: 'zh',
});

export const useConsoleContext = () => useContext(ConsoleContext);

const IconForName: React.FC<{ name?: string; className?: string }> = ({ name, className }) => {
    const Icon = name ? (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[name] : null;
    return Icon ? <Icon className={className} /> : <Icons.Circle className={className} />;
};

const Sidebar: React.FC<{
    role: IConsoleUserRole;
    locale: TLocale;
    open: boolean;
    onClose: () => void;
}> = ({ role, locale, open, onClose }) => {
    const navSections = getConsoleNavSections(role, locale);
    const location = useLocation();

    return (
        <>
            <div
                className={classNames(
                    'fixed inset-0 z-40 bg-slate-950/60 transition lg:hidden',
                    open ? 'opacity-100' : 'pointer-events-none opacity-0',
                )}
                onClick={onClose}
            />
            <aside
                className={classNames(
                    'fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-[var(--console-sidebar)] text-white shadow-2xl transition-transform lg:static lg:z-auto lg:translate-x-0 lg:shadow-none',
                    open ? 'translate-x-0' : '-translate-x-full',
                )}
            >
                <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
                    <Link className="flex items-center gap-3" to={CONSOLE_ROUTES.DASHBOARD} onClick={onClose}>
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-teal-400 font-bold shadow-lg shadow-blue-500/30">
                            d
                        </div>
                        <div>
                            <div className="text-base font-bold">dstack</div>
                            <div className="text-xs text-slate-400">GPU Console</div>
                        </div>
                    </Link>
                    <IconButton
                        className="border-white/10 bg-white/5 text-white hover:bg-white/10 lg:hidden"
                        label="Close navigation"
                        icon={<X className="h-4 w-4" />}
                        onClick={onClose}
                    />
                </div>
                <nav className="console-scrollbar flex-1 overflow-y-auto px-3 py-5">
                    {navSections.map((section) => (
                        <div key={section.title} className="mb-6">
                            <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                {section.title}
                            </div>
                            <div className="grid gap-1">
                                {section.items.map((item) => {
                                    const active = isConsoleNavItemActive(location.pathname, item.href);

                                    return (
                                        <Link
                                            key={item.href}
                                            to={item.href}
                                            onClick={onClose}
                                            aria-current={active ? 'page' : undefined}
                                            className={classNames(
                                                'group flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition',
                                                active
                                                    ? 'bg-gradient-to-r from-blue-500 to-teal-400 text-white shadow-lg shadow-blue-500/20'
                                                    : 'text-slate-300 hover:bg-white/8 hover:text-white',
                                            )}
                                        >
                                            <IconForName name={item.icon} className="h-4 w-4" />
                                            <span className="truncate">{item.label}</span>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>
            </aside>
        </>
    );
};

export const ConsoleLayout: React.FC = () => {
    const { i18n } = useTranslation();
    const location = useLocation();
    const dispatch = useAppDispatch();
    const user = useAppSelector(selectUserData);
    const systemMode = useAppSelector(selectSystemMode);
    const notifications = useAppSelector(selectNotifications);
    const unreadCount = useAppSelector(selectNotificationUnreadCount);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const projectsQuery = useGetProjectsQuery({ include_not_joined: false });
    const projects = projectsQuery.data?.data ?? [];
    const locale = (i18n.language?.startsWith('en') ? 'en' : 'zh') as TLocale;
    const role = useMemo(() => getConsoleUserRole(projects, user), [projects, user]);
    const contextValue = useMemo(() => ({ projects, role, user: user ?? null, locale }), [locale, projects, role, user]);
    const events = useGetAllEventsQuery({ limit: 8 }, { skip: !notificationsOpen });
    const notificationItems = getNotificationCenterItems(notifications, notificationsOpen ? events.data ?? [] : [], locale);
    const notificationBadgeCount = unreadCount;

    const activeTitle = useMemo(() => {
        const sections = getConsoleNavSections(role, locale);
        return sections
            .flatMap((section) => section.items)
            .find((item) => isConsoleNavItemActive(location.pathname, item.href))?.label;
    }, [locale, location.pathname, role]);

    const changeLocale = async (nextLocale: TLocale) => {
        await i18n.changeLanguage(nextLocale);
        localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    };

    const toggleNotifications = () => {
        setNotificationsOpen((open) => {
            const nextOpen = !open;
            if (nextOpen) {
                dispatch(markAllRead());
            }
            return nextOpen;
        });
    };

    return (
        <ConsoleContext.Provider value={contextValue}>
            <div className="flex min-h-screen bg-[var(--console-bg)] text-[var(--console-text)]">
                <Sidebar role={role} locale={locale} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
                <div className="min-w-0 flex-1">
                    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-slate-200 bg-white/85 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80 sm:px-6">
                        <div className="flex min-w-0 items-center gap-3">
                            <IconButton
                                className="lg:hidden"
                                label="Open navigation"
                                icon={<Menu className="h-4 w-4" />}
                                onClick={() => setSidebarOpen(true)}
                            />
                            <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-slate-950 dark:text-slate-50">
                                    {activeTitle ?? 'dstack'}
                                </div>
                                <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                                    {user?.username ?? 'anonymous'}
                                </div>
                            </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                            <div className="relative">
                                <IconButton
                                    label={locale === 'zh' ? '通知' : 'Notifications'}
                                    icon={<Bell className="h-4 w-4" />}
                                    onClick={toggleNotifications}
                                />
                                {notificationBadgeCount > 0 && (
                                    <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold leading-5 text-white shadow-sm">
                                        {notificationBadgeCount > 99 ? '99+' : notificationBadgeCount}
                                    </span>
                                )}
                                {notificationsOpen && (
                                    <NotificationCenterPanel
                                        locale={locale}
                                        items={notificationItems}
                                        loading={events.isLoading}
                                        onClose={() => setNotificationsOpen(false)}
                                    />
                                )}
                            </div>
                            <Button
                                className="hidden min-w-20 px-3 sm:inline-flex"
                                variant="ghost"
                                icon={<Languages className="h-4 w-4" />}
                                onClick={() => changeLocale(locale === 'zh' ? 'en' : 'zh')}
                            >
                                {locale === 'zh' ? 'EN' : '中文'}
                            </Button>
                            <IconButton
                                label={systemMode === 'dark' ? 'Light mode' : 'Dark mode'}
                                icon={systemMode === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                                onClick={() => dispatch(setSystemMode(systemMode === 'dark' ? 'light' : 'dark'))}
                            />
                            <Button
                                className="min-w-20 px-3"
                                variant="secondary"
                                icon={<LogOut className="h-4 w-4" />}
                                onClick={() => (window.location.href = ROUTES.LOGOUT)}
                            >
                                {locale === 'zh' ? '退出' : 'Sign out'}
                            </Button>
                        </div>
                    </header>
                    <main className="min-h-[calc(100vh-4rem)] px-4 py-6 sm:px-6 lg:px-8">
                        {canAccessConsoleRoute(role, location.pathname) ? <Outlet /> : <AccessDenied locale={locale} />}
                    </main>
                </div>
                <ToastViewport />
                <ConfirmationDialogViewport />
            </div>
        </ConsoleContext.Provider>
    );
};

const formatNotificationTime = (value?: string) => {
    if (!value) {
        return undefined;
    }
    try {
        return new Date(value).toLocaleString();
    } catch {
        return value;
    }
};

const NotificationCenterPanel: React.FC<{
    locale: TLocale;
    items: ReturnType<typeof getNotificationCenterItems>;
    loading: boolean;
    onClose: () => void;
}> = ({ locale, items, loading, onClose }) => (
    <div className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-xl shadow-slate-900/10 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <div>
                <div className="text-sm font-bold text-slate-950 dark:text-slate-50">
                    {locale === 'zh' ? '通知中心' : 'Notification center'}
                </div>
                <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {locale === 'zh' ? '最近通知和系统事件' : 'Recent notifications and events'}
                </div>
            </div>
            <IconButton
                className="h-8 w-8"
                label={locale === 'zh' ? '关闭' : 'Close'}
                icon={<X className="h-4 w-4" />}
                onClick={onClose}
            />
        </div>
        <div className="console-scrollbar max-h-96 overflow-y-auto p-3">
            {items.length ? (
                <div className="grid gap-2">
                    {items.map((item) => (
                        <div
                            key={`${item.type}-${item.id}`}
                            className="rounded-lg border border-slate-200 p-3 dark:border-slate-800"
                        >
                            <div className="flex items-start gap-2">
                                <span
                                    className={classNames(
                                        'mt-1 h-2 w-2 shrink-0 rounded-full',
                                        item.tone === 'success' && 'bg-emerald-500',
                                        item.tone === 'error' && 'bg-red-500',
                                        item.tone === 'warning' && 'bg-amber-500',
                                        item.tone === 'info' && 'bg-blue-500',
                                        item.tone === 'neutral' && 'bg-slate-400',
                                    )}
                                />
                                <div className="min-w-0 flex-1">
                                    <div className="break-words text-sm font-semibold text-slate-900 dark:text-slate-50">
                                        {item.title}
                                    </div>
                                    {item.description && (
                                        <div className="mt-1 break-words text-xs text-slate-500 dark:text-slate-400">
                                            {item.description}
                                        </div>
                                    )}
                                    {item.recordedAt && (
                                        <div className="mt-1 text-xs text-slate-400">
                                            {formatNotificationTime(item.recordedAt)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-400">
                    {loading ? (locale === 'zh' ? '加载中...' : 'Loading...') : locale === 'zh' ? '暂无通知' : 'No notifications'}
                </div>
            )}
        </div>
    </div>
);

const AccessDenied: React.FC<{ locale: TLocale }> = ({ locale }) => (
    <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-xl font-bold text-slate-950 dark:text-slate-50">
            {locale === 'zh' ? '无权访问' : 'Access denied'}
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {locale === 'zh' ? '当前账号没有访问该页面的权限。' : 'Your account does not have access to this page.'}
        </p>
    </div>
);

export const ProjectAdminRoute: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { role, locale } = useConsoleContext();

    if (!role.canUseProjectAdmin) {
        return <AccessDenied locale={locale} />;
    }

    return <>{children}</>;
};

export const GlobalAdminRoute: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { role, locale } = useConsoleContext();

    if (!role.canUseGlobalAdmin) {
        return <AccessDenied locale={locale} />;
    }

    return <>{children}</>;
};
