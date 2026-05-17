import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LoginPage } from './Auth';

const mockFeishuAuthorize = jest.fn();

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) =>
            ({
                'common.login_feishu': '使用飞书登录',
                'common.login': '登录',
                'auth.feishu_not_configured': '飞书登录未配置，请管理员配置飞书 OAuth。',
                'auth.sign_in_to_dstack_enterprise': '欢迎使用 dstack',
                'auth.contact_to_administrator': '请联系管理员获取授权 Token。',
                'auth.login_by_token': '使用 Token 登录',
            })[key] ?? key,
    }),
}));

jest.mock('react-router-dom', () => ({
    Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
    useNavigate: () => jest.fn(),
    useSearchParams: () => [new URLSearchParams()],
    Navigate: () => null,
}));

jest.mock('hooks', () => ({
    useAppDispatch: () => jest.fn(),
}));

jest.mock('libs', () => ({
    goToUrl: jest.fn(),
}));

jest.mock('assets/icons/feishu.svg', () => {
    const React = require('react');
    return {
        ReactComponent: (props: React.SVGProps<SVGSVGElement>) =>
            React.createElement('svg', { ...props, 'data-testid': 'feishu-logo' }),
    };
});

jest.mock('App/slice', () => ({
    removeAuthData: jest.fn((payload) => ({ type: 'app/removeAuthData', payload })),
    setAuthData: jest.fn((payload) => ({ type: 'app/setAuthData', payload })),
}));

jest.mock('services/project', () => ({
    useLazyGetProjectsQuery: () => [jest.fn()],
}));

jest.mock('services/user', () => ({
    useCheckAuthTokenMutation: () => [jest.fn(), { isLoading: false }],
}));

jest.mock('services/auth', () => ({
    useFeishuAuthorizeMutation: () => [mockFeishuAuthorize, { isLoading: false }],
    useFeishuCallbackMutation: () => [jest.fn()],
    useGetFeishuInfoQuery: jest.fn(),
    useGetServerTestUsersQuery: () => ({ data: { enabled: false, users: [] } }),
    useGetNextRedirectMutation: () => [jest.fn()],
    useGetOktaInfoQuery: () => ({ data: { enabled: false } }),
    useOktaAuthorizeMutation: () => [jest.fn(), { isLoading: false }],
    useOktaCallbackMutation: () => [jest.fn()],
    useGetEntraInfoQuery: () => ({ data: { enabled: false } }),
    useEntraAuthorizeMutation: () => [jest.fn(), { isLoading: false }],
    useEntraCallbackMutation: () => [jest.fn()],
    useGetGoogleInfoQuery: () => ({ data: { enabled: false } }),
    useGoogleAuthorizeMutation: () => [jest.fn(), { isLoading: false }],
    useGoogleCallbackMutation: () => [jest.fn()],
}));

describe('LoginPage', () => {
    const { useGetFeishuInfoQuery } = jest.requireMock('services/auth');

    beforeEach(() => {
        mockFeishuAuthorize.mockReset();
    });

    test('shows disabled Feishu login button when OAuth is not configured', () => {
        useGetFeishuInfoQuery.mockReturnValue({ data: { enabled: false } });

        render(<LoginPage />);

        expect(screen.getByRole('button', { name: '使用飞书登录' })).toBeDisabled();
        expect(screen.getByTestId('feishu-logo')).toBeInTheDocument();
        expect(screen.getByText('飞书登录未配置，请管理员配置飞书 OAuth。')).toBeInTheDocument();
        expect(screen.queryByText(/GitHub/i)).not.toBeInTheDocument();
    });

    test('authorizes with Feishu when OAuth is configured', async () => {
        useGetFeishuInfoQuery.mockReturnValue({ data: { enabled: true } });
        mockFeishuAuthorize.mockReturnValue({
            unwrap: () => Promise.resolve({ authorization_url: 'https://open.feishu.cn/oauth' }),
        });

        render(<LoginPage />);
        await userEvent.click(screen.getByRole('button', { name: '使用飞书登录' }));

        expect(mockFeishuAuthorize).toHaveBeenCalledTimes(1);
    });
});
