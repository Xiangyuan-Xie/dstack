declare interface IPortalNavItem {
    label: string;
    href: string;
    adminOnly?: boolean;
}

declare interface IPortalUserRole {
    isGlobalAdmin: boolean;
    canManagePortal: boolean;
    manageableProjectNames: string[];
}

declare interface IContainerSummary {
    id: string;
    name: string;
    projectName: string;
    applicant: string;
    status: TJobStatus | TGpuRequestStatus;
    image: string;
    resources: string;
    url?: string | null;
    runDetailsPath: string;
    logsPath: string;
}

declare interface IGpuRequestFormValues {
    project_name: string;
    name: string;
    image: string;
    commands: string;
    env: string;
    ports: string;
    nodes: string;
    cpu: string;
    memory: string;
    gpu: string;
    disk: string;
    max_duration: string;
    fleets: string;
}
