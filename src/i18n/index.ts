import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { LocaleConfig } from 'react-native-calendars';

import en from './locales/en.json';
import es from './locales/es.json';

const resources = {
    en: { translation: en },
    es: { translation: es },
};

// Configure Calendar Locales
LocaleConfig.locales['en'] = {
    monthNames: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    monthNamesShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    dayNames: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    dayNamesShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    today: 'Today'
};

LocaleConfig.locales['es'] = {
    monthNames: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
    monthNamesShort: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
    dayNames: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
    dayNamesShort: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
    today: 'Hoy'
};

i18n
    .use(initReactI18next)
    .init({
        resources,
        lng: Localization.getLocales()[0].languageCode ?? 'en',
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false,
        },
    });

// Set initial calendar locale
const currentLng = i18n.language.startsWith('es') ? 'es' : 'en';
LocaleConfig.defaultLocale = currentLng;

// Update calendar locale when i18n language changes
i18n.on('languageChanged', (lng) => {
    const calendarLng = lng.startsWith('es') ? 'es' : 'en';
    LocaleConfig.defaultLocale = calendarLng;
});

export default i18n;
