import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { spacing } from '../tokens/spacing';

interface RowProps {
    children: React.ReactNode;
    /**
     * Spacing between child elements. Defaults to 'md'.
     */
    gap?: keyof typeof spacing;
    /**
     * Vertical alignment of items. Defaults to 'center'.
     */
    align?: 'flex-start' | 'center' | 'flex-end' | 'stretch';
    /**
     * Horizontal distribution of items. Defaults to 'flex-start'.
     */
    justify?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around';
    style?: StyleProp<ViewStyle>;
}

/**
 * A standard layout component for arranging items horizontally with consistent spacing.
 * Replaces manual `flexDirection: 'row'` views.
 */
export const Row: React.FC<RowProps> = ({
    children,
    gap = 'md',
    align = 'center',
    justify = 'flex-start',
    style,
}) => {
    return (
        <View
            style={[
                {
                    flexDirection: 'row',
                    alignItems: align,
                    justifyContent: justify,
                    gap: spacing[gap],
                },
                style,
            ]}
        >
            {children}
        </View>
    );
};
