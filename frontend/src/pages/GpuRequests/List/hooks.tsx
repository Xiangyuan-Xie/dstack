import React from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';

import { NavigateLink, TableProps } from 'components';

import { DATE_TIME_FORMAT } from 'consts';
import { ROUTES } from 'routes';

import { formatGpuRequestResources, renderGpuRequestStatus } from '../utils';

export const useColumnsDefinitions = () => {
    const { t } = useTranslation();

    const columns: TableProps.ColumnDefinition<IGpuRequest>[] = [
        {
            id: 'name',
            header: t('gpu_requests.name'),
            cell: (item) => (
                <NavigateLink href={ROUTES.GPU_REQUESTS.DETAILS.FORMAT(item.project_name, item.id)}>
                    {item.request.name || item.id}
                </NavigateLink>
            ),
        },
        {
            id: 'status',
            header: t('gpu_requests.status'),
            cell: (item) => renderGpuRequestStatus(item.status),
        },
        {
            id: 'project',
            header: t('gpu_requests.project'),
            cell: (item) => (
                <NavigateLink href={ROUTES.PROJECT.DETAILS.FORMAT(item.project_name)}>{item.project_name}</NavigateLink>
            ),
        },
        {
            id: 'applicant',
            header: t('gpu_requests.applicant'),
            cell: (item) => <NavigateLink href={ROUTES.USER.DETAILS.FORMAT(item.applicant)}>{item.applicant}</NavigateLink>,
        },
        {
            id: 'image',
            header: t('gpu_requests.image'),
            cell: (item) => item.request.image,
        },
        {
            id: 'resources',
            header: t('gpu_requests.resources'),
            cell: (item) => formatGpuRequestResources(item.request),
        },
        {
            id: 'created',
            header: t('gpu_requests.created'),
            cell: (item) => format(new Date(item.created_at), DATE_TIME_FORMAT),
        },
        {
            id: 'run',
            header: t('gpu_requests.run'),
            cell: (item) =>
                item.run_id ? (
                    <NavigateLink href={ROUTES.PROJECT.DETAILS.RUNS.DETAILS.FORMAT(item.project_name, item.run_id)}>
                        {item.run_name || item.run_id}
                    </NavigateLink>
                ) : (
                    '-'
                ),
        },
        {
            id: 'message',
            header: t('gpu_requests.message'),
            cell: (item) => item.review_message || '-',
        },
    ];

    return { columns } as const;
};
