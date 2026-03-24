import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Animated } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';

interface UpdateBannerProps {
  latestVersion: string | null;
  downloadUrl: string | null;
}

export const UpdateBanner: React.FC<UpdateBannerProps> = ({ latestVersion, downloadUrl }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [visible, setVisible] = useState(true);

  if (!visible || !latestVersion) return null;

  const handleDownload = () => {
    if (downloadUrl) {
      Linking.openURL(downloadUrl);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.components.button.primary.bg }]}>
      <TouchableOpacity 
        style={styles.content} 
        onPress={handleDownload}
        activeOpacity={0.8}
      >
        <Ionicons name="sparkles" size={18} color="white" style={styles.icon} />
        <Text style={styles.text}>
          {t('update.available_title')}: v{latestVersion}
        </Text>
        <Ionicons name="chevron-forward" size={16} color="white" style={styles.arrow} />
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.closeButton} 
        onPress={() => setVisible(false)}
      >
        <Ionicons name="close" size={20} color="white" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    width: '100%',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 8,
  },
  text: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  arrow: {
    marginHorizontal: 8,
  },
  closeButton: {
    padding: 4,
  }
});
