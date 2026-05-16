import { ReactNode } from 'react';

export type THelpPanelContent = {
    header?: ReactNode;
    footer?: ReactNode;
    body?: ReactNode;
};

export enum ToolsTabs {
    INFO = 'info',
    TUTORIAL = 'tutorial',
}

export interface ITutorialItem {
    id: number;
    title?: string;
    description?: string;
    startCallback?: (tutorial: ITutorialItem) => void;
    startWithoutActivation?: boolean;
    finishCallback?: (tutorial: ITutorialItem) => void;
}

export interface IAppState {
    userData: IUser | null;
    authData: IUserAuthData | null;
    breadcrumbs: TBreadcrumb[] | null;
    systemMode: TThemeMode;
    toolsPanelState: {
        isOpen: boolean;
        tab: ToolsTabs;
    };

    helpPanel: {
        content: THelpPanelContent;
    };

    tutorialPanel: {
        createProjectCompleted: boolean;
        billingCompleted: boolean;
        configureCLICompleted: boolean;
        discordCompleted: boolean;
        tallyCompleted: boolean;
        quickStartCompleted: boolean;
        hideStartUp: boolean | null;
    };
}
