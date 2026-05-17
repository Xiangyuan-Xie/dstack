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

declare type TResourcePoolDeleteParams = {
    names: string[];
};

declare type TResourcePoolAssignmentUpdateParams = {
    resource_pool_name: IResourcePool['name'];
    project_name: IProject['project_name'];
    assign_whole_pool: boolean;
    instance_ids: string[];
};
