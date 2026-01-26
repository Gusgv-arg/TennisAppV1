import { Card } from '@/src/design/components/Card';
import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';

interface StatsSectionProps {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
  style?: ViewStyle;
  actionLabel?: string;
  onAction?: () => void;
}

export const StatsSection = ({ title, icon, children, style, actionLabel, onAction }: StatsSectionProps) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

  return (
    <Card style={[styles.container, style]} padding="none">
      <TouchableOpacity
        style={[styles.header, !isExpanded && styles.headerCollapsed]}
        onPress={() => setIsExpanded(!isExpanded)}
        activeOpacity={0.7}
      >
        <View style={styles.titleRow}>
          <View style={styles.iconContainer}>
            <Ionicons name={icon} size={20} color={colors.primary[500]} />
          </View>
          <Text style={styles.title}>{title}</Text>
        </View>

        <View style={styles.actionsRow}>
          {isExpanded && actionLabel && onAction && (
            <TouchableOpacity onPress={onAction} style={styles.actionBtn}>
              <Text style={styles.actionLabel}>{actionLabel}</Text>
            </TouchableOpacity>
          )}
          <Ionicons
            name={isExpanded ? "chevron-up" : "chevron-down"}
            size={20}
            color={colors.neutral[400]}
          />
        </View>
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.content}>
          {children}
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: colors.common.white,
  },
  headerCollapsed: {
    // No specific style needed for now, but keeping prop for future use
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: typography.size.md,
    fontWeight: '600',
    color: colors.neutral[800],
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  actionBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  actionLabel: {
    fontSize: typography.size.sm,
    color: colors.primary[600],
    fontWeight: '500',
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
    paddingTop: spacing.md,
  }
});
