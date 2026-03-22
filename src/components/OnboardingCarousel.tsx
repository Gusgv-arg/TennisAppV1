import { Ionicons } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import { FlatList, ListRenderItem, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { spacing } from '../design';
import { Theme } from '../design/theme';
import { useTheme } from '../hooks/useTheme';

interface SlideData {
    id: number;
    title: string;
    step?: string;
    image?: any;
    iconName?: keyof typeof Ionicons.glyphMap;
    features: {
        icon: keyof typeof Ionicons.glyphMap;
        text: string;
        boldText: string;
        alert?: boolean;
    }[];
}

const slides: SlideData[] = [
    {
        id: 2,
        title: 'Configuración',
        step: 'PASO 1',
        iconName: 'settings-outline',
        features: [
            {
                icon: 'school-outline',
                text: 'Definí el nombre de tu academia o da de alta nuevas.',
                boldText: 'Academias:'
            },
            {
                icon: 'pricetag-outline',
                text: 'Creá tus packs por hora o mensuales con sus precios.',
                boldText: 'Planes de Pago:'
            },
            {
                icon: 'map-outline',
                text: 'Cargá tus sedes y canchas donde das clases.',
                boldText: 'Ubicaciones:'
            },
            {
                icon: 'people-outline',
                text: 'Invitá colaboradores (admins, profes) con distintos permisos.',
                boldText: 'Equipo:'
            }
        ]
    },
    {
        id: 3,
        title: 'Alumnos',
        step: 'PASO 2',
        iconName: 'people-outline',
        features: [
            {
                icon: 'person-add-outline',
                text: 'Agregá alumnos en segundos. Asignales planes y nivel de juego.',
                boldText: 'Alta Rápida:'
            },
            {
                icon: 'people-circle-outline',
                text: 'Organizá grupos (ej. "Escuelita") con sus propios planes.',
                boldText: 'Grupos de Entrenamiento:'
            },
            {
                icon: 'wallet-outline',
                text: 'Vinculá varios alumnos bajo un mismo titular para unificar sus estados de cuenta.',
                boldText: 'Grupos de Pago:'
            }
        ]
    },
    {
        id: 4,
        title: 'Calendario',
        step: 'PASO 3',
        iconName: 'calendar-outline',
        features: [
            {
                icon: 'calendar-outline',
                text: 'Programá clases individuales o repetitivas.',
                boldText: 'Agenda de Clases:'
            },
            {
                icon: 'calendar-number-outline',
                text: 'Editá o borrá clases seleccionando un período (masivo).',
                boldText: 'Ediciones Masivas:'
            },
            {
                icon: 'checkmark-circle-outline',
                text: 'Tomá asistencia por alumno muy fácilmente.',
                boldText: 'Presentismo:'
            },
            {
                icon: 'alert-circle-outline',
                text: 'La edición masiva deja registro de todo por seguridad.',
                boldText: 'IMPORTANTE:',
                alert: true
            }
        ]
    },
    {
        id: 3.5,
        title: 'Análisis de Video',
        step: 'PASO 4',
        iconName: 'videocam-outline',
        features: [
            {
                icon: 'videocam-outline',
                text: 'Grabá a tus alumnos o subí videos desde tu galería.',
                boldText: 'Filmar y Subir:'
            },
            {
                icon: 'analytics-outline',
                text: 'Generá reportes de técnica detallados.',
                boldText: 'Analizar Técnica:'
            },
            {
                icon: 'phone-portrait-outline',
                text: 'Compartí el análisis y tus alumnos podrán ver su evolución en la App.',
                boldText: 'Visión del Alumno:'
            },
            {
                icon: 'library-outline',
                text: 'Guardá videos de ejemplo para ilustrar a tus alumnos.',
                boldText: 'Biblioteca General:'
            }
        ]
    },
    {
        id: 5,
        title: 'Cobros',
        step: 'PASO 5',
        iconName: 'card-outline',
        features: [
            {
                icon: 'person-remove-outline',
                text: 'Identificá rápido quién debe con su monto.',
                boldText: 'Deudores:'
            },
            {
                icon: 'cash-outline',
                text: 'Registrá pagos parciales o totales.',
                boldText: 'Registro Flexible:'
            },
            {
                icon: 'time-outline',
                text: 'Revisá los movimientos pasados de cada cuenta.',
                boldText: 'Historial:'
            },
            {
                icon: 'alert-circle-outline',
                text: 'La deuda se genera al consumarse el hecho (clase o fin de mes).',
                boldText: 'IMPORTANTE:',
                alert: true
            }
        ]
    },
    {
        id: 6,
        title: 'Dashboard',
        iconName: 'home-outline',
        features: [
            {
                icon: 'stats-chart-outline',
                text: 'Panel de control general para dueños y coordinadores.',
                boldText: 'Tu Negocio:'
            },
            {
                icon: 'grid-outline',
                text: 'Las clases del día, los cobros y deudas al mes en curso, cantidad de alumnos, grupos y equipo.',
                boldText: 'Métricas:'
            },
            {
                icon: 'bar-chart-outline',
                text: 'Sección de estadísticas con historial de clases e ingresos (en desarrollo).',
                boldText: 'Estadísticas:'
            }
        ]
    }
];

interface OnboardingCarouselProps {
    onFinish: () => void;
}

export default function OnboardingCarousel({ onFinish }: OnboardingCarouselProps) {
    const { theme } = useTheme();
    const [currentIndex, setCurrentIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);
    const [layout, setLayout] = useState<{ width: number; height: number } | null>(null);
    const { width: windowWidth } = useWindowDimensions();

    const isWide = (layout?.width || windowWidth) >= 768;
    // Explicit sizing derived from onLayout or fallback
    const containerWidth = layout?.width || windowWidth;
    // Reserved footer space: reduced to 110px for better vertical fit
    const contentHeight = layout ? layout.height - 110 : 500;

    // Mobile config: Image takes 45% of available vertical space
    const imageAndTextGap = 0;
    const mobileImageHeight = contentHeight * 0.45;
    const mobileTextHeight = contentHeight * 0.55;

    const handleNext = () => {
        if (currentIndex < slides.length - 1) {
            flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
            setCurrentIndex(currentIndex + 1);
        } else {
            onFinish();
        }
    };

    const onLayout = (event: any) => {
        const { width, height } = event.nativeEvent.layout;
        // Only update if dimensions fundamentally change to prevent loops
        if (!layout || Math.abs(layout.width - width) > 10 || Math.abs(layout.height - height) > 10) {
            setLayout({ width, height });
        }
    };

    const handleDotPress = (index: number) => {
        flatListRef.current?.scrollToIndex({ index, animated: true });
        setCurrentIndex(index);
    };

    const getItemLayout = (data: any, index: number) => ({
        length: containerWidth,
        offset: containerWidth * index,
        index,
    });

    const renderItem: ListRenderItem<SlideData> = ({ item }) => {
        // Desktop: Row. Mobile: Column.
        return (
            <View style={{
                width: containerWidth,
                height: layout ? layout.height : '100%',
                justifyContent: 'center',
                alignItems: 'center',
                paddingBottom: 60,
                overflow: 'hidden'
            }}>
                <View style={{
                    width: '100%',
                    maxWidth: 1200, // Max content width
                    height: contentHeight, // Reserve space for footer
                    flexDirection: isWide ? 'row' : 'column',
                    justifyContent: 'center',
                    alignItems: 'center', // Esto centra TODO el conjunto (Icono + Texto) en la pantalla
                    paddingHorizontal: isWide ? spacing.xl : spacing.md,
                }}>
                    {/* ICON BLOCK */}
                    <View style={{
                        marginRight: isWide ? 60 : 0, // Separación exacta entre icono y texto en desktop
                        marginBottom: isWide ? 0 : spacing.xl,
                        marginTop: 0, // Removido para que quede mejor centrado con el texto
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        {item.iconName && (
                            <View style={{
                                width: isWide ? 160 : 120,
                                height: isWide ? 160 : 120,
                                borderRadius: isWide ? 80 : 60,
                                backgroundColor: theme.components.button.secondary.bg,
                                justifyContent: 'center',
                                alignItems: 'center',
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.2,
                                shadowRadius: 8,
                                elevation: 6
                            }}>
                                <Ionicons name={item.iconName} size={isWide ? 80 : 60} color={theme.components.button.secondary.text} />
                            </View>
                        )}
                    </View>

                    {/* TEXT BLOCK */}
                    <View style={{
                        maxWidth: isWide ? 500 : '100%', // Limita el ancho del texto para que no se estire y permita centrar el bloque
                        justifyContent: 'center',
                        alignItems: isWide ? 'flex-start' : 'center',
                    }}>
                        <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            marginBottom: spacing.md,
                            justifyContent: isWide ? 'flex-start' : 'center',
                            gap: 12,
                            flexWrap: 'wrap'
                        }}>
                            {item.step && (
                                <View style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 6,
                                    // Small adjustment to visually align with larger title text
                                    marginTop: 2
                                }}>
                                    <Ionicons name="layers-outline" size={isWide ? 22 : 18} color={theme.components.button.primary.bg} />
                                    <Text style={{
                                        fontSize: isWide ? 14 : 12,
                                        fontWeight: '800',
                                        color: theme.components.button.primary.bg,
                                        textTransform: 'uppercase',
                                        letterSpacing: 0.5
                                    }}>
                                        {item.step}
                                    </Text>
                                </View>
                            )}
                            <Text style={{ fontSize: isWide ? 22 : 18, color: theme.text.tertiary, marginTop: 2 }}>—</Text>
                            <Text style={{
                                fontSize: isWide ? 28 : 22,
                                fontWeight: 'bold',
                                color: theme.text.primary,
                                lineHeight: isWide ? 34 : 28,
                                textAlign: isWide ? 'left' : 'center'
                            }}>
                                {item.title}
                            </Text>
                        </View>
                        <View style={styles.featuresList}>
                            {item.features.map((feature, idx) => (
                                <View key={idx} style={styles.featureItem}>
                                    <Ionicons
                                        name={feature.icon}
                                        size={isWide ? 24 : 18}
                                        color={feature.alert ? theme.status.error : theme.components.button.primary.bg}
                                        style={styles.featureIcon}
                                    />
                                    <Text style={[
                                        styles.featureText,
                                        { fontSize: isWide ? 16 : 14 },
                                        feature.alert && styles.alertText
                                    ]}>
                                        <Text style={styles.boldText}>{feature.boldText} </Text>
                                        {feature.text}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </View>
                </View>
            </View>
        );
    };

    const styles = React.useMemo(() => createStyles(theme, isWide), [theme, isWide]);

    return (
        <View style={styles.container} onLayout={onLayout}>
            {layout && (
                <FlatList
                    ref={flatListRef}
                    data={slides}
                    renderItem={renderItem}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={(item) => item.id.toString()}
                    getItemLayout={getItemLayout}
                    extraData={containerWidth} // Trigger re-render on width change
                    onMomentumScrollEnd={(event) => {
                        const index = Math.round(event.nativeEvent.contentOffset.x / containerWidth);
                        setCurrentIndex(index);
                    }}
                    scrollEventThrottle={16}
                    style={{ flex: 1 }}
                />
            )}

            {/* Button (Absolute Footer) */}
            <View style={styles.footer}>
                {/* Pagination Removed */}

                {(isWide || currentIndex === slides.length - 1) && (
                    <TouchableOpacity
                        style={styles.button}
                        onPress={handleNext}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.buttonText}>
                            {currentIndex === slides.length - 1 ? 'Comenzar' : 'Siguiente'}
                        </Text>
                        <Ionicons
                            name={currentIndex === slides.length - 1 ? "rocket-outline" : "arrow-forward"}
                            size={isWide ? 16 : 20}
                            color={theme.components.button.primary.text}
                            style={{ marginLeft: 8 }}
                        />
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}

const createStyles = (theme: Theme, isWide: boolean) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.background.default,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: theme.text.primary,
        marginBottom: spacing.lg,
    },
    featuresList: {
        gap: spacing.md,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    featureIcon: {
        marginTop: 2,
        marginRight: spacing.sm,
        minWidth: 24,
    },
    featureText: {
        color: theme.text.secondary,
        lineHeight: 22,
        flex: 1,
    },
    boldText: {
        fontWeight: 'bold',
        color: theme.text.primary,
    },
    alertText: {
        color: theme.status.error,
        fontStyle: 'italic',
    },
    footer: {
        position: 'absolute',
        bottom: 12,
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    button: {
        backgroundColor: theme.components.button.primary.bg,
        borderRadius: 30,
        height: isWide ? 44 : 56,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: isWide ? 24 : 48,
        minWidth: isWide ? 140 : 200,
        elevation: 4,
        shadowColor: theme.components.button.primary.bg,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    buttonText: {
        color: theme.components.button.primary.text,
        fontSize: isWide ? 15 : 18,
        fontWeight: 'bold',
    },
    stepBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.components.button.primary.bg + '15',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        marginBottom: spacing.xs,
    },
    stepText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: theme.components.button.primary.bg,
        letterSpacing: 0.5,
    },
});
