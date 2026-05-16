import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { LOCALE_STORAGE_KEY } from 'pages/Console/constants';
import { getPreferredLocale } from 'pages/Console/utils';

import en from './en.json';
import zh from './zh.json';

const initialLocale = getPreferredLocale(
    typeof localStorage === 'undefined' ? null : localStorage.getItem(LOCALE_STORAGE_KEY),
    typeof navigator === 'undefined' ? undefined : navigator.language,
);

i18n.use(initReactI18next).init({
    returnNull: false,
    resources: {
        zh: {
            translation: zh,
        },
        en: {
            translation: en,
        },
    },
    lng: initialLocale,
    fallbackLng: 'en',

    interpolation: {
        escapeValue: false,
    },
});
