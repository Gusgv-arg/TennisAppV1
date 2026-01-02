import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

export default function AnalysisScreen() {
    const { t } = useTranslation();
    return (
        <View style={styles.container}>
            <Text style={styles.text}>{t('tabAnalysis')}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    text: {
        fontSize: 20,
        fontWeight: '600',
    },
});
