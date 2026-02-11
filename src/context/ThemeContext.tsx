import * as SecureStore from 'expo-secure-store';
import React, { createContext, useEffect, useMemo, useState } from 'react';
import { Platform, useColorScheme as useNativeColorScheme } from 'react-native';
import { Theme, darkTheme, lightTheme } from '../design/theme';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
    theme: Theme;
    themeMode: ThemeMode;
    setThemeMode: (mode: ThemeMode) => void;
    isDark: boolean;
}

export const ThemeContext = createContext<ThemeContextType>({
    theme: lightTheme,
    themeMode: 'system',
    setThemeMode: () => { },
    isDark: false,
});

const STORAGE_KEY = 'tennis_app_theme_mode';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const systemScheme = useNativeColorScheme();
    const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
    const [isReady, setIsReady] = useState(false);

    // Load saved preference
    useEffect(() => {
        async function loadThemePreference() {
            try {
                let savedMode: string | null = null;
                if (Platform.OS === 'web') {
                    savedMode = localStorage.getItem(STORAGE_KEY);
                } else {
                    savedMode = await SecureStore.getItemAsync(STORAGE_KEY);
                }

                if (savedMode === 'light' || savedMode === 'dark' || savedMode === 'system') {
                    setThemeModeState(savedMode as ThemeMode);
                }
            } catch (e) {
                console.warn('Failed to load theme preference', e);
            } finally {
                setIsReady(true);
            }
        }
        loadThemePreference();
    }, []);

    const setThemeMode = async (mode: ThemeMode) => {
        setThemeModeState(mode);
        try {
            if (Platform.OS === 'web') {
                localStorage.setItem(STORAGE_KEY, mode);
            } else {
                await SecureStore.setItemAsync(STORAGE_KEY, mode);
            }
        } catch (e) {
            console.warn('Failed to save theme preference', e);
        }
    };

    const activeScheme = useMemo(() => {
        if (themeMode === 'system') {
            return systemScheme === 'dark' ? 'dark' : 'light';
        }
        return themeMode;
    }, [themeMode, systemScheme]);

    const theme = useMemo(() => {
        return activeScheme === 'dark' ? darkTheme : lightTheme;
    }, [activeScheme]);

    // Apply dark class to body on web for CSS targeting
    useEffect(() => {
        if (Platform.OS === 'web') {
            if (activeScheme === 'dark') {
                document.body.classList.add('dark');
            } else {
                document.body.classList.remove('dark');
            }
        }
    }, [activeScheme]);

    // Don't render until preference is loaded to avoid flash
    if (!isReady) {
        return null;
    }

    return (
        <ThemeContext.Provider value={{ theme, themeMode, setThemeMode, isDark: activeScheme === 'dark' }}>
            {children}
        </ThemeContext.Provider>
    );
};
