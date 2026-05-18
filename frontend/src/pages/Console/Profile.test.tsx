import React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AccountKeysPage, AccountProfilePage, UserDetailsPage } from './pages';

const mockPushNotification = jest.fn();
const mockRefreshToken = jest.fn();
const mockUpdateMyUser = jest.fn();
const mockUpdateUser = jest.fn();
const mockDeleteUsers = jest.fn();
const mockDeleteKeys = jest.fn();
const mockConfirm = jest.fn();
const mockNavigate = jest.fn();

Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
    })),
});

jest.mock('hooks', () => ({
    useAppSelector: () => ({
        id: 'user-1',
        username: 'alice',
        global_role: 'user',
        email: 'alice@example.com',
        created_at: '2026-05-16T10:00:00+08:00',
        active: true,
    }),
    useNotifications: () => [mockPushNotification],
    useConfirmationDialog: () => [mockConfirm],
}));

jest.mock('react-router-dom', () => ({
    useNavigate: () => mockNavigate,
    useParams: () => ({ userName: 'bob' }),
}));

jest.mock('./Layout', () => ({
    useConsoleContext: () => ({
        locale: 'zh',
        user: {
            id: 'user-1',
            username: 'alice',
            global_role: 'user',
            email: 'alice@example.com',
            created_at: '2026-05-16T10:00:00+08:00',
            active: true,
        },
        role: {
            isGlobalAdmin: false,
            canUseProjectAdmin: true,
            canUseGlobalAdmin: false,
            canManagePortal: true,
            manageableProjectNames: ['main'],
        },
        projects: [
            {
                project_id: 'project-1',
                project_name: 'main',
                current_user_project_role: 'manager',
                members: [],
                backends: [],
                owner: { username: 'admin' },
                created_at: '2026-05-16T09:00:00+08:00',
                isPublic: false,
            },
            {
                project_id: 'project-2',
                project_name: 'research',
                current_user_project_role: 'admin',
                members: [],
                backends: [],
                owner: { username: 'bob' },
                created_at: '2026-05-16T09:00:00+08:00',
                isPublic: false,
            },
        ],
    }),
}));

jest.mock('services/user', () => ({
    useGetUserQuery: () => ({
        data: {
            id: 'user-2',
            username: 'bob',
            global_role: 'user',
            email: 'bob@example.com',
            created_at: '2026-05-15T10:00:00+08:00',
            active: true,
        },
        isLoading: false,
    }),
    useGetUserBillingInfoQuery: () => ({ data: null }),
    useRefreshTokenMutation: () => [mockRefreshToken, { isLoading: false }],
    useUpdateMyUserMutation: () => [mockUpdateMyUser, { isLoading: false }],
    useUpdateUserMutation: () => [mockUpdateUser, { isLoading: false }],
    useDeleteUsersMutation: () => [mockDeleteUsers, { isLoading: false }],
}));

jest.mock('App/slice', () => ({
    selectUserData: jest.fn(),
    setUserData: jest.fn((payload) => ({ type: 'app/setUserData', payload })),
}));

jest.mock('services/backend', () => ({}));
jest.mock('services/events', () => ({}));
jest.mock('services/fleet', () => ({}));
jest.mock('services/gpu', () => ({}));
jest.mock('services/runRequest', () => ({}));
jest.mock('services/instance', () => ({}));
jest.mock('services/project', () => ({
    useGetProjectsQuery: () => ({
        data: {
            data: [
                {
                    project_id: 'project-1',
                    project_name: 'main',
                    members: [
                        {
                            project_role: 'manager',
                            user: { username: 'bob' },
                        },
                    ],
                    backends: [],
                    owner: { username: 'admin' },
                    created_at: '2026-05-16T09:00:00+08:00',
                    isPublic: false,
                },
                {
                    project_id: 'project-2',
                    project_name: 'research',
                    members: [],
                    backends: [],
                    owner: { username: 'admin' },
                    created_at: '2026-05-16T09:00:00+08:00',
                    isPublic: false,
                },
            ],
        },
        isLoading: false,
    }),
}));
jest.mock('services/publicKeys', () => ({
    useListPublicKeysQuery: () => ({
        data: [
            {
                id: 'key-1',
                name: 'laptop',
                fingerprint: 'SHA256:abc',
                type: 'ssh',
                added_at: '2026-05-16T09:00:00+08:00',
            },
        ],
        isLoading: false,
    }),
    useAddPublicKeyMutation: () => [jest.fn(), { isLoading: false }],
    useDeletePublicKeysMutation: () => [mockDeleteKeys, { isLoading: false }],
}));
jest.mock('services/run', () => ({}));
jest.mock('services/secrets', () => ({}));
jest.mock('services/volume', () => ({}));
jest.mock('services/adminOAuth', () => ({}));
jest.mock('libs', () => ({
    centsToFormattedString: jest.fn(),
    copyToClipboard: jest.fn(),
}));
jest.mock('libs/fleet', () => ({
    formatFleetBackend: jest.fn(),
    getFleetPrice: jest.fn(),
}));
jest.mock('libs/resources', () => ({
    formatResources: jest.fn(() => '-'),
}));
jest.mock('libs/runStatus', () => ({
    runStatusForDeleting: [],
    runStatusForStopping: [],
}));

describe('AccountProfilePage', () => {
    beforeEach(() => {
        mockPushNotification.mockReset();
        mockRefreshToken.mockReset();
        mockUpdateMyUser.mockReset();
        mockUpdateUser.mockReset();
    });

    test('renders a minimal profile without internal account metadata', () => {
        render(<AccountProfilePage />);

        expect(screen.getAllByText('alice').length).toBeGreaterThan(0);
        expect(screen.getAllByText('项目管理员').length).toBeGreaterThan(0);
        expect(screen.getByText('alice@example.com')).toBeInTheDocument();
        expect(screen.queryByText('user-1')).not.toBeInTheDocument();
        expect(screen.queryByText('user')).not.toBeInTheDocument();
        expect(screen.queryByText('CAN_CREATE_PROJECTS')).not.toBeInTheDocument();
        expect(screen.queryByText('main')).not.toBeInTheDocument();
        expect(screen.queryByText('项目身份')).not.toBeInTheDocument();
        expect(screen.queryByText('权限概览')).not.toBeInTheDocument();
        expect(screen.queryByText(/"username"/)).not.toBeInTheDocument();
    });

    test('edits email inline in the basic information card', async () => {
        mockUpdateMyUser.mockReturnValue({
            unwrap: () => Promise.resolve({ email: 'new@example.com' }),
        });

        render(<AccountProfilePage />);
        expect(screen.queryByText('邮箱设置')).not.toBeInTheDocument();

        const editEmailButton = screen.getByRole('button', { name: '编辑邮箱' });
        expect(editEmailButton.textContent).toBe('');
        expect(screen.queryByText('编辑邮箱')).not.toBeInTheDocument();

        await userEvent.click(editEmailButton);
        const input = screen.getByPlaceholderText('name@example.com');
        await userEvent.clear(input);
        await userEvent.type(input, 'new@example.com');
        await userEvent.click(screen.getByRole('button', { name: '保存' }));

        expect(mockUpdateMyUser).toHaveBeenCalledWith({ email: 'new@example.com' });
        expect(mockPushNotification).toHaveBeenCalledWith({
            type: 'success',
            header: '邮箱已更新',
        });
    });
});

describe('UserDetailsPage', () => {
    beforeEach(() => {
        mockPushNotification.mockReset();
        mockRefreshToken.mockReset();
        mockUpdateMyUser.mockReset();
        mockUpdateUser.mockReset();
        mockDeleteUsers.mockReset();
        mockDeleteKeys.mockReset();
        mockConfirm.mockReset();
        mockNavigate.mockReset();
    });

    test('renders read-only admin fields instead of raw JSON', () => {
        render(<UserDetailsPage />);

        expect(screen.getByText('bob@example.com')).toBeInTheDocument();
        expect(screen.queryByDisplayValue('bob@example.com')).not.toBeInTheDocument();
        expect(screen.getByText('普通用户')).toBeInTheDocument();
        expect(screen.queryByRole('combobox', { name: '角色' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: '保存' })).not.toBeInTheDocument();
        expect(screen.getByText('user-2')).toBeInTheDocument();
        expect(screen.queryByText('项目创建配额')).not.toBeInTheDocument();
        expect(screen.queryByRole('checkbox', { name: '账号启用' })).not.toBeInTheDocument();
        expect(screen.queryByText('项目角色')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('main 项目角色')).not.toBeInTheDocument();
        expect(screen.queryByText(/"username"/)).not.toBeInTheDocument();
    });

    test('deactivates the user from the danger zone after confirmation', async () => {
        mockUpdateUser.mockReturnValue({
            unwrap: () => Promise.resolve({ username: 'bob', active: false }),
        });

        render(<UserDetailsPage />);
        expect(screen.queryByText('该账号当前已启用。')).not.toBeInTheDocument();
        expect(screen.queryByText('该账号当前已停用。')).not.toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', { name: '停用账号' }));

        expect(mockConfirm).toHaveBeenCalledWith(
            expect.objectContaining({
                title: '停用账号',
                confirmButtonLabel: '停用',
            }),
        );

        const onConfirm = mockConfirm.mock.calls[0][0].onConfirm;
        await act(async () => {
            await onConfirm();
        });

        expect(mockUpdateUser).toHaveBeenCalledWith({
            username: 'bob',
            email: 'bob@example.com',
            global_role: 'user',
            active: false,
        });
        expect(mockPushNotification).toHaveBeenCalledWith({
            type: 'success',
            header: '用户已停用',
        });
    });

    test('renders danger zone actions without an empty body and uses restrained danger styling', () => {
        render(<UserDetailsPage />);

        const dangerZone = screen.getByText('危险操作').closest('section');
        expect(dangerZone?.querySelector('.p-5')).not.toBeInTheDocument();

        expect(screen.getByRole('button', { name: '删除用户' })).toHaveClass('border-red-200', 'bg-red-50');
    });

    test('does not show billing information in the default private deployment UI', () => {
        render(<UserDetailsPage />);

        expect(screen.queryByText('账单')).not.toBeInTheDocument();
        expect(screen.queryByText('余额')).not.toBeInTheDocument();
    });

    test('deletes the user from the details page after confirmation', async () => {
        mockDeleteUsers.mockReturnValue({
            unwrap: () => Promise.resolve(undefined),
        });

        render(<UserDetailsPage />);
        await userEvent.click(screen.getByRole('button', { name: '删除用户' }));

        expect(mockConfirm).toHaveBeenCalledWith(
            expect.objectContaining({
                title: '删除用户',
                confirmButtonLabel: '删除',
            }),
        );

        const onConfirm = mockConfirm.mock.calls[0][0].onConfirm;
        await onConfirm();

        expect(mockDeleteUsers).toHaveBeenCalledWith(['bob']);
        expect(mockNavigate).toHaveBeenCalledWith('/admin/users');
        expect(mockPushNotification).toHaveBeenCalledWith({
            type: 'success',
            header: '用户已删除',
        });
    });
});

describe('AccountKeysPage', () => {
    beforeEach(() => {
        mockConfirm.mockReset();
        mockDeleteKeys.mockReset();
    });

    test('confirms before deleting an SSH public key', async () => {
        mockDeleteKeys.mockReturnValue({
            unwrap: () => Promise.resolve(undefined),
        });

        render(<AccountKeysPage />);
        await userEvent.click(screen.getByRole('button', { name: '删除' }));

        expect(mockDeleteKeys).not.toHaveBeenCalled();
        expect(mockConfirm).toHaveBeenCalledWith(
            expect.objectContaining({
                title: '删除 SSH 公钥',
                confirmButtonLabel: '删除',
            }),
        );

        const onConfirm = mockConfirm.mock.calls[0][0].onConfirm;
        await onConfirm();

        expect(mockDeleteKeys).toHaveBeenCalledWith(['key-1']);
    });
});
