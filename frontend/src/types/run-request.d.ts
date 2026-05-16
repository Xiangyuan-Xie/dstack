declare type TRunRequestStatus = 'pending' | 'approved' | 'rejected' | 'failed';

declare type TRunRequestResources = Partial<Pick<IResourcesSpecRequest, 'cpu' | 'memory' | 'gpu' | 'disk' | 'shm_size'>>;

declare interface IRunRequestSpec {
    name?: string | null;
    image: string;
    commands: string[];
    env?: Record<string, string>;
    ports?: number[];
    nodes?: number;
    resources?: TRunRequestResources;
    max_duration?: string | null;
    fleets?: string[] | null;
}

declare interface IRunRequest {
    id: string;
    project_name: string;
    applicant: string;
    status: TRunRequestStatus;
    request: IRunRequestSpec;
    created_at: string;
    reviewed_by?: string | null;
    reviewed_at?: string | null;
    review_message?: string | null;
    run_id?: string | null;
    run_name?: string | null;
}

declare type TRunRequestListParams = TBaseRequestListParams & {
    project_name: IProject['project_name'];
    status?: TRunRequestStatus;
    include_all?: boolean;
};

declare type TRunRequestGlobalListParams = TBaseRequestListParams & {
    status?: TRunRequestStatus;
    include_all?: boolean;
};

declare type TRunRequestCreateParams = {
    project_name: IProject['project_name'];
    request: IRunRequestSpec;
};

declare type TRunRequestReviewParams = {
    project_name: IProject['project_name'];
    id: IRunRequest['id'];
};

declare type TRunRequestRejectParams = TRunRequestReviewParams & {
    reason: string;
};
