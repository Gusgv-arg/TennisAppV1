import { Ionicons } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import { FlatList, ListRenderItem, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { spacing } from '../design';
import { Theme } from '../design/theme';
import { useTheme } from '../hooks/useTheme';

interface SlideData {
    id: number;
    titleKey: string;
    stepKey?: string;
    image?: any;
    iconName?: keyof typeof Ionicons.glyphMap;
    features: {
        icon: keyof typeof Ionicons.glyphMap;
        titleKey: string;
        textKey: string;
        alert?: boolean;
    }[];
}

const getSlides = (t: any): SlideData[] => [
    {
        id: 2,
        titleKey: 'dashboard.onboarding.slides.config.title',
        stepKey: '1',
        iconName: 'settings-outline',
        features: [
            {
                icon: 'school-outline',
                textKey: 'dashboard.onboarding.slides.config.academiesDesc',
                titleKey: 'dashboard.onboarding.slides.config.academies'
            },
            {
                icon: 'pricetag-outline',
                textKey: 'dashboard.onboarding.slides.config.plansDesc',
                titleKey: 'dashboard.onboarding.slides.config.plans'
            },
            {
                icon: 'map-outline',
                textKey: 'dashboard.onboarding.slides.config.locationsDesc',
                titleKey: 'dashboard.onboarding.slides.config.locations'
            },
            {
                icon: 'people-outline',
                textKey: 'dashboard.onboarding.slides.config.teamDesc',
                titleKey: 'dashboard.onboarding.slides.config.team'
            }
        ]
    },
    {
        id: 3,
        titleKey: 'dashboard.onboarding.slides.players.title',
        stepKey: '2',
        iconName: 'people-outline',
        features: [
            {
                icon: 'person-add-outline',
                textKey: 'dashboard.onboarding.slides.players.quickAddDesc',
                titleKey: 'dashboard.onboarding.slides.players.quickAdd'
            },
            {
                icon: 'people-circle-outline',
                textKey: 'dashboard.onboarding.slides.players.groupsDesc',
                titleKey: 'dashboard.onboarding.slides.players.groups'
            },
            {
                icon: 'wallet-outline',
                textKey: 'dashboard.onboarding.slides.players.paymentGroupsDesc',
                titleKey: 'dashboard.onboarding.slides.players.paymentGroups'
            }
        ]
    },
    {
        id: 4,
        titleKey: 'dashboard.onboarding.slides.calendar.title',
        stepKey: '3',
        iconName: 'calendar-outline',
        features: [
            {
                icon: 'calendar-outline',
                textKey: 'dashboard.onboarding.slides.calendar.agendaDesc',
                titleKey: 'dashboard.onboarding.slides.calendar.agenda'
            },
            {
                icon: 'calendar-number-outline',
                textKey: 'dashboard.onboarding.slides.calendar.bulkEditDesc',
                titleKey: 'dashboard.onboarding.slides.calendar.bulkEdit'
            },
            {
                icon: 'checkmark-circle-outline',
                textKey: 'dashboard.onboarding.slides.calendar.attendanceDesc',
                titleKey: 'dashboard.onboarding.slides.calendar.attendance'
            },
            {
                icon: 'alert-circle-outline',
                textKey: 'dashboard.onboarding.slides.calendar.bulkEditWarning',
                titleKey: 'dashboard.onboarding.slides.calendar.important',
                alert: true
            }
        ]
    },
    {
        id: 3.5,
        titleKey: 'dashboard.onboarding.slides.analysis.title',
        stepKey: '4',
        iconName: 'videocam-outline',
        features: [
            {
                icon: 'videocam-outline',
                textKey: 'dashboard.onboarding.slides.analysis.recordDesc',
                titleKey: 'dashboard.onboarding.slides.analysis.record'
            },
            {
                icon: 'analytics-outline',
                textKey: 'dashboard.onboarding.slides.analysis.analyzeDesc',
                titleKey: 'dashboard.onboarding.slides.analysis.analyze'
            },
            {
                icon: 'phone-portrait-outline',
                textKey: 'dashboard.onboarding.slides.analysis.studentViewDesc',
                titleKey: 'dashboard.onboarding.slides.analysis.studentView'
            },
            {
                icon: 'library-outline',
                textKey: 'dashboard.onboarding.slides.analysis.libraryDesc',
                titleKey: 'dashboard.onboarding.slides.analysis.library'
            }
        ]
    },
    {
        id: 5,
        titleKey: 'dashboard.onboarding.slides.payments.title',
        stepKey: '5',
        iconName: 'card-outline',
        features: [
            {
                icon: 'person-remove-outline',
                textKey: 'dashboard.onboarding.slides.payments.debtorsDesc',
                titleKey: 'dashboard.onboarding.slides.payments.debtors'
            },
            {
                icon: 'cash-outline',
                textKey: 'dashboard.onboarding.slides.payments.flexibleDesc',
                titleKey: 'dashboard.onboarding.slides.payments.flexible'
            },
            {
                icon: 'time-outline',
                textKey: 'dashboard.onboarding.slides.payments.historyDesc',
                titleKey: 'dashboard.onboarding.slides.payments.history'
            },
            {
                icon: 'alert-circle-outline',
                textKey: 'dashboard.onboarding.slides.payments.debtGeneration',
                titleKey: 'dashboard.onboarding.slides.payments.important',
                alert: true
            }
        ]
    },
    {
        id: 6,
        titleKey: 'dashboard.onboarding.slides.dashboard.title',
        stepKey: '6',
        iconName: 'home-outline',
        features: [
            {
                icon: 'stats-chart-outline',
                textKey: 'dashboard.onboarding.slides.dashboard.businessDesc',
                titleKey: 'dashboard.onboarding.slides.dashboard.business'
            },
            {
                icon: 'grid-outline',
                textKey: 'dashboard.onboarding.slides.dashboard.metricsDesc',
                titleKey: 'dashboard.onboarding.slides.dashboard.metrics'
            },
            {
                icon: 'bar-chart-outline',
                textKey: 'dashboard.onboarding.slides.dashboard.statsDesc',
                titleKey: 'dashboard.onboarding.slides.dashboard.stats'
            }
        ]
    }
];

interface OnboardingCarouselProps {
    onFinish: () => void;
}

export default function OnboardingCarousel({ onFinish }: OnboardingCarouselProps) {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const slides = getSlides(t);
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
                paddingBottom: isWide ? 60 : 40,
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
                        marginBottom: isWide ? 0 : spacing.sm,
                        marginTop: 0, // Removido para que quede mejor centrado con el texto
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        {item.iconName && (
                            <View style={{
                                width: isWide ? 160 : 90,
                                height: isWide ? 160 : 90,
                                borderRadius: isWide ? 80 : 45,
                                backgroundColor: theme.components.button.secondary.bg,
                                justifyContent: 'center',
                                alignItems: 'center',
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.2,
                                shadowRadius: 8,
                                elevation: 6
                            }}>
                                <Ionicons name={item.iconName} size={isWide ? 80 : 45} color={theme.components.button.secondary.text} />
                            </View>
                        )}
                    </View>

                    {/* TEXT BLOCK */}
                    <View style={{
                        maxWidth: isWide ? 500 : '100%', // Limita el ancho del texto para que no se estire y permita centrar el bloque
                        justifyContent: 'center',
                        alignItems: 'flex-start',
                    }}>                        <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            marginBottom: spacing.md,
                            justifyContent: 'flex-start',
                            gap: 8,
                            flexWrap: 'wrap'
                        }}>
                            {item.stepKey && (
                                <View style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 8,
                                    // Small adjustment to visually align with larger title text
                                    marginTop: 2
                                }}>
                                    <Ionicons name="layers-outline" size={isWide ? 28 : 22} color={theme.components.button.secondary.bg} />
                                    <Text style={{
                                        fontSize: isWide ? 28 : 22,
                                        fontWeight: '800',
                                        color: theme.components.button.secondary.bg,
                                        textTransform: 'uppercase',
                                        letterSpacing: 0.5
                                    }}>
                                        {t('dashboard.onboarding.step', { step: item.stepKey })}
                                    </Text>
                                </View>
                            )}
                            <Text style={{ fontSize: isWide ? 28 : 22, color: theme.text.tertiary, marginTop: 2 }}>—</Text>
                            <Text style={{
                                fontSize: isWide ? 28 : 22,
                                fontWeight: 'bold',
                                color: theme.text.primary,
                                lineHeight: isWide ? 34 : 28,
                                textAlign: 'left'
                            }}>
                                {t(item.titleKey)}
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
                                        <Text style={styles.boldText}>{t(feature.titleKey)} </Text>
                                        {t(feature.textKey)}
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
                {!isWide && (
                    <View style={{
                        flexDirection: 'row',
                        gap: 8,
                        marginBottom: 16, // Extra space if button is also shown
                        justifyContent: 'center'
                    }}>
                        {slides.map((_, index) => (
                            <TouchableOpacity
                                key={index}
                                onPress={() => handleDotPress(index)}
                                style={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: 3,
                                    backgroundColor: 'white',
                                    opacity: currentIndex === index ? 1 : 0.3
                                }}
                            />
                        ))}
                    </View>
                )}

                {(isWide || currentIndex === slides.length - 1) && (
                    <TouchableOpacity
                        style={styles.button}
                        onPress={handleNext}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.buttonText}>
                            {currentIndex === slides.length - 1 ? t('dashboard.onboarding.finish') : t('dashboard.onboarding.next')}
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
