import { Card } from '@/src/design/components/Card';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useTheme } from '@/src/hooks/useTheme';
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
  const { theme, isDark } = useTheme();
  const [isExpanded, setIsExpanded] = React.useState(false);

  return (
    <View style={[styles.container, style]}>
      {/* Header / Option Selector */}
      <Card style={styles.headerCard} padding="none">
        <TouchableOpacity
          style={[
            styles.header,
            { backgroundColor: isDark ? theme.background.surface : theme.background.default },
            !isExpanded ? { borderBottomWidth: 0 } : { borderBottomWidth: 1, borderBottomColor: theme.border.subtle }
          ]}
          onPress={() => setIsExpanded(!isExpanded)}
          activeOpacity={0.7}
        >
          <View style={styles.titleRow}>
            <View style={[styles.iconContainer, { backgroundColor: isDark ? theme.components.button.primary.bg + '20' : theme.status.successBackground }]}>
              <Ionicons name={icon} size={20} color={theme.components.button.primary.bg} />
            </View>
            <Text style={[styles.title, { color: theme.text.primary }]}>{title}</Text>
          </View>

          <View style={styles.actionsRow}>
            <Ionicons
              name={isExpanded ? "chevron-up" : "chevron-down"}
              size={20}
              color={theme.text.tertiary}
            />
          </View>
        </TouchableOpacity>
      </Card>

      {/* Expanded Content */}
      {isExpanded && (
        <View style={styles.contentWrapper}>
          <Card style={[styles.contentCard, { backgroundColor: theme.background.default }]} padding="none">
            {actionLabel && onAction && (
              <View style={styles.contentHeader}>
                <TouchableOpacity onPress={onAction} style={styles.actionBtn}>
                  <Text style={[styles.actionLabel, { color: theme.components.button.primary.bg }]}>
                    {actionLabel}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.content}>
              {children}
            </View>
          </Card>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.xl,
    width: '100%',
  },
  headerCard: {
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
    overflow: 'hidden',
    borderRadius: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: typography.size.md,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  contentWrapper: {
    marginTop: spacing.md,
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
  },
  contentCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  contentHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  actionBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  actionLabel: {
    fontSize: typography.size.sm,
    fontWeight: '500',
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    paddingTop: spacing.xs,
  }
});
