import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Button, Header, ListEmptyMessage, SelectCSD, SpaceBetween, Table } from 'components';

import { useAppSelector, useBreadcrumbs, useCollection, useNotifications } from 'hooks';
import { useProjectFilter } from 'hooks/useProjectFilter';
import { getServerError } from 'libs';
import { ROUTES } from 'routes';
import {
    useApproveGpuRequestMutation,
    useGetGpuRequestsQuery,
    useRejectGpuRequestMutation,
    useRetryGpuRequestMutation,
} from 'services/gpuRequest';
import { useGetProjectQuery } from 'services/project';

import { selectUserData } from 'App/slice';

import { canReviewGpuRequests } from '../utils';
import { useColumnsDefinitions } from './hooks';

export const GpuRequestsList: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [pushNotification] = useNotifications();
    const userData = useAppSelector(selectUserData);
    const { projectOptions, selectedProject, setSelectedProject, isLoadingProjectOptions } = useProjectFilter({
        localStorePrefix: 'gpu-requests-list',
    });
    const selectedProjectName = selectedProject?.value ?? '';

    useBreadcrumbs([
        {
            text: t('gpu_requests.title'),
            href: ROUTES.GPU_REQUESTS.LIST,
        },
    ]);

    useEffect(() => {
        if (!selectedProject && projectOptions[0]) {
            setSelectedProject(projectOptions[0]);
        }
    }, [projectOptions, selectedProject]);

    const {
        data = [],
        isLoading,
        refetch,
    } = useGetGpuRequestsQuery(
        {
            project_name: selectedProjectName,
        },
        {
            skip: !selectedProjectName,
        },
    );
    const { data: project } = useGetProjectQuery(
        {
            name: selectedProjectName,
        },
        {
            skip: !selectedProjectName,
        },
    );

    const [approveRequest, { isLoading: isApproving }] = useApproveGpuRequestMutation();
    const [rejectRequest, { isLoading: isRejecting }] = useRejectGpuRequestMutation();
    const [retryRequest, { isLoading: isRetrying }] = useRetryGpuRequestMutation();

    const { columns } = useColumnsDefinitions();

    const { items, actions, collectionProps } = useCollection<IGpuRequest>(data, {
        filtering: {
            empty: (
                <ListEmptyMessage
                    title={selectedProject ? t('gpu_requests.empty_title') : t('gpu_requests.select_project')}
                    message={selectedProject ? t('gpu_requests.empty_message') : ''}
                />
            ),
        },
        selection: {},
    });

    const selectedRequest = collectionProps.selectedItems?.[0];
    const actionLoading = isApproving || isRejecting || isRetrying;
    const canReview = canReviewGpuRequests(project, userData);
    const canApprove = canReview && selectedRequest?.status === 'pending';
    const canReject = canReview && selectedRequest?.status === 'pending';
    const canRetry = canReview && selectedRequest?.status === 'failed';

    const handleMutationError = (error: unknown) => {
        pushNotification({
            type: 'error',
            content: t('common.server_error', { error: getServerError(error) }),
        });
    };

    const clearSelection = () => actions.setSelectedItems([]);

    const approveSelected = () => {
        if (!selectedRequest) return;

        approveRequest({ project_name: selectedRequest.project_name, id: selectedRequest.id })
            .unwrap()
            .then((request) => {
                clearSelection();
                pushNotification({
                    type: request.status === 'approved' ? 'success' : 'warning',
                    content:
                        request.status === 'approved' ? t('gpu_requests.approve_success') : t('gpu_requests.approve_failed'),
                });
            })
            .catch(handleMutationError);
    };

    const rejectSelected = () => {
        if (!selectedRequest) return;

        const reason = window.prompt(t('gpu_requests.reject_reason'));
        if (!reason?.trim()) return;

        rejectRequest({
            project_name: selectedRequest.project_name,
            id: selectedRequest.id,
            reason: reason.trim(),
        })
            .unwrap()
            .then(() => {
                clearSelection();
                pushNotification({
                    type: 'success',
                    content: t('gpu_requests.reject_success'),
                });
            })
            .catch(handleMutationError);
    };

    const retrySelected = () => {
        if (!selectedRequest) return;

        retryRequest({ project_name: selectedRequest.project_name, id: selectedRequest.id })
            .unwrap()
            .then((request) => {
                clearSelection();
                pushNotification({
                    type: request.status === 'approved' ? 'success' : 'warning',
                    content: request.status === 'approved' ? t('gpu_requests.retry_success') : t('gpu_requests.approve_failed'),
                });
            })
            .catch(handleMutationError);
    };

    const openCreate = () => {
        navigate(`${ROUTES.GPU_REQUESTS.CREATE}${selectedProject?.value ? `?project_name=${selectedProject.value}` : ''}`);
    };

    return (
        <Table
            {...collectionProps}
            variant="full-page"
            columnDefinitions={columns}
            items={items}
            loading={isLoading || isLoadingProjectOptions}
            loadingText={t('common.loading')}
            selectionType="single"
            stickyHeader={true}
            header={
                <Header
                    variant="awsui-h1-sticky"
                    actions={
                        <SpaceBetween size="xs" direction="horizontal">
                            <Button onClick={openCreate}>{t('common.create')}</Button>

                            <Button formAction="none" onClick={approveSelected} disabled={!canApprove || actionLoading}>
                                {t('gpu_requests.approve')}
                            </Button>

                            <Button formAction="none" onClick={rejectSelected} disabled={!canReject || actionLoading}>
                                {t('gpu_requests.reject')}
                            </Button>

                            <Button formAction="none" onClick={retrySelected} disabled={!canRetry || actionLoading}>
                                {t('gpu_requests.retry')}
                            </Button>

                            <Button iconName="refresh" disabled={isLoading} ariaLabel={t('common.refresh')} onClick={refetch} />
                        </SpaceBetween>
                    }
                >
                    {t('gpu_requests.title')}
                </Header>
            }
            filter={
                <SelectCSD
                    selectedOption={selectedProject}
                    options={projectOptions}
                    onChange={({ detail }) => setSelectedProject(detail.selectedOption)}
                    empty={t('runs.launch.wizard.project_empty')}
                    loadingText={t('runs.launch.wizard.project_loading')}
                    statusType={isLoadingProjectOptions ? 'loading' : undefined}
                    placeholder={t('gpu_requests.select_project')}
                />
            }
        />
    );
};
