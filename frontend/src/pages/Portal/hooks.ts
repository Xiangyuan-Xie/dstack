import { useGetAllGpuRequestsQuery } from 'services/gpuRequest';
import { useGetRunsQuery } from 'services/run';

export const usePortalGpuRequests = (includeAll = false) => {
    return useGetAllGpuRequestsQuery({
        include_all: includeAll,
    });
};

export const usePortalRuns = () => {
    return useGetRunsQuery({
        only_active: true,
        job_submissions_limit: 1,
    });
};
