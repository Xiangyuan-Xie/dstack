import React, { createContext, ReactNode, useContext, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import classNames from 'classnames';
import * as Icons from 'lucide-react';
import { Bell, Languages, LogOut, Menu, Moon, Sun, X } from 'lucide-react';
import { Button, ConfirmationDialogViewport, IconButton, ToastViewport } from 'ui';

import { useAppDispatch, useAppSelector } from 'hooks';
import { ROUTES } from 'routes';
import { useGetProjectsQuery } from 'services/project';

import { selectSystemMode, selectUserData, setSystemMode } from 'App/slice';

import { CONSOLE_ROUTES, LOCALE_STORAGE_KEY } from './constants';
import { getConsoleNavSections, getConsoleUserRole } from './utils';

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
                                {section.items.map((item) => (
                                    <NavLink
                                        key={item.href}
                                        to={item.href}
                                        onClick={onClose}
                                        className={({ isActive }) =>
                                            classNames(
                                                'group flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition',
                                                isActive
                                                    ? 'bg-gradient-to-r from-blue-500 to-teal-400 text-white shadow-lg shadow-blue-500/20'
                                                    : 'text-slate-300 hover:bg-white/8 hover:text-white',
                                            )
                                        }
                                    >
                                        <IconForName name={item.icon} className="h-4 w-4" />
                                        <span className="truncate">{item.label}</span>
                                    </NavLink>
                                ))}
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
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const projectsQuery = useGetProjectsQuery({ include_not_joined: false });
    const projects = projectsQuery.data?.data ?? [];
    const locale = (i18n.language?.startsWith('en') ? 'en' : 'zh') as TLocale;
    const role = useMemo(() => getConsoleUserRole(projects, user), [projects, user]);
    const contextValue = useMemo(() => ({ projects, role, user: user ?? null, locale }), [locale, projects, role, user]);

    const activeTitle = useMemo(() => {
        const sections = getConsoleNavSections(role, locale);
        return sections
            .flatMap((section) => section.items)
            .find((item) => location.pathname === item.href || location.pathname.startsWith(`${item.href}/`))?.label;
    }, [locale, location.pathname, role]);

    const changeLocale = async (nextLocale: TLocale) => {
        await i18n.changeLanguage(nextLocale);
        localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    };

    return (
        <ConsoleContext.Provider value={contextValue}>
            <div className="flex min-h-screen bg-[var(--console-bg)] text-[var(--console-text)]">
                <Sidebar role={role} locale={locale} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
                <div className="min-w-0 flex-1">
                    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/85 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80 sm:px-6">
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
                            <IconButton label="Notifications" icon={<Bell className="h-4 w-4" />} />
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
                        <Outlet />
                    </main>
                </div>
                <ToastViewport />
                <ConfirmationDialogViewport />
            </div>
        </ConsoleContext.Provider>
    );
};

export const AdminRoute: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { role, locale } = useConsoleContext();

    if (!role.canManagePortal) {
        return (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
                <h1 className="text-xl font-bold text-slate-950 dark:text-slate-50">
                    {locale === 'zh' ? '无权访问' : 'Access denied'}
                </h1>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    {locale === 'zh' ? '当前账号没有管理权限。' : 'Your account does not have admin permissions.'}
                </p>
            </div>
        );
    }

    return <>{children}</>;
};
