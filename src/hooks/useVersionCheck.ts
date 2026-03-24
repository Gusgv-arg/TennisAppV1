import { useEffect, useState } from 'react';
import Constants from 'expo-constants';
import { supabase } from '../services/supabaseClient';
import { isVersionLower } from '../utils/version';
import { Platform } from 'react-native';

export interface VersionCheckResult {
  needsForceUpdate: boolean;
  needsSoftUpdate: boolean;
  downloadUrl: string | null;
  latestVersion: string | null;
  releaseNotes: string | null;
  isChecking: boolean;
  error: Error | null;
}

export function useVersionCheck(): VersionCheckResult {
  const [result, setResult] = useState<VersionCheckResult>({
    needsForceUpdate: false,
    needsSoftUpdate: false,
    downloadUrl: null,
    latestVersion: null,
    releaseNotes: null,
    isChecking: true,
    error: null,
  });

  useEffect(() => {
    async function checkVersion() {
      // Solo chequeamos en Android/iOS nativo, no en Web
      if (Platform.OS === 'web') {
        setResult(prev => ({ ...prev, isChecking: false }));
        return;
      }

      try {
        const currentVersion = Constants.expoConfig?.version || '1.0.0';
        
        // Consultamos la tabla pública (sin auth)
        const { data, error } = await supabase
          .from('app_config')
          .select('*')
          .eq('platform', Platform.OS)
          .single();

        if (error) throw error;

        if (data) {
          const forceUpdate = data.force_update && isVersionLower(currentVersion, data.min_version);
          const softUpdate = !forceUpdate && isVersionLower(currentVersion, data.latest_version);

          setResult({
            needsForceUpdate: forceUpdate,
            needsSoftUpdate: softUpdate,
            downloadUrl: data.download_url,
            latestVersion: data.latest_version,
            releaseNotes: data.release_notes,
            isChecking: false,
            error: null,
          });
        }
      } catch (err) {
        console.error('[useVersionCheck] Error:', err);
        setResult(prev => ({ 
          ...prev, 
          isChecking: false, 
          error: err instanceof Error ? err : new Error('Unknown version check error') 
        }));
      }
    }

    checkVersion();
  }, []);

  return result;
}
