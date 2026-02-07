declare module 'react-native-confetti-cannon' {
    import React from 'react';
    import { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';

    export interface ConfettiCannonProps {
        count?: number;
        origin?: { x: number; y: number };
        explosionSpeed?: number;
        fallSpeed?: number;
        colors?: string[];
        fadeOut?: boolean;
        autoStart?: boolean;
        autoStartDelay?: number;
        testID?: string;
        style?: StyleProp<ViewStyle>;
        onAnimationStart?: () => void;
        onAnimationEnd?: () => void;
        onLayout?: (event: LayoutChangeEvent) => void;
    }

    export default class ConfettiCannon extends React.Component<ConfettiCannonProps> {
        start: () => void;
        stop: () => void;
    }
}
