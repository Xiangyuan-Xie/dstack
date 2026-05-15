declare type TGpuRequestStatus = 'pending' | 'approved' | 'rejected' | 'failed';

declare type TGpuRequestResources = Partial<Pick<IResourcesSpecRequest, 'cpu' | 'memory' | 'gpu' | 'disk' | 'shm_size'>>;

declare interface IGpuRequestSpec {
    name?: string | null;
    image: string;
    commands: string[];
    env?: Record<string, string>;
    ports?: number[];
    nodes?: number;
    resources?: TGpuRequestResources;
    max_duration?: string | null;
    fleets?: string[] | null;
}

declare interface IGpuRequest {
    id: string;
    project_name: string;
    applicant: string;
    status: TGpuRequestStatus;
    request: IGpuRequestSpec;
    created_at: string;
    reviewed_by?: string | null;
    reviewed_at?: string | null;
    review_message?: string | null;
    run_id?: string | null;
    run_name?: string | null;
}

declare type TGpuRequestListParams = TBaseRequestListParams & {
    project_name: IProject['project_name'];
    status?: TGpuRequestStatus;
    include_all?: boolean;
};

declare type TGpuRequestGlobalListParams = TBaseRequestListParams & {
    status?: TGpuRequestStatus;
    include_all?: boolean;
};

declare type TGpuRequestCreateParams = {
    project_name: IProject['project_name'];
    request: IGpuRequestSpec;
};

declare type TGpuRequestReviewParams = {
    project_name: IProject['project_name'];
    id: IGpuRequest['id'];
};

declare type TGpuRequestRejectParams = TGpuRequestReviewParams & {
    reason: string;
};
