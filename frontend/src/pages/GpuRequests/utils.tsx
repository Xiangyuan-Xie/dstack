import React from 'react';
import { StatusIndicatorProps } from '@cloudscape-design/components';

import { StatusIndicator } from 'components';

import { GlobalUserRole, ProjectUserRole } from 'types';

const statusTypeMap: Record<TGpuRequestStatus, StatusIndicatorProps['type']> = {
    pending: 'pending',
    approved: 'success',
    rejected: 'error',
    failed: 'error',
};

export const renderGpuRequestStatus = (status: TGpuRequestStatus) => {
    return <StatusIndicator type={statusTypeMap[status]}>{status}</StatusIndicator>;
};

export const formatGpuRequestResources = (request: IGpuRequestSpec): string => {
    const resources = request.resources ?? {};
    const parts: string[] = [];

    if (request.nodes && request.nodes > 1) {
        parts.push(`nodes=${request.nodes}`);
    }

    if (resources.cpu) {
        parts.push(`cpu=${resources.cpu}`);
    }

    if (resources.memory) {
        parts.push(`mem=${resources.memory}`);
    }

    if (resources.disk) {
        const disk = typeof resources.disk === 'object' && 'size' in resources.disk ? resources.disk.size : resources.disk;
        parts.push(`disk=${disk}`);
    }

    if (resources.gpu) {
        parts.push(`gpu=${typeof resources.gpu === 'object' ? JSON.stringify(resources.gpu) : resources.gpu}`);
    }

    return parts.join(' ') || '-';
};

export const formatGpuRequestCommands = (commands: string[]) => {
    return commands.join('\n');
};

export const formatGpuRequestEnv = (env?: Record<string, string>) => {
    if (!env || !Object.keys(env).length) {
        return '-';
    }
    return Object.entries(env)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
};

export const canReviewGpuRequests = (project?: IProject, user?: IUser | null): boolean => {
    if (user?.global_role === GlobalUserRole.ADMIN) {
        return true;
    }
    if (!project || !user?.username) {
        return false;
    }
    const projectRole = project.members.find((member) => member.user.username === user.username)?.project_role;
    return projectRole === ProjectUserRole.ADMIN || projectRole === ProjectUserRole.MANAGER;
};
