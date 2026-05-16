import React, { FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { KeyRound, Loader2, LockKeyhole, Server, ShieldCheck, UsersRound } from 'lucide-react';
import { Button, Field, TextInput } from 'ui';

import { ReactComponent as FeishuIcon } from 'assets/icons/feishu.svg';
import { useAppDispatch } from 'hooks';
import { goToUrl } from 'libs';
import { ROUTES } from 'routes';
import {
    useEntraAuthorizeMutation,
    useEntraCallbackMutation,
    useGetEntraInfoQuery,
    useGetGoogleInfoQuery,
    useGetNextRedirectMutation,
    useGetServerTestUsersQuery,
    useGetOktaInfoQuery,
    useFeishuAuthorizeMutation,
    useFeishuCallbackMutation,
    useGetFeishuInfoQuery,
    useGoogleAuthorizeMutation,
    useGoogleCallbackMutation,
    useOktaAuthorizeMutation,
    useOktaCallbackMutation,
} from 'services/auth';
import { useLazyGetProjectsQuery } from 'services/project';
import { useCheckAuthTokenMutation } from 'services/user';

import { getBaseUrl } from 'App/helpers';
import { removeAuthData, setAuthData } from 'App/slice';

import { CONSOLE_ROUTES } from './constants';

const AuthShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <main className="flex min-h-screen bg-slate-950 text-white">
        <div className="hidden flex-1 flex-col justify-between overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.38),transparent_32%),linear-gradient(135deg,#0f172a,#020617)] p-10 lg:flex">
            <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500 text-white shadow-lg shadow-blue-500/30">
                    <Server className="h-5 w-5" />
                </div>
                <div>
                    <div className="text-lg font-bold">dstack Console</div>
                    <div className="text-sm text-slate-300">Run management platform</div>
                </div>
            </div>
            <div className="max-w-xl">
                <div className="mb-5 inline-flex rounded-full border border-white/10 bg-white/10 px-3 py-1 text-sm text-blue-100">
                    运行任务、审批与运维统一入口
                </div>
                <h1 className="text-5xl font-bold leading-tight tracking-normal">让团队用一个控制台管理运行任务。</h1>
                <p className="mt-5 text-base leading-7 text-slate-300">
                    普通用户提交运行任务，项目管理员审批资源，最高管理员管理集群、项目、运行任务和用户。
                </p>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm text-slate-300">
                {['申请审批', '资源调度', '项目治理'].map((label) => (
                    <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-4">
                        <ShieldCheck className="mb-3 h-5 w-5 text-teal-300" />
                        {label}
                    </div>
                ))}
            </div>
        </div>
        <div className="flex min-h-screen w-full items-center justify-center bg-slate-50 p-6 text-slate-950 dark:bg-slate-950 dark:text-slate-50 lg:w-[520px]">
            <div className="w-full max-w-sm">{children}</div>
        </div>
    </main>
);

export const AuthErrorPage: React.FC<{ title?: string; text?: string }> = ({
    title = 'Not Found',
    text = 'Page not found',
}) => (
    <AuthShell>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
            <h1 className="text-2xl font-bold">{title}</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{text}</p>
            <Button className="mt-6 w-full" variant="primary" onClick={() => (window.location.href = CONSOLE_ROUTES.DASHBOARD)}>
                返回工作台
            </Button>
        </div>
    </AuthShell>
);

export const LoginPage: React.FC<{ tokenOnly?: boolean }> = ({ tokenOnly }) => {
    const { t } = useTranslation();
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const [token, setToken] = useState('');
    const [error, setError] = useState('');
    const [checkAuthToken, checkState] = useCheckAuthTokenMutation();
    const [feishuAuthorize, feishuState] = useFeishuAuthorizeMutation();
    const [oktaAuthorize, oktaState] = useOktaAuthorizeMutation();
    const [entraAuthorize, entraState] = useEntraAuthorizeMutation();
    const [googleAuthorize, googleState] = useGoogleAuthorizeMutation();
    const testUsers = useGetServerTestUsersQuery();
    const feishuInfo = useGetFeishuInfoQuery();
    const oktaInfo = useGetOktaInfoQuery(undefined, { skip: process.env.UI_VERSION !== 'enterprise' });
    const entraInfo = useGetEntraInfoQuery(undefined, { skip: process.env.UI_VERSION !== 'enterprise' });
    const googleInfo = useGetGoogleInfoQuery(undefined, { skip: process.env.UI_VERSION !== 'enterprise' });
    const feishuEnabled = feishuInfo.data?.enabled === true;

    const authorize = async (provider: 'feishu' | 'okta' | 'entra' | 'google') => {
        setError('');
        try {
            const result =
                provider === 'feishu'
                    ? await feishuAuthorize().unwrap()
                    : provider === 'okta'
                      ? await oktaAuthorize().unwrap()
                      : provider === 'entra'
                        ? await entraAuthorize({ base_url: getBaseUrl() }).unwrap()
                        : await googleAuthorize().unwrap();
            goToUrl(result.authorization_url);
        } catch {
            setError(t('auth.authorization_failed'));
        }
    };

    const loginWithToken = async (nextToken: string) => {
        setError('');
        try {
            await checkAuthToken({ token: nextToken }).unwrap();
            dispatch(setAuthData({ token: nextToken }));
            navigate(CONSOLE_ROUTES.DASHBOARD);
        } catch {
            setError(t('auth.invalid_token'));
        }
    };

    const onTokenSubmit = async (event: FormEvent) => {
        event.preventDefault();
        await loginWithToken(token);
    };

    const loading = feishuState.isLoading || oktaState.isLoading || entraState.isLoading || googleState.isLoading;

    return (
        <AuthShell>
            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
                <div className="mb-8">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/30">
                        <LockKeyhole className="h-5 w-5" />
                    </div>
                    <h1 className="text-2xl font-bold">{t('auth.sign_in_to_dstack_enterprise')}</h1>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t('auth.contact_to_administrator')}</p>
                </div>

                {!tokenOnly && (
                    <div className="mb-5">
                        <Button
                            className="w-full"
                            variant="primary"
                            loading={feishuState.isLoading || feishuInfo.isLoading}
                            disabled={!feishuEnabled}
                            icon={<FeishuIcon className="h-4 w-4" />}
                            onClick={() => authorize('feishu')}
                        >
                            {t('common.login_feishu')}
                        </Button>
                        {!feishuEnabled && !feishuInfo.isLoading && (
                            <p className="mt-2 text-xs leading-5 text-amber-600 dark:text-amber-300">
                                {t('auth.feishu_not_configured')}
                            </p>
                        )}
                    </div>
                )}

                {!tokenOnly && process.env.UI_VERSION === 'enterprise' && (
                    <div className="mb-5 grid gap-3">
                        {oktaInfo.data?.enabled && (
                            <Button className="w-full" loading={oktaState.isLoading} onClick={() => authorize('okta')}>
                                {t('common.login_okta')}
                            </Button>
                        )}
                        {entraInfo.data?.enabled && (
                            <Button className="w-full" loading={entraState.isLoading} onClick={() => authorize('entra')}>
                                {t('common.login_entra')}
                            </Button>
                        )}
                        {googleInfo.data?.enabled && (
                            <Button className="w-full" loading={googleState.isLoading} onClick={() => authorize('google')}>
                                {t('common.login_google')}
                            </Button>
                        )}
                    </div>
                )}

                {!tokenOnly && testUsers.data?.enabled && testUsers.data.users.length > 0 && (
                    <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50/70 p-4 dark:border-blue-500/20 dark:bg-blue-500/10">
                        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-blue-800 dark:text-blue-200">
                            <UsersRound className="h-4 w-4" />
                            测试环境快捷登录
                        </div>
                        <div className="grid gap-3">
                            {testUsers.data.users.map((user) => (
                                <div
                                    key={user.username}
                                    className="rounded-lg border border-white/80 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900"
                                >
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="min-w-0">
                                            <div className="text-sm font-semibold text-slate-950 dark:text-slate-50">
                                                {user.label}
                                            </div>
                                            <div className="mt-1 truncate font-mono text-xs text-slate-500 dark:text-slate-400">
                                                {user.token}
                                            </div>
                                        </div>
                                        <Button
                                            className="w-full sm:w-24"
                                            variant="secondary"
                                            loading={checkState.isLoading}
                                            onClick={() => {
                                                setToken(user.token);
                                                void loginWithToken(user.token);
                                            }}
                                        >
                                            登录
                                        </Button>
                                    </div>
                                    <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{user.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <form className="grid gap-4" onSubmit={onTokenSubmit}>
                    <Field label={t('auth.login_by_token')} error={error}>
                        <TextInput
                            value={token}
                            onChange={(event) => setToken(event.target.value)}
                            placeholder="dstack_..."
                            autoComplete="off"
                        />
                    </Field>
                    <Button
                        className="w-full"
                        type="submit"
                        variant={tokenOnly ? 'primary' : 'secondary'}
                        loading={checkState.isLoading || loading}
                        icon={<KeyRound className="h-4 w-4" />}
                    >
                        {t('common.login')}
                    </Button>
                </form>

                {tokenOnly && (
                    <Link
                        className="mt-5 block text-center text-sm font-semibold text-blue-600 dark:text-blue-300"
                        to={ROUTES.BASE}
                    >
                        {t('auth.another_login_methods')}
                    </Link>
                )}
            </div>
        </AuthShell>
    );
};

export const OAuthCallbackPage: React.FC<{ provider: 'feishu' | 'okta' | 'entra' | 'google' }> = ({ provider }) => {
    const { t } = useTranslation();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const [error, setError] = useState(false);
    const [getNextRedirect] = useGetNextRedirectMutation();
    const [feishuCallback] = useFeishuCallbackMutation();
    const [oktaCallback] = useOktaCallbackMutation();
    const [entraCallback] = useEntraCallbackMutation();
    const [googleCallback] = useGoogleCallbackMutation();
    const [getProjects] = useLazyGetProjectsQuery();

    useEffect(() => {
        const run = async () => {
            if (!code || !state) {
                setError(true);
                return;
            }

            try {
                const { redirect_url } = await getNextRedirect({ code, state }).unwrap();
                if (redirect_url) {
                    window.location.href = redirect_url;
                    return;
                }

                const response =
                    provider === 'feishu'
                        ? await feishuCallback({ code, state }).unwrap()
                        : provider === 'okta'
                          ? await oktaCallback({ code, state }).unwrap()
                          : provider === 'entra'
                            ? await entraCallback({ code, state, base_url: getBaseUrl() }).unwrap()
                            : await googleCallback({ code, state }).unwrap();

                dispatch(setAuthData({ token: response.creds.token }));

                if (process.env.UI_VERSION === 'sky' && provider === 'feishu') {
                    const projects = await getProjects({}).unwrap();
                    if ('data' in projects && projects.data.length === 0) {
                        navigate(CONSOLE_ROUTES.WORKSPACE_PROJECT_CREATE);
                        return;
                    }
                }

                navigate(CONSOLE_ROUTES.DASHBOARD);
            } catch {
                setError(true);
            }
        };

        run();
    }, []);

    if (error) {
        return <AuthErrorPage title={t('auth.authorization_failed')} text={t('auth.try_again')} />;
    }

    return (
        <AuthShell>
            <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white p-10 shadow-xl shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
        </AuthShell>
    );
};

export const LogoutPage: React.FC = () => {
    const dispatch = useAppDispatch();

    useEffect(() => {
        dispatch(removeAuthData());
    }, []);

    return <Navigate replace to={ROUTES.BASE} />;
};
