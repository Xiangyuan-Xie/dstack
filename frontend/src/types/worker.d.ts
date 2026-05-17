declare interface IWorkerRegistrationToken {
    id: string;
    fleet_name: string;
    enabled: boolean;
    created_at: string;
    expires_at?: string | null;
    token?: string | null;
}

declare type TCreateWorkerRegistrationTokenParams = {
    fleet_name: string;
    expires_at?: string | null;
};

declare type TDeleteWorkerRegistrationTokenParams = {
    id: IWorkerRegistrationToken['id'];
};
