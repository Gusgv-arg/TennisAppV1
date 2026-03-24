import React from 'react';
import { View, Text, StyleSheet, Linking, Image, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { Button } from '../design';

interface ForceUpdateScreenProps {
  downloadUrl: string | null;
  releaseNotes: string | null;
  latestVersion: string | null;
}

export const ForceUpdateScreen: React.FC<ForceUpdateScreenProps> = ({ 
  downloadUrl, 
  releaseNotes,
  latestVersion 
}) => {
  const { t } = useTranslation();
  const { theme, isDark } = useTheme();

  const handleDownload = () => {
    if (downloadUrl) {
      Linking.openURL(downloadUrl);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background.default }]}>
      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: theme.background.subtle }]}>
          <Ionicons name="cloud-download-outline" size={64} color={theme.components.button.primary.bg} />
        </View>

        <Text style={[styles.title, { color: theme.text.primary }]}>
          {t('update.required_title')}
        </Text>

        <Text style={[styles.message, { color: theme.text.secondary }]}>
          {t('update.required_message')}
        </Text>

        {latestVersion && (
          <View style={[styles.versionBadge, { backgroundColor: theme.background.neutral }]}>
            <Text style={[styles.versionText, { color: theme.text.primary }]}>
              v{latestVersion}
            </Text>
          </View>
        )}

        {releaseNotes && (
          <View style={styles.notesContainer}>
            <Text style={[styles.notesTitle, { color: theme.text.primary }]}>
              {t('update.release_notes')}
            </Text>
            <Text style={[styles.notesText, { color: theme.text.secondary }]}>
              {releaseNotes}
            </Text>
          </View>
        )}

        <Button
          label={t('update.download_button')}
          onPress={handleDownload}
          style={styles.button}
          leftIcon={<Ionicons name="download-outline" size={20} color="white" />}
        />
        
        <Text style={[styles.footerText, { color: theme.text.tertiary }]}>
          Tenis-Lab Beta
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  versionBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    marginBottom: 24,
  },
  versionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  notesContainer: {
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.02)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 32,
  },
  notesTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  notesText: {
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    width: '100%',
    height: 56,
  },
  footerText: {
    marginTop: 32,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  }
});
