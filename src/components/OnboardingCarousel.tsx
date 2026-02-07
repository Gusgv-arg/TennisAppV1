import { Ionicons } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import { FlatList, Image, ListRenderItem, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { colors, spacing } from '../design';

interface SlideData {
    id: number;
    title: string;
    step?: string;
    image: any;
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
        image: require('../../assets/images/onboarding/configuracion.png'),
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
        image: require('../../assets/images/onboarding/alumnos.png'),
        features: [
            {
                icon: 'person-add-outline',
                text: 'Agregá alumnos en segundos. Asignales planes y nivel de juego.',
                boldText: 'Alta Rápida:'
            },
            {
                icon: 'people-circle-outline',
                text: 'Organizá grupos (ej. "Escuelita") con sus propios planes.',
                boldText: 'Creación de Grupos:'
            }
        ]
    },
    {
        id: 4,
        title: 'Calendario',
        step: 'PASO 3',
        image: require('../../assets/images/onboarding/clases_calendar.png'),
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
        id: 5,
        title: 'Cobros',
        step: 'PASO 4',
        image: require('../../assets/images/onboarding/cobros.png'),
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
        image: require('../../assets/images/onboarding/dashboard.png'),
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
    const [currentIndex, setCurrentIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);
    const [layout, setLayout] = useState<{ width: number; height: number } | null>(null);
    const { width: windowWidth } = useWindowDimensions();

    const isWide = (layout?.width || windowWidth) >= 768;
    // Explicit sizing derived from onLayout or fallback
    const containerWidth = layout?.width || windowWidth;
    // Subtract explicit footer height (approx 80-100px) from content area if needed, 
    // or just let footer overlay. Let's reserve 80px for footer.
    const contentHeight = layout ? layout.height - 80 : 500;

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
                justifyContent: 'flex-start',
                alignItems: 'center',
                overflow: 'hidden'
            }}>
                <View style={{
                    width: '100%',
                    maxWidth: 1200, // Max content width
                    height: contentHeight, // Reserve space for footer
                    flexDirection: isWide ? 'row' : 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: isWide ? spacing.xl : spacing.md,
                }}>
                    {/* IMAGE BLOCK */}
                    <View style={{
                        width: isWide ? '50%' : '100%',
                        height: isWide ? '100%' : mobileImageHeight,
                        justifyContent: isWide ? 'center' : 'flex-end', // Push image down on mobile
                        alignItems: isWide ? 'flex-end' : 'center',
                        // Reduced padding to bring image and text closer
                        paddingRight: isWide ? spacing.sm : 0,
                        marginBottom: isWide ? 0 : spacing.xl // Increased margin for mobile
                    }}>
                        <Image
                            source={item.image}
                            style={{
                                width: isWide ? '100%' : '100%',
                                height: isWide ? '100%' : '100%',
                                maxWidth: isWide ? 500 : undefined,
                                alignSelf: 'center'
                            }}
                            resizeMode="contain"
                        />
                    </View>

                    {/* TEXT BLOCK */}
                    <View style={{
                        width: isWide ? '50%' : '100%',
                        height: isWide ? '100%' : mobileTextHeight,
                        justifyContent: isWide ? 'center' : 'flex-start',
                        alignItems: isWide ? 'flex-start' : 'center',
                        paddingLeft: isWide ? spacing.sm : 0, // Reduced padding
                    }}>
                        {isWide ? (
                            // Desktop: Stacked (Badge above Title)
                            <>
                                {item.step && (
                                    <View style={styles.stepBadge}>
                                        <Ionicons name="layers-outline" size={14} color={colors.primary[700]} style={{ marginRight: 4 }} />
                                        <Text style={styles.stepText}>{item.step}</Text>
                                    </View>
                                )}
                                <Text style={[styles.title, { textAlign: 'left' }]}>
                                    {item.title}
                                </Text>
                            </>
                        ) : (
                            // Mobile: Row (Badge next to Title)
                            <View style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: spacing.lg,
                                flexWrap: 'wrap',
                                gap: 8
                            }}>
                                {item.step && (
                                    <View style={[styles.stepBadge, { marginBottom: 0 }]}>
                                        <Text style={styles.stepText}>{item.step}</Text>
                                    </View>
                                )}
                                <Text style={[styles.title, { marginBottom: 0, fontSize: 24, textAlign: 'center' }]}>
                                    {item.title}
                                </Text>
                            </View>
                        )}
                        <View style={styles.featuresList}>
                            {item.features.map((feature, idx) => (
                                <View key={idx} style={styles.featureItem}>
                                    <Ionicons
                                        name={feature.icon}
                                        size={isWide ? 24 : 18}
                                        color={feature.alert ? colors.error[500] : colors.primary[500]}
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

            {/* Pagination & Button (Absolute Footer) */}
            <View style={styles.footer}>
                <View style={styles.pagination}>
                    {slides.map((_, index) => (
                        <TouchableOpacity
                            key={index}
                            onPress={() => handleDotPress(index)}
                            activeOpacity={0.6}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <View
                                style={[
                                    styles.dot,
                                    index === currentIndex ? styles.activeDot : styles.inactiveDot,
                                ]}
                            />
                        </TouchableOpacity>
                    ))}
                </View>

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
                        size={20}
                        color={colors.common.white}
                        style={{ marginLeft: 8 }}
                    />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.common.white,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: colors.neutral[900],
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
        color: colors.neutral[600],
        lineHeight: 22,
        flex: 1,
    },
    boldText: {
        fontWeight: 'bold',
        color: colors.neutral[800],
    },
    alertText: {
        color: colors.error[600],
        fontStyle: 'italic',
    },
    footer: {
        position: 'absolute',
        bottom: 20,
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    pagination: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: spacing.lg,
    },
    dot: {
        height: 8,
        borderRadius: 4,
        marginHorizontal: 4,
    },
    activeDot: {
        width: 32,
        backgroundColor: colors.primary[500],
    },
    inactiveDot: {
        width: 8,
        backgroundColor: colors.neutral[200],
    },
    button: {
        backgroundColor: colors.primary[500],
        borderRadius: 30,
        height: 56,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 48,
        minWidth: 200,
        elevation: 4,
        shadowColor: colors.primary[500],
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    buttonText: {
        color: colors.common.white,
        fontSize: 18,
        fontWeight: 'bold',
    },
    stepBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primary[50],
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        marginBottom: spacing.xs,
        // Removed alignSelf: 'center' to respect parent alignment (left on desktop, center on mobile)
    },
    stepText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: colors.primary[700],
        letterSpacing: 0.5,
    },
});
