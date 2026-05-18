declare interface IResourcePoolGpuSummary {
    name: string;
    count: number;
    memory_gib?: number | null;
}

declare interface IResourcePoolGpuDevice {
    uuid?: string | null;
    index?: number | null;
    name: string;
    memory_gib?: number | null;
    occupied: boolean;
    project_name?: string | null;
    run_name?: string | null;
    job_id?: string | null;
}

declare interface IResourcePoolResources {
    cpu_count?: number | null;
    memory_gib?: number | null;
    disk_gib?: number | null;
    gpu_count: number;
    gpus: IResourcePoolGpuSummary[];
    gpu_devices?: IResourcePoolGpuDevice[];
}

declare interface IResourcePoolResourceSummary {
    instance_count: number;
    cpu_count: number;
    memory_gib: number;
    disk_gib: number;
    gpu_count: number;
    gpus: IResourcePoolGpuSummary[];
}

declare interface IResourcePoolUsage {
    cpu_percent?: number | null;
    memory_used_gib?: number | null;
    memory_total_gib?: number | null;
    disk_used_gib?: number | null;
    disk_total_gib?: number | null;
    gpu_memory_used_gib?: number | null;
    gpu_memory_total_gib?: number | null;
    gpu_util_percent?: number | null;
    updated_at?: string | null;
}

declare interface IResourcePoolUsageSummary extends IResourcePoolUsage {
    instance_count?: number | null;
    reporting_instance_count?: number | null;
}

declare interface IResourcePoolOccupancy {
    status: 'idle' | 'busy';
    project_names: string[];
    task_count: number;
}

declare interface IResourcePoolInstance {
    id: string;
    name: string;
    instance_num: number;
    status: TInstanceStatus;
    backend?: TBackendType | string | null;
    authorized_projects: string[];
    occupancy: IResourcePoolOccupancy;
    resources: IResourcePoolResources;
    usage?: IResourcePoolUsage | null;
}

declare interface IResourcePoolAssignment {
    project_name: IProject['project_name'];
    whole_pool: boolean;
    instance_ids: string[];
}

declare interface IResourcePool {
    id: string;
    name: string;
    spec: IFleetSpec;
    created_at: string;
    status: IFleet['status'];
    status_message?: string | null;
    assignments: IResourcePoolAssignment[];
    instances: IResourcePoolInstance[];
    authorized_project_names: string[];
    idle_instance_count: number;
    busy_instance_count: number;
    resource_summary: IResourcePoolResourceSummary;
    usage_summary?: IResourcePoolUsageSummary | null;
}

declare type TResourcePoolListParams = TBaseRequestListParams & {
    only_active?: boolean;
};

declare type TResourcePoolGetParams = {
    name?: string;
    id?: string;
};

declare type TResourcePoolApplyParams = {
    plan: IApplyFleetPlanRequestRequest['plan'];
    force: boolean;
};

declare type TResourcePoolUpdateParams = Partial<TResourcePoolApplyParams> & {
    resource_pool_name?: IResourcePool['name'];
    new_resource_pool_name?: IResourcePool['name'];
};

declare type TResourcePoolDeleteParams = {
    names: string[];
};

declare type TResourcePoolAssignmentUpdateParams = {
    resource_pool_name: IResourcePool['name'];
    project_name: IProject['project_name'];
    assign_whole_pool: boolean;
    instance_ids: string[];
};
