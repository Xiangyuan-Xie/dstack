declare type TThemeMode = 'light' | 'dark';

declare type TLocale = 'zh' | 'en';

declare interface IConsoleNavItem {
    label: string;
    href: string;
    adminOnly?: boolean;
    icon?: string;
}

declare interface IConsoleNavSection {
    title: string;
    items: IConsoleNavItem[];
}

declare interface IConsoleAction {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    disabled?: boolean;
}

declare interface IConsoleTableColumn<T> {
    id: string;
    header: string;
    cell: (item: T) => React.ReactNode;
    sortValue?: (item: T) => string | number | null | undefined;
    className?: string;
}

declare interface IPortalNavItem extends IConsoleNavItem {}

declare interface IConsoleUserRole {
    isGlobalAdmin: boolean;
    canManagePortal: boolean;
    canUseProjectAdmin: boolean;
    canUseGlobalAdmin: boolean;
    manageableProjectNames: string[];
}

declare interface IPortalUserRole extends IConsoleUserRole {}

declare interface IRunSummary {
    id: string;
    name: string;
    projectName: string;
    applicant: string;
    status: TJobStatus | TRunRequestStatus;
    image: string;
    resources: string;
    url?: string | null;
    requestDetailsPath: string;
    runDetailsPath?: string;
    logsPath?: string;
}

declare interface IRunRequestFormValues {
    run_type: TRunRequestType;
    project_name: string;
    name: string;
    image: string;
    commands: string;
    init: string;
    ide: TIde | '';
    inactivity_duration: string;
    entrypoint: string;
    working_dir: string;
    env: TRunRequestEnvRow[];
    ports: TRunRequestPortRow[];
    persistent_dirs: TRunRequestPersistentDir[];
    privileged: boolean;
    cpu: string;
    memory: string;
    gpu: string;
    max_duration: string;
    fleets: string;
}
