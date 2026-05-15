import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { Button, ColumnLayout, Container, FormInput, FormSelect, FormTextarea, FormUI, Header, SpaceBetween } from 'components';

import { useBreadcrumbs, useNotifications } from 'hooks';
import { useProjectFilter } from 'hooks/useProjectFilter';
import { getServerError } from 'libs';
import { ROUTES } from 'routes';
import { useCreateGpuRequestMutation } from 'services/gpuRequest';

type FormValues = {
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
};

const splitLines = (value: string) =>
    value
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

const splitComma = (value: string) =>
    value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

const parseEnv = (value: string): Record<string, string> | undefined => {
    const env = splitLines(value).reduce<Record<string, string>>((result, line) => {
        const separatorIndex = line.indexOf('=');
        if (separatorIndex < 0) {
            result[line] = '';
        } else {
            result[line.slice(0, separatorIndex).trim()] = line.slice(separatorIndex + 1);
        }
        return result;
    }, {});

    return Object.keys(env).length ? env : undefined;
};

const parsePorts = (value: string): number[] | undefined => {
    const ports = splitComma(value)
        .map((port) => Number(port))
        .filter((port) => Number.isInteger(port) && port > 0);
    return ports.length ? ports : undefined;
};

export const GpuRequestCreate: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [pushNotification] = useNotifications();
    const { projectOptions, isLoadingProjectOptions } = useProjectFilter({ localStorePrefix: 'gpu-requests-create' });
    const [createGpuRequest, { isLoading }] = useCreateGpuRequestMutation();

    useBreadcrumbs([
        {
            text: t('gpu_requests.title'),
            href: ROUTES.GPU_REQUESTS.LIST,
        },
        {
            text: t('gpu_requests.create_title'),
            href: ROUTES.GPU_REQUESTS.CREATE,
        },
    ]);

    const { control, handleSubmit, setValue } = useForm<FormValues>({
        defaultValues: {
            project_name: searchParams.get('project_name') ?? '',
            image: '',
            commands: '',
            env: '',
            ports: '',
            nodes: '1',
            cpu: '',
            memory: '',
            gpu: '',
            disk: '',
            max_duration: '',
            fleets: '',
        },
    });

    useEffect(() => {
        if (!searchParams.get('project_name') && projectOptions[0]?.value) {
            setValue('project_name', projectOptions[0].value);
        }
    }, [projectOptions, searchParams, setValue]);

    const onCancel = () => {
        navigate(ROUTES.GPU_REQUESTS.LIST);
    };

    const onSubmit = (values: FormValues) => {
        const resources: TGpuRequestResources = {};
        if (values.cpu.trim()) resources.cpu = values.cpu.trim();
        if (values.memory.trim()) resources.memory = values.memory.trim();
        if (values.gpu.trim()) resources.gpu = values.gpu.trim();
        if (values.disk.trim()) resources.disk = values.disk.trim();

        const request: IGpuRequestSpec = {
            image: values.image.trim(),
            commands: splitLines(values.commands),
            name: values.name.trim() || undefined,
            env: parseEnv(values.env),
            ports: parsePorts(values.ports),
            nodes: Number(values.nodes) || 1,
            resources: Object.keys(resources).length ? resources : undefined,
            max_duration: values.max_duration.trim() || undefined,
            fleets: splitComma(values.fleets).length ? splitComma(values.fleets) : undefined,
        };

        createGpuRequest({
            project_name: values.project_name,
            request,
        })
            .unwrap()
            .then((createdRequest) => {
                pushNotification({
                    type: 'success',
                    content: t('gpu_requests.create_success'),
                });
                navigate(ROUTES.GPU_REQUESTS.DETAILS.FORMAT(createdRequest.project_name, createdRequest.id));
            })
            .catch((error) => {
                pushNotification({
                    type: 'error',
                    content: t('common.server_error', { error: getServerError(error) }),
                });
            });
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)}>
            <FormUI
                actions={
                    <SpaceBetween direction="horizontal" size="xs">
                        <Button formAction="none" variant="link" disabled={isLoading} onClick={onCancel}>
                            {t('common.cancel')}
                        </Button>

                        <Button variant="primary" loading={isLoading} disabled={isLoading}>
                            {t('gpu_requests.submit_request')}
                        </Button>
                    </SpaceBetween>
                }
            >
                <SpaceBetween size="l">
                    <Container header={<Header variant="h2">{t('gpu_requests.create_title')}</Header>}>
                        <SpaceBetween size="l">
                            <ColumnLayout columns={2}>
                                <FormSelect
                                    label={t('gpu_requests.project')}
                                    control={control}
                                    name="project_name"
                                    options={projectOptions}
                                    disabled={isLoading}
                                    empty={t('runs.launch.wizard.project_empty')}
                                    loadingText={t('runs.launch.wizard.project_loading')}
                                    statusType={isLoadingProjectOptions ? 'loading' : undefined}
                                    rules={{ required: t('validation.required') }}
                                />

                                <FormInput
                                    label={t('gpu_requests.name')}
                                    control={control}
                                    name="name"
                                    disabled={isLoading}
                                    placeholder="train-job"
                                />

                                <FormInput
                                    label={t('gpu_requests.image')}
                                    control={control}
                                    name="image"
                                    disabled={isLoading}
                                    placeholder="ubuntu:22.04"
                                    rules={{ required: t('validation.required') }}
                                />

                                <FormInput
                                    label={t('gpu_requests.nodes')}
                                    control={control}
                                    name="nodes"
                                    type="number"
                                    disabled={isLoading}
                                    rules={{ required: t('validation.required'), min: 1 }}
                                />
                            </ColumnLayout>

                            <FormTextarea
                                label={t('gpu_requests.commands')}
                                control={control}
                                name="commands"
                                rows={5}
                                disabled={isLoading}
                                placeholder="python train.py"
                                rules={{ required: t('validation.required') }}
                            />

                            <FormTextarea
                                label={t('gpu_requests.env')}
                                control={control}
                                name="env"
                                rows={4}
                                disabled={isLoading}
                                placeholder="MODEL=qwen"
                            />
                        </SpaceBetween>
                    </Container>

                    <Container header={<Header variant="h2">{t('gpu_requests.resources')}</Header>}>
                        <SpaceBetween size="l">
                            <ColumnLayout columns={3}>
                                <FormInput label={t('gpu_requests.cpu')} control={control} name="cpu" disabled={isLoading} />
                                <FormInput
                                    label={t('gpu_requests.memory')}
                                    control={control}
                                    name="memory"
                                    disabled={isLoading}
                                />
                                <FormInput label={t('gpu_requests.gpu')} control={control} name="gpu" disabled={isLoading} />
                                <FormInput label={t('gpu_requests.disk')} control={control} name="disk" disabled={isLoading} />
                                <FormInput
                                    label={t('gpu_requests.max_duration')}
                                    control={control}
                                    name="max_duration"
                                    disabled={isLoading}
                                    placeholder="2h"
                                />
                                <FormInput
                                    label={t('gpu_requests.ports')}
                                    control={control}
                                    name="ports"
                                    disabled={isLoading}
                                    placeholder="8888,6006"
                                />
                            </ColumnLayout>

                            <FormInput label={t('gpu_requests.fleets')} control={control} name="fleets" disabled={isLoading} />
                        </SpaceBetween>
                    </Container>
                </SpaceBetween>
            </FormUI>
        </form>
    );
};
