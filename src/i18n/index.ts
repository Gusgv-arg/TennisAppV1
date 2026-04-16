import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { LocaleConfig } from 'react-native-calendars';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import en from './locales/en.json';
import es from './locales/es.json';

const LANGUAGE_KEY = 'user-language';

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
    monthNamesShort: ['Ene', 'Feb', 'Mar', 'Abr', 'Mayo', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
    dayNames: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
    dayNamesShort: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
    today: 'Hoy'
};

const initI18n = async () => {
    let savedLanguage = null;
    try {
        if (Platform.OS === 'web') {
            savedLanguage = localStorage.getItem(LANGUAGE_KEY);
        } else {
            savedLanguage = await SecureStore.getItemAsync(LANGUAGE_KEY);
        }
    } catch (error) {
        console.error('Error loading language:', error);
    }

    const deviceLanguage = Localization.getLocales()?.[0]?.languageCode ?? 'en';
    const initialLanguage = savedLanguage || deviceLanguage;

    try {
        await i18n
            .use(initReactI18next)
            .init({
                resources,
                lng: initialLanguage.startsWith('es') ? 'es' : 'en',
                fallbackLng: 'en',
                interpolation: {
                    escapeValue: false,
                },
            });
        
        // Update calendar locale
        const calendarLng = i18n.language.startsWith('es') ? 'es' : 'en';
        LocaleConfig.defaultLocale = calendarLng;
        
    } catch (error) {
        console.error('Failed to initialize i18n:', error);
    }
};

// Start initialization
initI18n();

// Update calendar locale and save preference when i18n language changes
i18n.on('languageChanged', async (lng) => {
    const calendarLng = lng.startsWith('es') ? 'es' : 'en';
    LocaleConfig.defaultLocale = calendarLng;
    
    try {
        if (Platform.OS === 'web') {
            localStorage.setItem(LANGUAGE_KEY, lng);
        } else {
            await SecureStore.setItemAsync(LANGUAGE_KEY, lng);
        }
    } catch (error) {
        console.error('Error saving language:', error);
    }
});

export default i18n;
