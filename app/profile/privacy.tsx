import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { colors, spacing, typography } from '../../src/design';

export default function PrivacyPolicyScreen() {
    const { t, i18n } = useTranslation();
    const router = useRouter();
    const isSpanish = i18n.language === 'es';

    const content = {
        es: {
            appTitle: 'Tenis-Lab',
            title: 'Política de Privacidad',
            lastUpdate: 'Última actualización: 05 de Febrero de 2026',
            intro: 'En Tenis-Lab ("nosotros", "nuestro/a" o "la Aplicación"), valoramos tu privacidad y nos comprometeremos a proteger tus datos personales. Esta Política de Privacidad describe cómo recopilamos, usamos y compartimos tu información cuando utilizas nuestra aplicación móvil y sitio web (www.tenis-lab.com).',
            sections: [
                {
                    icon: 'list-circle-outline',
                    title: '1. Información que Recopilamos',
                    content: 'Recopilamos la siguiente información para proporcionar y mejorar nuestro servicio:',
                    items: [
                        { label: 'Información de Cuenta', text: 'Al registrarte, recopilamos tu dirección de correo electrónico, nombre completo y contraseña (encriptada).' },
                        { label: 'Información de Perfil', text: 'Puedes optar por proporcionar información adicional como tu número de teléfono, ciudad, país y una foto de perfil.' },
                        { label: 'Datos de la Academia', text: 'Si eres administrador de una academia, almacenamos los datos de tus jugadores, asistencias, planes de pago y estructura de la academia.' },
                        { label: 'Datos de Uso', text: 'Podemos recopilar información sobre cómo interactúas con la aplicación para mejorar la experiencia del usuario.' },
                    ],
                },
                {
                    icon: 'options-outline',
                    title: '2. Cómo Usamos tu Información',
                    content: 'Utilizamos tus datos para los siguientes fines:',
                    items: [
                        { label: 'Provisión del Servicio', text: 'Crear y gestionar tu cuenta, permitirte administrar academias y jugadores, y procesar la lógica de negocio (asistencias, pagos).' },
                        { label: 'Comunicación', text: 'Enviarte notificaciones importantes sobre tu cuenta, actualizaciones de seguridad o cambios en el servicio.' },
                        { label: 'Mejora del Servicio', text: 'Analizar tendencias y corregir errores para optimizar el rendimiento de la aplicación.' },
                        { label: 'Seguridad', text: 'Detectar y prevenir fraudes o accesos no autorizados.' },
                    ],
                },
                {
                    icon: 'share-social-outline',
                    title: '3. Compartir Información con Terceros',
                    content: 'No vendemos tus datos personales a terceros. Compartimos información solo con proveedores de servicios esenciales para la operación de la App:',
                    items: [
                        { label: 'Supabase', text: 'Utilizamos Supabase como nuestro proveedor de backend para autenticación y base de datos. Los datos se almacenan de forma segura en sus servidores.' },
                        { label: 'Cumplimiento Legal', text: 'Podemos divulgar tu información si así lo exige la ley o para proteger nuestros derechos.' },
                    ],
                },
                {
                    icon: 'time-outline',
                    title: '4. Retención y Eliminación de Datos',
                    items: [
                        { label: 'Retención', text: 'Conservamos tus datos mientras tu cuenta esté activa o sea necesario para prestar el servicio.' },
                        { label: 'Eliminación de Cuenta', text: 'Puedes solicitar la eliminación de tu cuenta en cualquier momento desde la sección Perfil > Configuración > Eliminar cuenta dentro de la aplicación.' },
                        { label: 'Período de Gracia', text: 'La eliminación es definitiva tras un período de gracia de 30 días.' },
                        { label: 'Eliminación Permanente', text: 'Pasados los 30 días, tus datos personales y los de tus academias (si eres el único propietario) serán eliminados permanentemente de nuestros sistemas.' },
                    ],
                },
                {
                    icon: 'shield-checkmark-outline',
                    title: '5. Seguridad de los Datos',
                    content: 'Implementamos medidas de seguridad técnicas y organizativas (como encriptación HTTPS en tránsito y RLS en base de datos) para proteger tus datos contra el acceso no autorizado, la alteración o la destrucción.',
                },
                {
                    icon: 'person-circle-outline',
                    title: '6. Tus Derechos',
                    content: 'Dependiendo de tu ubicación, puedes tener derecho a acceder, corregir, portar o eliminar tus datos personales. Para ejercer estos derechos, utiliza las herramientas dentro de la app o contáctanos.',
                },
                {
                    icon: 'mail-outline',
                    title: '7. Contacto',
                    content: 'Si tienes preguntas sobre esta Política de Privacidad, puedes contactarnos en:',
                    items: [
                        { label: 'Sitio Web', text: 'www.tenis-lab.com' },
                        { label: 'Email', text: 'gusgvillafane@gmail.com' },
                    ],
                },
            ],
        },
        en: {
            appTitle: 'Tenis-Lab',
            title: 'Privacy Policy',
            lastUpdate: 'Last updated: February 05, 2026',
            intro: 'At Tenis-Lab ("we", "us", "our", or "the Application"), we value your privacy and are committed to protecting your personal data. This Privacy Policy describes how we collect, use, and share your information when you use our mobile application and website (www.tenis-lab.com).',
            sections: [
                {
                    icon: 'list-circle-outline',
                    title: '1. Information We Collect',
                    content: 'We collect the following information to provide and improve our service:',
                    items: [
                        { label: 'Account Information', text: 'When you register, we collect your email address, full name, and password (encrypted).' },
                        { label: 'Profile Information', text: 'You may choose to provide additional information such as your phone number, city, country, and a profile picture.' },
                        { label: 'Academy Data', text: 'If you are an academy administrator, we store data about your players, attendance, payment plans, and academy structure.' },
                        { label: 'Usage Data', text: 'We may collect information about how you interact with the application to improve the user experience.' },
                    ],
                },
                {
                    icon: 'options-outline',
                    title: '2. How We Use Your Information',
                    content: 'We use your data for the following purposes:',
                    items: [
                        { label: 'Service Provision', text: 'Creating and managing your account, allowing you to manage academies and players, and processing business logic (attendance, payments).' },
                        { label: 'Communication', text: 'Sending you important notifications about your account, security updates, or service changes.' },
                        { label: 'Service Improvement', text: 'Analyzing trends and correcting errors to optimize the application\'s performance.' },
                        { label: 'Security', text: 'Detecting and preventing fraud or unauthorized access.' },
                    ],
                },
                {
                    icon: 'share-social-outline',
                    title: '3. Sharing Information with Third Parties',
                    content: 'We do not sell your personal data to third parties. We share information only with essential service providers for the App\'s operation:',
                    items: [
                        { label: 'Supabase', text: 'We use Supabase as our backend provider for authentication and database. Data is stored securely on their servers.' },
                        { label: 'Legal Compliance', text: 'We may disclose your information if required by law or to protect our rights.' },
                    ],
                },
                {
                    icon: 'time-outline',
                    title: '4. Data Retention and Deletion',
                    items: [
                        { label: 'Retention', text: 'We keep your data for as long as your account is active or as necessary to provide the service.' },
                        { label: 'Account Deletion', text: 'You can request account deletion at any time from the Profile > Settings > Delete Account section within the app.' },
                        { label: 'Grace Period', text: 'Deletion is final after a 30-day grace period.' },
                        { label: 'Permanent Deletion', text: 'After 30 days, your personal data and those of your academies (if you are the sole owner) will be permanently deleted from our systems.' },
                    ],
                },
                {
                    icon: 'shield-checkmark-outline',
                    title: '5. Data Security',
                    content: 'We implement technical and organizational security measures (such as HTTPS encryption in transit and RLS in the database) to protect your data against unauthorized access, alteration, or destruction.',
                },
                {
                    icon: 'person-circle-outline',
                    title: '6. Your Rights',
                    content: 'Depending on your location, you may have the right to access, correct, port, or delete your personal data. To exercise these rights, use the tools within the app or contact us.',
                },
                {
                    icon: 'mail-outline',
                    title: '7. Contact',
                    content: 'If you have questions about this Privacy Policy, you can contact us at:',
                    items: [
                        { label: 'Website', text: 'www.tenis-lab.com' },
                        { label: 'Email', text: 'gusgvillafane@gmail.com' },
                    ],
                },
            ],
        },
    };

    const data = isSpanish ? content.es : content.en;

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            {/* Elegant Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={styles.backButton}
                    activeOpacity={0.7}
                >
                    <Ionicons name="chevron-back" size={28} color={colors.neutral[900]} />
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerTitle}>{data.title}</Text>
                    <Text style={styles.headerSubtitle}>{data.appTitle}</Text>
                </View>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                <View style={styles.introCard}>
                    <Ionicons name="shield-half-outline" size={48} color={colors.primary[500]} style={styles.introIcon} />
                    <Text style={styles.lastUpdate}>{data.lastUpdate}</Text>
                    <Text style={styles.introText}>{data.intro}</Text>
                </View>

                {data.sections.map((section, idx) => (
                    <View key={idx} style={styles.sectionContainer}>
                        <View style={styles.sectionHeader}>
                            <View style={styles.iconContainer}>
                                <Ionicons name={section.icon as any} size={22} color={colors.primary[600]} />
                            </View>
                            <Text style={styles.sectionTitle}>{section.title}</Text>
                        </View>

                        <View style={styles.sectionBody}>
                            {section.content && (
                                <Text style={styles.sectionContentText}>{section.content}</Text>
                            )}

                            {section.items && section.items.map((item, i) => (
                                <View key={i} style={styles.listItem}>
                                    <View style={styles.listItemIndicator}>
                                        <View style={styles.bullet} />
                                    </View>
                                    <View style={styles.listItemContent}>
                                        <Text style={styles.itemLabel}>{item.label}</Text>
                                        <Text style={styles.itemText}>{item.text}</Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                ))}

                <View style={styles.legalFooter}>
                    <View style={styles.divider} />
                    <Text style={styles.legalText}>
                        Tenis-Lab App © 2026. Todos los derechos reservados.
                    </Text>
                    <Text style={styles.legalSubtitle}>
                        Tu privacidad es nuestra prioridad.
                    </Text>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.neutral[50],
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 60,
        paddingBottom: spacing.md,
        paddingHorizontal: spacing.xl,
        backgroundColor: colors.common.white,
        borderBottomWidth: 1,
        borderBottomColor: colors.neutral[100],
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.neutral[50],
    },
    headerTitleContainer: {
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: typography.size.md,
        fontWeight: '800',
        color: colors.neutral[900],
        marginBottom: 2,
    },
    headerSubtitle: {
        fontSize: 10,
        fontWeight: '600',
        color: colors.primary[600],
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    scrollContent: {
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.lg,
        paddingBottom: 40,
    },
    introCard: {
        backgroundColor: colors.common.white,
        borderRadius: 24,
        padding: spacing.lg,
        marginBottom: spacing.xl,
        alignItems: 'center',
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: colors.primary[200],
    },
    introIcon: {
        marginBottom: spacing.md,
    },
    lastUpdate: {
        fontSize: 11,
        fontWeight: '700',
        color: colors.neutral[400],
        marginBottom: spacing.sm,
        textTransform: 'uppercase',
    },
    introText: {
        fontSize: typography.size.sm,
        color: colors.neutral[600],
        lineHeight: 22,
    },
    sectionContainer: {
        marginBottom: spacing.xl,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: colors.primary[100],
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.sm,
    },
    sectionTitle: {
        fontSize: typography.size.md,
        fontWeight: '700',
        color: colors.neutral[900],
    },
    sectionBody: {
        paddingLeft: spacing.sm,
    },
    sectionContentText: {
        fontSize: typography.size.sm,
        color: colors.neutral[700],
        lineHeight: 22,
        marginBottom: spacing.md,
    },
    listItem: {
        flexDirection: 'row',
        marginBottom: spacing.md,
    },
    listItemIndicator: {
        paddingTop: 8,
        marginRight: spacing.sm,
    },
    bullet: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: colors.primary[400],
    },
    listItemContent: {
        flex: 1,
    },
    itemLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: colors.neutral[800],
        marginBottom: 2,
    },
    itemText: {
        fontSize: 13,
        color: colors.neutral[600],
        lineHeight: 18,
    },
    legalFooter: {
        marginTop: spacing.xl,
        alignItems: 'center',
    },
    divider: {
        width: '40%',
        height: 1,
        backgroundColor: colors.neutral[200],
        marginBottom: spacing.lg,
    },
    legalText: {
        fontSize: 11,
        color: colors.neutral[500],
        textAlign: 'center',
    },
    legalSubtitle: {
        fontSize: 10,
        fontWeight: '600',
        color: colors.primary[400],
        marginTop: 4,
        textTransform: 'uppercase',
    },
});
