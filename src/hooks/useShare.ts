import { Platform, Share } from 'react-native';
import { useState, useCallback } from 'react';
import { showSuccess, showError } from '../utils/toast';

export type ShareType = 'video' | 'analysis';

interface ShareOptions {
    title: string;
    text: string;
    url: string;
}

export const useShare = () => {
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [shareData, setShareData] = useState<ShareOptions | null>(null);

    const generateVideoShareData = useCallback((video: any): ShareOptions => {
        const url = `https://app.tenis-lab.com/v/${video.id}`;
        const appUrl = `https://app.tenis-lab.com/login?role=player`;
        const strokeMap: Record<string, string> = {
            'serve': 'Saque',
            'forehand': 'Drive',
            'backhand': 'Revés',
            'volley': 'Volea',
            'smash': 'Smash',
            'other': 'Otro'
        };
        const strokeLabel = video.stroke ? (strokeMap[video.stroke.toLowerCase()] || video.stroke) : '';
        const strokePart = strokeLabel ? `\nGolpe: ${strokeLabel}` : '';
        
        return {
            title: video.title,
            text: `🎾 ¡Te compartieron un video desde Tenis-Lab!\n\nTítulo: ${video.title}${strokePart}\n\n🔗 *Ver video:* ${url}\n📲 *O accedé a la App para ver tu historial completo:* ${appUrl}\n\n¡A seguir mejorando! 💪💪`,
            url: url
        };
    }, []);

    const generateAnalysisShareData = useCallback((analysis: any): ShareOptions => {
        const dateStr = new Date(analysis.created_at).toLocaleDateString();
        const strokeNameMap: Record<string, string> = {
            'serve': 'Saque',
            'drive': 'Drive',
            'backhand': 'Revés',
            'volley': 'Volea',
            'smash': 'Smash'
        };
        const strokeTypeDb = (analysis.stroke_type || 'serve').toLowerCase();
        const strokeString = strokeNameMap[strokeTypeDb] || strokeTypeDb;
        const score = Math.round(analysis.metrics?.finalScore || 0);
        
        let text = `🎾 *Análisis de ${strokeString} - ${dateStr}*\n\n`;
        text += `📊 *Score Global: ${score}%*\n\n`;
        
        const categoryScores = analysis.metrics?.categoryScores || {};
        text += `*Desglose:* \n`;
        if (categoryScores.preparacion !== undefined) text += `• Preparación: ${Math.round(categoryScores.preparacion)}%\n`;
        if (categoryScores.armado !== undefined) text += `• Armado: ${Math.round(categoryScores.armado)}%\n`;
        if (categoryScores.impacto !== undefined) text += `• Impacto: ${Math.round(categoryScores.impacto)}%\n`;
        if (categoryScores.terminacion !== undefined) text += `• Terminación: ${Math.round(categoryScores.terminacion)}%\n`;

        if (analysis.coach_feedback) {
            text += `\n💬 *Feedback del Coach:* ${analysis.coach_feedback}\n`;
        }

        const url = `https://app.tenis-lab.com/v/${analysis.video_id}`;
        const appUrl = `https://app.tenis-lab.com/login?role=player`;
        text += `\n🔗 *Ver este análisis:* ${url}\n📲 *O accedé a la App para ver tu historial completo:* ${appUrl}\n\n¡A seguir mejorando! 💪`;

        return {
            title: `Análisis de ${strokeString} - ${dateStr}`,
            text: text,
            url: url
        };
    }, []);

    const handleSharePress = useCallback((type: ShareType, data: any) => {
        const options = type === 'video' ? generateVideoShareData(data) : generateAnalysisShareData(data);
        setShareData(options);
        setIsModalVisible(true);
    }, [generateVideoShareData, generateAnalysisShareData]);

    const performWhatsAppShare = useCallback(async () => {
        if (!shareData) return;
        try {
            const encodedText = encodeURIComponent(shareData.text);
            const isDesktop = Platform.OS === 'web' && !/iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            const waUrl = isDesktop 
                ? `https://web.whatsapp.com/send?text=${encodedText}`
                : `https://wa.me/?text=${encodedText}`;
            
            if (Platform.OS === 'web') {
                window.open(waUrl, '_blank');
            } else {
                const Linking = require('expo-linking');
                const supported = await Linking.canOpenURL(waUrl);
                if (supported) {
                    await Linking.openURL(waUrl);
                } else {
                    showError("Error", "WhatsApp no está instalado.");
                }
            }
            setIsModalVisible(false);
        } catch (error) {
            console.error("Error sharing to WhatsApp:", error);
            showError("Error", "No se pudo abrir WhatsApp.");
        }
    }, [shareData]);

    const performCopyLink = useCallback(async () => {
        if (!shareData) return;
        try {
            if (Platform.OS === 'web') {
                await navigator.clipboard.writeText(shareData.text);
                showSuccess("Copiado", "Mensaje copiado al portapapeles.");
            } else {
                // Fallback for native if expo-clipboard is not installed
                // In many cases, we just use Share.share on native anyway
                showError("No disponible", "La función de copiar no está disponible en esta versión nativa.");
            }
            setIsModalVisible(false);
        } catch (error) {
            console.error("Error copying link:", error);
            showError("Error", "No se pudo copiar el enlace.");
        }
    }, [shareData]);

    const performNativeShare = useCallback(async () => {
        if (!shareData) return;
        try {
            if (Platform.OS === 'web') {
                if (navigator.share) {
                    await navigator.share({
                        title: shareData.title,
                        text: shareData.text
                    });
                } else {
                    // Fallback to copy if navigator.share is not available but they pressed "Other"
                    await performCopyLink();
                }
            } else {
                await Share.share({
                    message: shareData.text,
                    title: shareData.title
                });
            }
            setIsModalVisible(false);
        } catch (error) {
            console.error("Error with native share:", error);
            showError("Error", "No se pudo completar el compartido.");
        }
    }, [shareData, performCopyLink]);

    return {
        isModalVisible,
        setIsModalVisible,
        shareData,
        handleSharePress,
        performWhatsAppShare,
        performCopyLink,
        performNativeShare
    };
};
