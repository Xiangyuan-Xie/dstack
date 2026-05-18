import React, { Fragment, ReactNode, useMemo, useState } from 'react';
import classNames from 'classnames';
import i18n from 'i18next';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronsUpDown, Info, Loader2, Search, X, XCircle } from 'lucide-react';
import { close, selectConfirmationDialogs } from 'ui/confirmation/slice';
import { selectNotifications } from 'ui/notifications/slice';

import { useAppDispatch, useAppSelector } from 'hooks';

/* eslint-disable react/prop-types */

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

const buttonVariants: Record<ButtonVariant, string> = {
    primary:
        'border-transparent bg-blue-600 text-white shadow-sm shadow-blue-600/20 hover:bg-blue-700 focus:ring-blue-500 dark:bg-blue-500 dark:hover:bg-blue-400',
    secondary:
        'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800',
    danger: 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 focus:ring-red-500 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20',
    ghost: 'border-transparent bg-transparent text-slate-600 hover:bg-slate-100 focus:ring-blue-500 dark:text-slate-300 dark:hover:bg-slate-800',
};

const statusClasses = {
    success:
        'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30',
    warning: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30',
    danger: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/30',
    info: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/30',
    neutral: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700',
    pending: 'bg-yellow-50 text-yellow-700 ring-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-300 dark:ring-yellow-500/30',
};

const notificationIcons = {
    success: CheckCircle2,
    warning: AlertCircle,
    error: XCircle,
    info: Info,
};

export const Button: React.FC<
    React.ButtonHTMLAttributes<HTMLButtonElement> & {
        variant?: ButtonVariant;
        loading?: boolean;
        icon?: ReactNode;
    }
> = ({ className, variant = 'secondary', loading, icon, children, disabled, ...props }) => (
    <button
        {...props}
        disabled={disabled || loading}
        className={classNames(
            'inline-flex h-10 min-w-24 shrink-0 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold leading-none transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-offset-slate-950',
            buttonVariants[variant],
            className,
        )}
    >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
        <span className="whitespace-nowrap">{children}</span>
    </button>
);

export const IconButton: React.FC<
    React.ButtonHTMLAttributes<HTMLButtonElement> & {
        label: string;
        variant?: ButtonVariant;
        icon: ReactNode;
    }
> = ({ label, icon, className, variant = 'ghost', ...props }) => (
    <button
        {...props}
        aria-label={label}
        title={label}
        className={classNames(
            'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-sm transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-offset-slate-950',
            buttonVariants[variant],
            className,
        )}
    >
        {icon}
    </button>
);

export const Panel: React.FC<{
    title?: ReactNode;
    description?: ReactNode;
    actions?: ReactNode;
    className?: string;
    children?: ReactNode;
}> = ({ title, description, actions, className, children }) => {
    const hasHeader = title || description || actions;
    const hasBody = React.Children.count(children) > 0;

    return (
        <section
            className={classNames(
                'rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none',
                className,
            )}
        >
            {hasHeader && (
                <div
                    className={classNames(
                        'flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between',
                        hasBody && 'border-b border-slate-200 dark:border-slate-800',
                    )}
                >
                    <div className="min-w-0">
                        {title && (
                            <h2 className="truncate text-base font-semibold text-slate-950 dark:text-slate-50">{title}</h2>
                        )}
                        {description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
                    </div>
                    {actions && <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">{actions}</div>}
                </div>
            )}
            {hasBody && <div className="p-5">{children}</div>}
        </section>
    );
};

export const PageHeader: React.FC<{
    title: ReactNode;
    description?: ReactNode;
    actions?: ReactNode;
}> = ({ title, description, actions }) => (
    <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-normal text-slate-950 dark:text-slate-50">{title}</h1>
            {description && <p className="mt-2 max-w-3xl text-sm text-slate-500 dark:text-slate-400">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">{actions}</div>}
    </div>
);

export const MetricCard: React.FC<{
    label: ReactNode;
    value: ReactNode;
    description?: ReactNode;
    accent?: 'blue' | 'teal' | 'amber' | 'rose' | 'slate';
}> = ({ label, value, description, accent = 'blue' }) => {
    const accentClass = {
        blue: 'from-blue-500/14 to-blue-500/0 text-blue-600 dark:text-blue-300',
        teal: 'from-teal-500/14 to-teal-500/0 text-teal-600 dark:text-teal-300',
        amber: 'from-amber-500/14 to-amber-500/0 text-amber-600 dark:text-amber-300',
        rose: 'from-rose-500/14 to-rose-500/0 text-rose-600 dark:text-rose-300',
        slate: 'from-slate-500/12 to-slate-500/0 text-slate-600 dark:text-slate-300',
    }[accent];

    return (
        <div
            className={classNames(
                'rounded-xl border border-slate-200 bg-gradient-to-br p-5 dark:border-slate-800',
                accentClass,
            )}
        >
            <div className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</div>
            <div className="mt-3 text-3xl font-bold text-slate-950 dark:text-slate-50">{value}</div>
            {description && <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">{description}</div>}
        </div>
    );
};

export const StatusBadge: React.FC<{
    children: ReactNode;
    tone?: keyof typeof statusClasses;
    className?: string;
}> = ({ children, tone = 'neutral', className }) => (
    <span
        className={classNames(
            'inline-flex h-7 items-center rounded-full px-2.5 text-xs font-semibold ring-1 ring-inset',
            statusClasses[tone],
            className,
        )}
    >
        {children}
    </span>
);

export const EmptyState: React.FC<{
    title: ReactNode;
    description?: ReactNode;
    actions?: ReactNode;
}> = ({ title, description, actions }) => (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-8 text-center dark:border-slate-700 dark:bg-slate-900/50">
        <div className="text-base font-semibold text-slate-900 dark:text-slate-50">{title}</div>
        {description && <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">{description}</p>}
        {actions && <div className="mt-5 flex flex-wrap justify-center gap-2">{actions}</div>}
    </div>
);

export const Field: React.FC<{
    label: ReactNode;
    hint?: ReactNode;
    error?: ReactNode;
    children: ReactNode;
}> = ({ label, hint, error, children }) => (
    <label className="block min-w-0">
        <span className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</span>
        {children}
        {hint && !error && <span className="mt-1.5 block text-xs text-slate-500 dark:text-slate-400">{hint}</span>}
        {error && <span className="mt-1.5 block text-xs font-medium text-red-600 dark:text-red-300">{error}</span>}
    </label>
);

const inputClass =
    'min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500';

export const TextInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className, ...props }) => (
    <input {...props} className={classNames(inputClass, className)} />
);

export const TextArea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = ({ className, ...props }) => (
    <textarea {...props} className={classNames(inputClass, 'min-h-28 resize-y', className)} />
);

export const SelectInput: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ className, children, ...props }) => (
    <div className="relative">
        <select {...props} className={classNames(inputClass, 'appearance-none pr-10', className)}>
            {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
);

export const SearchInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className, ...props }) => (
    <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input {...props} className={classNames(inputClass, 'pl-9', className)} />
    </div>
);

export function DataTable<T>({
    columns,
    items,
    keyGetter,
    loading,
    empty,
    emptyTitle = 'No data',
    className,
    defaultSortColumn,
}: {
    columns: IConsoleTableColumn<T>[];
    items: T[];
    keyGetter: (item: T) => string;
    loading?: boolean;
    empty?: ReactNode;
    emptyTitle?: ReactNode;
    className?: string;
    defaultSortColumn?: string;
}) {
    const localizedEmptyTitle = emptyTitle === 'No data' && i18n.language === 'zh' ? '暂无数据' : emptyTitle;
    const [sortColumn, setSortColumn] = useState(defaultSortColumn ?? columns[0]?.id);
    const [ascending, setAscending] = useState(true);

    const sortedItems = useMemo(() => {
        const column = columns.find((item) => item.id === sortColumn);
        if (!column?.sortValue) {
            return items;
        }

        return [...items].sort((a, b) => {
            const aValue = column.sortValue?.(a);
            const bValue = column.sortValue?.(b);
            if (aValue == null && bValue == null) return 0;
            if (aValue == null) return 1;
            if (bValue == null) return -1;
            if (aValue > bValue) return ascending ? 1 : -1;
            if (aValue < bValue) return ascending ? -1 : 1;
            return 0;
        });
    }, [ascending, columns, items, sortColumn]);

    if (loading) {
        return (
            <div className="flex min-h-52 items-center justify-center rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            </div>
        );
    }

    if (!items.length) {
        return <>{empty ?? <EmptyState title={localizedEmptyTitle} />}</>;
    }

    return (
        <div className={classNames('console-scrollbar overflow-x-auto', className)}>
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-slate-800">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-normal text-slate-500 dark:bg-slate-900/80 dark:text-slate-400">
                    <tr>
                        {columns.map((column) => (
                            <th key={column.id} className={classNames('whitespace-nowrap px-4 py-3', column.className)}>
                                {column.sortValue ? (
                                    <button
                                        type="button"
                                        className="inline-flex items-center gap-1 font-semibold"
                                        onClick={() => {
                                            if (sortColumn === column.id) {
                                                setAscending((value) => !value);
                                            } else {
                                                setSortColumn(column.id);
                                                setAscending(true);
                                            }
                                        }}
                                    >
                                        {column.header}
                                        <ChevronsUpDown className="h-3.5 w-3.5" />
                                    </button>
                                ) : (
                                    column.header
                                )}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
                    {sortedItems.map((item) => (
                        <tr key={keyGetter(item)} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/70">
                            {columns.map((column) => (
                                <td key={column.id} className={classNames('whitespace-nowrap px-4 py-3', column.className)}>
                                    {column.cell(item)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export const CodeBlock: React.FC<{ value?: string | null; className?: string }> = ({ value, className }) => (
    <pre
        className={classNames(
            'console-scrollbar max-h-[560px] overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-100',
            className,
        )}
    >
        {value ?? ''}
    </pre>
);

export const Modal: React.FC<{
    title: ReactNode;
    children: ReactNode;
    open: boolean;
    footer?: ReactNode;
    onClose: () => void;
}> = ({ title, children, open, footer, onClose }) => {
    if (!open) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
            <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                    <h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">{title}</h2>
                    <IconButton label={i18n.language === 'zh' ? '关闭' : 'Close'} icon={<X className="h-4 w-4" />} onClick={onClose} />
                </div>
                <div className="p-5">{children}</div>
                {footer && (
                    <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-800">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
};

export const ToastViewport: React.FC = () => {
    const items = useAppSelector(selectNotifications);

    return (
        <div className="fixed right-4 top-4 z-[60] flex w-[min(420px,calc(100vw-2rem))] flex-col gap-3">
            {items.map((item) => {
                const type = item.type ?? 'info';
                const Icon = notificationIcons[type];
                return (
                    <div
                        key={item.id}
                        className="rounded-xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none"
                    >
                        <div className="flex items-start gap-3">
                            <Icon className="mt-0.5 h-5 w-5 text-blue-500" />
                            <div className="min-w-0 flex-1">
                                {item.header && (
                                    <div className="font-semibold text-slate-950 dark:text-slate-50">{item.header}</div>
                                )}
                                {item.content && (
                                    <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{item.content}</div>
                                )}
                            </div>
                            {item.dismissible && (
                                <button
                                    type="button"
                                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                    onClick={item.onDismiss}
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export const ConfirmationDialogViewport: React.FC = () => {
    const dispatch = useAppDispatch();
    const dialogs = useAppSelector(selectConfirmationDialogs);
    const dialog = dialogs[dialogs.length - 1];
    const isZh = i18n.language?.startsWith('zh');

    if (!dialog) {
        return null;
    }

    return (
        <Modal
            open
            title={dialog.title ?? 'Confirm'}
            onClose={() => dispatch(close(dialog.uuid))}
            footer={
                <Fragment>
                    <Button variant="secondary" onClick={dialog.onDiscard}>
                        {dialog.cancelButtonLabel ?? (isZh ? '取消' : 'Cancel')}
                    </Button>
                    <Button variant="danger" onClick={dialog.onConfirm}>
                        {dialog.confirmButtonLabel ?? (isZh ? '确认' : 'Confirm')}
                    </Button>
                </Fragment>
            }
        >
            <div className="text-sm text-slate-600 dark:text-slate-300">{dialog.content}</div>
        </Modal>
    );
};
