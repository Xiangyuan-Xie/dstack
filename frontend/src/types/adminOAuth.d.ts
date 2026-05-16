declare type TOAuthConfigSource = 'database' | 'environment' | 'none';

declare interface IFeishuOAuthConfig {
    enabled: boolean;
    app_id?: string | null;
    scope: string;
    has_app_secret: boolean;
    source: TOAuthConfigSource;
}

declare interface IFeishuOAuthConfigUpdate {
    enabled: boolean;
    app_id?: string | null;
    app_secret?: string;
    scope?: string | null;
}
