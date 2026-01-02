import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useAuthStore } from '../../src/store/useAuthStore';

export default function HomeScreen() {
  const { t } = useTranslation();
  const { profile } = useAuthStore();

  return (
    <View style={styles.container}>
      <Text style={styles.welcome}>¡{t('welcome')}!</Text>
      <Text style={styles.name}>{profile?.full_name}</Text>
      <Text style={styles.subtitle}>Tennis Coach Dashboard</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  welcome: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  name: {
    fontSize: 20,
    color: '#007AFF',
    marginTop: 10,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 20,
  },
});
