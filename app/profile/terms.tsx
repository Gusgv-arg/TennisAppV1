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

export default function TermsScreen() {
    const { i18n } = useTranslation();
    const router = useRouter();
    const isSpanish = i18n.language === 'es';

    const content = {
        es: {
            appTitle: 'Tenis-Lab',
            title: 'Términos y Condiciones',
            lastUpdate: 'Última actualización: 05 de Febrero de 2026',
            intro: 'Al utilizar Tenis-Lab, aceptas los siguientes Términos y Condiciones. Te recomendamos leerlos detenidamente.',
            sections: [
                {
                    icon: 'checkmark-circle-outline',
                    title: '1. Aceptación de los Términos',
                    content: 'Al crear una cuenta o utilizar Tenis-Lab, aceptas cumplir con estos Términos y Condiciones y nuestra Política de Privacidad. Si no estás de acuerdo, no debes utilizar la aplicación.',
                },
                {
                    icon: 'tennisball-outline',
                    title: '2. Descripción del Servicio',
                    content: 'Tenis-Lab es una plataforma de gestión para profesores y academias de tenis que permite:',
                    items: [
                        { label: 'Administrar', text: 'academias, grupos y jugadores.' },
                        { label: 'Registrar', text: 'asistencias a clases.' },
                        { label: 'Gestionar', text: 'planes de pago y cobros.' },
                        { label: 'Visualizar', text: 'estadísticas y dashboard de gestión.' },
                    ],
                },
                {
                    icon: 'person-outline',
                    title: '3. Cuentas de Usuario',
                    items: [
                        { label: 'Información veraz', text: 'Debes proporcionar información veraz y actualizada al registrarte.' },
                        { label: 'Confidencialidad', text: 'Eres responsable de mantener la confidencialidad de tu contraseña.' },
                        { label: 'No compartir', text: 'No puedes compartir tu cuenta con terceros.' },
                        { label: 'Notificar', text: 'Debes notificarnos inmediatamente si sospechas de un uso no autorizado.' },
                    ],
                },
                {
                    icon: 'hand-left-outline',
                    title: '4. Uso Aceptable',
                    content: 'Te comprometes a:',
                    items: [
                        { label: 'Fines legítimos', text: 'Usar la app solo para fines legítimos de gestión deportiva.' },
                        { label: 'Contenido apropiado', text: 'No subir contenido ilegal, ofensivo o que viole derechos de terceros.' },
                        { label: 'Privacidad', text: 'No intentar acceder a cuentas o datos de otros usuarios.' },
                        { label: 'Seguridad', text: 'No realizar ingeniería inversa ni intentar vulnerar la seguridad del sistema.' },
                    ],
                },
                {
                    icon: 'document-text-outline',
                    title: '5. Contenido y Propiedad de Datos',
                    items: [
                        { label: 'Tus datos', text: 'Los datos que ingreses (jugadores, asistencias, pagos) son de tu propiedad.' },
                        { label: 'Licencia de uso', text: 'Nos otorgas una licencia para almacenar y procesar esos datos con el fin de brindarte el servicio.' },
                        { label: 'Propiedad intelectual', text: 'El código, diseño y marca de Tenis-Lab son propiedad exclusiva de sus creadores.' },
                    ],
                },
                {
                    icon: 'cash-outline',
                    title: '6. Pagos y Transacciones',
                    items: [
                        { label: 'Registro', text: 'Tenis-Lab facilita el registro de cobros entre academias y jugadores.' },
                        { label: 'Sin procesamiento', text: 'No procesamos pagos directamente; solo registramos la información que tú ingresas.' },
                        { label: 'Disputas', text: 'No somos responsables de disputas de pago entre academias y sus jugadores.' },
                    ],
                },
                {
                    icon: 'alert-circle-outline',
                    title: '7. Limitación de Responsabilidad',
                    items: [
                        { label: 'Tal cual', text: 'Tenis-Lab se proporciona "tal cual", sin garantías de disponibilidad continua.' },
                        { label: 'Sin responsabilidad', text: 'No somos responsables por pérdidas de datos, interrupciones del servicio ni daños indirectos.' },
                        { label: 'Mejor esfuerzo', text: 'En caso de fallas técnicas, haremos nuestro mejor esfuerzo para restaurar el servicio.' },
                    ],
                },
                {
                    icon: 'close-circle-outline',
                    title: '8. Suspensión y Cancelación',
                    content: 'Nos reservamos el derecho de suspender o eliminar tu cuenta si:',
                    items: [
                        { label: 'Violación', text: 'Violas estos Términos y Condiciones.' },
                        { label: 'Actividades ilegales', text: 'Utilizas la app para actividades ilegales o fraudulentas.' },
                        { label: 'Inactividad', text: 'No utilizas la cuenta por un período prolongado (más de 12 meses).' },
                    ],
                },
                {
                    icon: 'create-outline',
                    title: '9. Modificaciones',
                    content: 'Podemos actualizar estos Términos ocasionalmente. Te notificaremos sobre cambios importantes. El uso continuado de la app después de las modificaciones implica tu aceptación.',
                },
                {
                    icon: 'mail-outline',
                    title: '10. Contacto',
                    content: 'Si tienes preguntas sobre estos Términos, contáctanos en:',
                    items: [
                        { label: 'Sitio Web', text: 'www.tenis-lab.com' },
                        { label: 'Email', text: 'gusgvillafane@gmail.com' },
                    ],
                },
            ],
        },
        en: {
            appTitle: 'Tenis-Lab',
            title: 'Terms and Conditions',
            lastUpdate: 'Last updated: February 05, 2026',
            intro: 'By using Tenis-Lab, you agree to the following Terms and Conditions. We recommend reading them carefully.',
            sections: [
                {
                    icon: 'checkmark-circle-outline',
                    title: '1. Acceptance of Terms',
                    content: 'By creating an account or using Tenis-Lab, you agree to comply with these Terms and Conditions and our Privacy Policy. If you do not agree, you should not use the application.',
                },
                {
                    icon: 'tennisball-outline',
                    title: '2. Service Description',
                    content: 'Tenis-Lab is a management platform for tennis coaches and academies that allows:',
                    items: [
                        { label: 'Manage', text: 'academies, groups, and players.' },
                        { label: 'Record', text: 'class attendance.' },
                        { label: 'Handle', text: 'payment plans and billing.' },
                        { label: 'View', text: 'statistics and management dashboard.' },
                    ],
                },
                {
                    icon: 'person-outline',
                    title: '3. User Accounts',
                    items: [
                        { label: 'Accurate information', text: 'You must provide truthful and up-to-date information when registering.' },
                        { label: 'Confidentiality', text: 'You are responsible for maintaining the confidentiality of your password.' },
                        { label: 'No sharing', text: 'You may not share your account with third parties.' },
                        { label: 'Notify', text: 'You must notify us immediately if you suspect unauthorized use.' },
                    ],
                },
                {
                    icon: 'hand-left-outline',
                    title: '4. Acceptable Use',
                    content: 'You agree to:',
                    items: [
                        { label: 'Legitimate purposes', text: 'Use the app only for legitimate sports management purposes.' },
                        { label: 'Appropriate content', text: 'Not upload illegal, offensive content or that violates third-party rights.' },
                        { label: 'Privacy', text: 'Not attempt to access accounts or data of other users.' },
                        { label: 'Security', text: 'Not reverse engineer or attempt to breach the system security.' },
                    ],
                },
                {
                    icon: 'document-text-outline',
                    title: '5. Content and Data Ownership',
                    items: [
                        { label: 'Your data', text: 'The data you enter (players, attendance, payments) is your property.' },
                        { label: 'Usage license', text: 'You grant us a license to store and process that data to provide you with the service.' },
                        { label: 'Intellectual property', text: 'The code, design, and Tenis-Lab brand are the exclusive property of its creators.' },
                    ],
                },
                {
                    icon: 'cash-outline',
                    title: '6. Payments and Transactions',
                    items: [
                        { label: 'Recording', text: 'Tenis-Lab facilitates the recording of charges between academies and players.' },
                        { label: 'No processing', text: 'We do not process payments directly; we only record the information you enter.' },
                        { label: 'Disputes', text: 'We are not responsible for payment disputes between academies and their players.' },
                    ],
                },
                {
                    icon: 'alert-circle-outline',
                    title: '7. Limitation of Liability',
                    items: [
                        { label: 'As is', text: 'Tenis-Lab is provided "as is", without guarantees of continuous availability.' },
                        { label: 'No liability', text: 'We are not responsible for data loss, service interruptions, or indirect damages.' },
                        { label: 'Best effort', text: 'In case of technical failures, we will make our best effort to restore the service.' },
                    ],
                },
                {
                    icon: 'close-circle-outline',
                    title: '8. Suspension and Cancellation',
                    content: 'We reserve the right to suspend or delete your account if:',
                    items: [
                        { label: 'Violation', text: 'You violate these Terms and Conditions.' },
                        { label: 'Illegal activities', text: 'You use the app for illegal or fraudulent activities.' },
                        { label: 'Inactivity', text: 'You do not use the account for an extended period (more than 12 months).' },
                    ],
                },
                {
                    icon: 'create-outline',
                    title: '9. Modifications',
                    content: 'We may update these Terms occasionally. We will notify you of important changes. Continued use of the app after modifications implies your acceptance.',
                },
                {
                    icon: 'mail-outline',
                    title: '10. Contact',
                    content: 'If you have questions about these Terms, contact us at:',
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
                    <Ionicons name="document-text-outline" size={48} color={colors.primary[500]} style={styles.introIcon} />
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
                        Gracias por confiar en nosotros.
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
