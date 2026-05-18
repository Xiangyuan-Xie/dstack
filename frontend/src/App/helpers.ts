import { THEME_STORAGE_KEY } from 'pages/Console/constants';
import { applyConsoleTheme, getPreferredThemeMode } from 'pages/Console/utils';

export const getThemeMode = (): TThemeMode => {
    let storedMode: string | null = null;
    try {
        storedMode = localStorage.getItem(THEME_STORAGE_KEY);
    } catch (e) {
        console.log(e);
    }

    return getPreferredThemeMode(storedMode, window?.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
};

export const setDocumentThemeMode = (mode: TThemeMode): void => {
    applyConsoleTheme(mode);
};

export function getBaseUrl(): string {
    const { protocol, hostname, port } = window.location;
    return `${protocol}//${hostname}${port ? `:${port}` : ''}`;
}
