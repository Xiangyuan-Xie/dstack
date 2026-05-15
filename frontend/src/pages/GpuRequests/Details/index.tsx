import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';

import {
    Box,
    Button,
    Code,
    ColumnLayout,
    Container,
    ContentLayout,
    DetailsHeader,
    Header,
    NavigateLink,
    SpaceBetween,
} from 'components';

import { DATE_TIME_FORMAT } from 'consts';
import { useAppSelector, useBreadcrumbs, useNotifications } from 'hooks';
import { getServerError } from 'libs';
import { ROUTES } from 'routes';
import {
    useApproveGpuRequestMutation,
    useGetGpuRequestQuery,
    useRejectGpuRequestMutation,
    useRetryGpuRequestMutation,
} from 'services/gpuRequest';
import { useGetProjectQuery } from 'services/project';

import { selectUserData } from 'App/slice';

import {
    canReviewGpuRequests,
    formatGpuRequestCommands,
    formatGpuRequestEnv,
    formatGpuRequestResources,
    renderGpuRequestStatus,
} from '../utils';

import styles from './styles.module.scss';

export const GpuRequestDetails: React.FC = () => {
    const { t } = useTranslation();
    const params = useParams();
    const navigate = useNavigate();
    const [pushNotification] = useNotifications();
    const userData = useAppSelector(selectUserData);
    const projectName = params.projectName ?? '';
    const requestId = params.requestId ?? '';

    const { data, isLoading } = useGetGpuRequestQuery(
        {
            project_name: projectName,
            id: requestId,
        },
        {
            skip: !projectName || !requestId,
        },
    );
    const { data: project } = useGetProjectQuery(
        {
            name: projectName,
        },
        {
            skip: !projectName,
        },
    );

    const [approveRequest, { isLoading: isApproving }] = useApproveGpuRequestMutation();
    const [rejectRequest, { isLoading: isRejecting }] = useRejectGpuRequestMutation();
    const [retryRequest, { isLoading: isRetrying }] = useRetryGpuRequestMutation();

    useBreadcrumbs([
        {
            text: t('gpu_requests.title'),
            href: ROUTES.GPU_REQUESTS.LIST,
        },
        {
            text: data?.request.name || requestId,
            href: ROUTES.GPU_REQUESTS.DETAILS.FORMAT(projectName, requestId),
        },
    ]);

    const handleMutationError = (error: unknown) => {
        pushNotification({
            type: 'error',
            content: t('common.server_error', { error: getServerError(error) }),
        });
    };

    const approve = () => {
        if (!data) return;

        approveRequest({ project_name: data.project_name, id: data.id })
            .unwrap()
            .then((request) => {
                pushNotification({
                    type: request.status === 'approved' ? 'success' : 'warning',
                    content:
                        request.status === 'approved' ? t('gpu_requests.approve_success') : t('gpu_requests.approve_failed'),
                });
            })
            .catch(handleMutationError);
    };

    const reject = () => {
        if (!data) return;

        const reason = window.prompt(t('gpu_requests.reject_reason'));
        if (!reason?.trim()) return;

        rejectRequest({
            project_name: data.project_name,
            id: data.id,
            reason: reason.trim(),
        })
            .unwrap()
            .then(() => {
                pushNotification({
                    type: 'success',
                    content: t('gpu_requests.reject_success'),
                });
            })
            .catch(handleMutationError);
    };

    const retry = () => {
        if (!data) return;

        retryRequest({ project_name: data.project_name, id: data.id })
            .unwrap()
            .then((request) => {
                pushNotification({
                    type: request.status === 'approved' ? 'success' : 'warning',
                    content: request.status === 'approved' ? t('gpu_requests.retry_success') : t('gpu_requests.approve_failed'),
                });
            })
            .catch(handleMutationError);
    };

    const actionLoading = isApproving || isRejecting || isRetrying;
    const canReview = canReviewGpuRequests(project, userData);

    const backToList = () => {
        navigate(ROUTES.GPU_REQUESTS.LIST);
    };

    return (
        <div className={styles.page}>
            <ContentLayout
                header={
                    <DetailsHeader
                        title={data?.request.name || t('gpu_requests.details_title')}
                        actionButtons={
                            <>
                                <Button onClick={backToList}>{t('gpu_requests.back_to_list')}</Button>

                                <Button
                                    onClick={approve}
                                    loading={isApproving}
                                    disabled={!canReview || !data || data.status !== 'pending' || actionLoading}
                                >
                                    {t('gpu_requests.approve')}
                                </Button>

                                <Button
                                    onClick={reject}
                                    loading={isRejecting}
                                    disabled={!canReview || !data || data.status !== 'pending' || actionLoading}
                                >
                                    {t('gpu_requests.reject')}
                                </Button>

                                <Button
                                    onClick={retry}
                                    loading={isRetrying}
                                    disabled={!canReview || !data || data.status !== 'failed' || actionLoading}
                                >
                                    {t('gpu_requests.retry')}
                                </Button>
                            </>
                        }
                    />
                }
            >
                {isLoading && <Container>{t('common.loading')}</Container>}

                {data && (
                    <SpaceBetween size="l">
                        <Container header={<Header variant="h2">{t('common.general')}</Header>}>
                            <ColumnLayout columns={4} variant="text-grid">
                                <div>
                                    <Box variant="awsui-key-label">{t('gpu_requests.status')}</Box>
                                    <div>{renderGpuRequestStatus(data.status)}</div>
                                </div>

                                <div>
                                    <Box variant="awsui-key-label">{t('gpu_requests.project')}</Box>
                                    <div>
                                        <NavigateLink href={ROUTES.PROJECT.DETAILS.FORMAT(data.project_name)}>
                                            {data.project_name}
                                        </NavigateLink>
                                    </div>
                                </div>

                                <div>
                                    <Box variant="awsui-key-label">{t('gpu_requests.applicant')}</Box>
                                    <div>
                                        <NavigateLink href={ROUTES.USER.DETAILS.FORMAT(data.applicant)}>
                                            {data.applicant}
                                        </NavigateLink>
                                    </div>
                                </div>

                                <div>
                                    <Box variant="awsui-key-label">{t('gpu_requests.created')}</Box>
                                    <div>{format(new Date(data.created_at), DATE_TIME_FORMAT)}</div>
                                </div>

                                <div>
                                    <Box variant="awsui-key-label">{t('gpu_requests.reviewed_by')}</Box>
                                    <div>{data.reviewed_by || '-'}</div>
                                </div>

                                <div>
                                    <Box variant="awsui-key-label">{t('gpu_requests.reviewed_at')}</Box>
                                    <div>{data.reviewed_at ? format(new Date(data.reviewed_at), DATE_TIME_FORMAT) : '-'}</div>
                                </div>

                                <div>
                                    <Box variant="awsui-key-label">{t('gpu_requests.run')}</Box>
                                    <div>
                                        {data.run_id ? (
                                            <NavigateLink
                                                href={ROUTES.PROJECT.DETAILS.RUNS.DETAILS.FORMAT(
                                                    data.project_name,
                                                    data.run_id,
                                                )}
                                            >
                                                {data.run_name || data.run_id}
                                            </NavigateLink>
                                        ) : (
                                            '-'
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <Box variant="awsui-key-label">{t('gpu_requests.message')}</Box>
                                    <div>{data.review_message || '-'}</div>
                                </div>
                            </ColumnLayout>
                        </Container>

                        <Container header={<Header variant="h2">{t('gpu_requests.container')}</Header>}>
                            <ColumnLayout columns={3} variant="text-grid">
                                <div>
                                    <Box variant="awsui-key-label">{t('gpu_requests.name')}</Box>
                                    <div>{data.request.name || '-'}</div>
                                </div>

                                <div>
                                    <Box variant="awsui-key-label">{t('gpu_requests.image')}</Box>
                                    <div>{data.request.image}</div>
                                </div>

                                <div>
                                    <Box variant="awsui-key-label">{t('gpu_requests.resources')}</Box>
                                    <div>{formatGpuRequestResources(data.request)}</div>
                                </div>

                                <div>
                                    <Box variant="awsui-key-label">{t('gpu_requests.nodes')}</Box>
                                    <div>{data.request.nodes ?? 1}</div>
                                </div>

                                <div>
                                    <Box variant="awsui-key-label">{t('gpu_requests.ports')}</Box>
                                    <div>{data.request.ports?.join(', ') || '-'}</div>
                                </div>

                                <div>
                                    <Box variant="awsui-key-label">{t('gpu_requests.max_duration')}</Box>
                                    <div>{data.request.max_duration || '-'}</div>
                                </div>

                                <div>
                                    <Box variant="awsui-key-label">{t('gpu_requests.fleets')}</Box>
                                    <div>{data.request.fleets?.join(', ') || '-'}</div>
                                </div>
                            </ColumnLayout>
                        </Container>

                        <Container header={<Header variant="h2">{t('gpu_requests.commands')}</Header>}>
                            <Code>{formatGpuRequestCommands(data.request.commands)}</Code>
                        </Container>

                        <Container header={<Header variant="h2">{t('gpu_requests.env')}</Header>}>
                            <Code>{formatGpuRequestEnv(data.request.env)}</Code>
                        </Container>
                    </SpaceBetween>
                )}
            </ContentLayout>
        </div>
    );
};
