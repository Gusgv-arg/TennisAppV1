import { colors } from './tokens/colors';

export interface Theme {
    mode: 'light' | 'dark';
    background: {
        default: string;
        surface: string;
        modal: string;
        input: string;
        subtle: string;
        backdrop: string;
    };
    text: {
        primary: string;
        secondary: string;
        tertiary: string;
        inverse: string;
        error: string;
        success: string;
        warning: string;
        disabled: string;
    };
    border: {
        default: string;
        active: string;
        subtle: string;
    };
    components: {
        badge: {
            default: string;
            primary: string;
            secondary: string;
            success: string;
            warning: string;
            error: string;
        };
        button: {
            primary: {
                bg: string;
                text: string;
                pressed: string;
            };
            secondary: {
                bg: string;
                text: string;
                pressed: string;
            };
            outline: {
                border: string;
                text: string;
                pressed: string;
            };
            ghost: {
                text: string;
                pressed: string;
            };
        };
        tabBar: {
            bg: string;
            border: string;
            active: string;
            inactive: string;
        };
    };
    status: {
        success: string;
        successBackground: string;
        successText: string;
        error: string;
        errorBackground: string;
        errorText: string;
        warning: string;
        warningBackground: string;
        warningText: string;
        info: string;
        infoBackground: string;
        infoText: string;
    };
}

export const lightTheme: Theme = {
    mode: 'light',
    background: {
        default: colors.neutral[50], // Slightly off-white
        surface: colors.common.white, // Pure white for cards
        modal: colors.common.white,
        input: colors.common.white,
        subtle: colors.neutral[100],
        backdrop: 'rgba(0, 0, 0, 0.5)',
    },
    text: {
        primary: colors.neutral[900],
        secondary: colors.neutral[500],
        tertiary: colors.neutral[400],
        inverse: colors.common.white,
        error: colors.error[600],
        success: colors.success[600],
        warning: colors.warning[600],
        disabled: colors.neutral[400],
    },
    border: {
        default: colors.neutral[200],
        active: colors.primary[500],
        subtle: colors.neutral[100],
    },
    status: {
        success: colors.success[500],
        successBackground: colors.success[50],
        successText: colors.success[700],
        error: colors.error[500],
        errorBackground: colors.error[50],
        errorText: colors.error[700],
        warning: colors.warning[500],
        warningBackground: colors.warning[50],
        warningText: colors.warning[800],
        info: colors.secondary[500],
        infoBackground: colors.secondary[50],
        infoText: colors.secondary[700],
    },
    components: {
        badge: {
            default: colors.neutral[100],
            primary: colors.primary[50],
            secondary: colors.secondary[50],
            success: colors.success[50],
            warning: colors.warning[50],
            error: colors.error[50],
        },
        button: {
            primary: {
                bg: colors.primary[500],
                text: colors.common.white,
                pressed: colors.primary[600],
            },
            secondary: {
                bg: colors.secondary[500],
                text: colors.common.white,
                pressed: colors.secondary[600],
            },
            outline: {
                border: colors.neutral[300],
                text: colors.neutral[700],
                pressed: colors.neutral[100],
            },
            ghost: {
                text: colors.neutral[600],
                pressed: colors.neutral[100],
            },
        },
        tabBar: {
            bg: colors.common.white,
            border: colors.neutral[200],
            active: colors.primary[500],
            inactive: colors.neutral[400],
        },
    },
};

export const darkTheme: Theme = {
    mode: 'dark',
    background: {
        default: colors.neutral[900], // Dark grey/black
        surface: colors.neutral[800], // Lighter grey for cards
        modal: colors.neutral[800],
        input: colors.neutral[700],
        subtle: colors.neutral[800],
        backdrop: 'rgba(0, 0, 0, 0.7)',
    },
    text: {
        primary: colors.neutral[50], // Almost white
        secondary: colors.neutral[400],
        tertiary: colors.neutral[600],
        inverse: colors.neutral[900],
        error: colors.error[400],
        success: colors.success[400],
        warning: colors.warning[400],
        disabled: colors.neutral[600],
    },
    border: {
        default: colors.neutral[700],
        active: colors.primary[400],
        subtle: colors.neutral[800],
    },
    status: {
        success: colors.success[500],
        successBackground: colors.success[900], // Dark background for status
        successText: colors.success[100],
        error: colors.error[500],
        errorBackground: colors.error[900],
        errorText: colors.error[100],
        warning: colors.warning[500],
        warningBackground: colors.warning[900],
        warningText: colors.warning[100],
        info: colors.secondary[500],
        infoBackground: colors.secondary[900],
        infoText: colors.secondary[100],
    },
    components: {
        badge: {
            default: colors.neutral[700],
            primary: colors.primary[900], // Darker background for badges in dark mode
            secondary: colors.secondary[900],
            success: colors.success[900],
            warning: colors.warning[900],
            error: colors.error[900],
        },
        button: {
            primary: {
                bg: colors.primary[600], // Slightly darker primary for dark mode? Or keep 500?
                text: colors.common.white,
                pressed: colors.primary[700],
            },
            secondary: {
                bg: colors.secondary[600],
                text: colors.common.white,
                pressed: colors.secondary[700],
            },
            outline: {
                border: colors.neutral[600],
                text: colors.neutral[300],
                pressed: colors.neutral[700],
            },
            ghost: {
                text: colors.neutral[400],
                pressed: colors.neutral[800],
            },
        },
        tabBar: {
            bg: colors.neutral[800],
            border: colors.neutral[700],
            active: colors.primary[400],
            inactive: colors.neutral[600],
        },
    },
};
