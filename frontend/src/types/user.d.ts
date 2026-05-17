declare type TUserRole = 'user' | 'admin';
declare type TServerTestUserRole = 'global_admin' | 'project_manager' | 'user';

declare type TGetUserListParams = TBaseRequestListParams & {
    return_total_count?: boolean;
    name_pattern?: string;
};

declare type TUpdateMyUserParams = {
    email: string | null;
};

declare type TCreateUserParams = Pick<IUser, 'username' | 'global_role' | 'active'> & {
    email: string | null;
};

declare type TUpdateUserParams = Pick<IUser, 'username' | 'global_role' | 'active'> & {
    email: string | null;
};

declare type TGetUserListResponse = {
    total_count: number;
    data: IUser[];
};

declare interface IUserResponseData {
    id: string;
    username: string;
    global_role: TUserRole;
    email: string | null;
    created_at: string;
    active: boolean;
}

declare interface IUser {
    id: string;
    username: string;
    global_role: TUserRole;
    email: string | null;
    created_at: string;
    active: boolean;
}

declare interface IUserWithCreds extends IUser {
    creds: {
        token: string;
    };
}

declare interface IUserAuthData extends Pick<IUserWithCreds['creds'], 'token'> {}

declare interface IServerTestUser {
    username: string;
    label: string;
    role: TServerTestUserRole;
    token: string;
    description: string;
}

declare interface IServerTestUsersResponse {
    enabled: boolean;
    users: IServerTestUser[];
}

declare interface IUserBillingInfo {
    balance: number;
    is_payment_method_attached: boolean;
    default_payment_amount: number;
    billing_history: IPayment[];
}
