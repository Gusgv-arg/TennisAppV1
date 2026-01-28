import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Button } from '@/src/design/components/Button';
import { Card } from '@/src/design/components/Card';
import { Input } from '@/src/design/components/Input';
import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useAcademyMutations } from '@/src/features/academy/hooks/useAcademy';

export default function NewAcademyScreen() {
    const router = useRouter();
    const { createAcademy } = useAcademyMutations();

    const [name, setName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Auto-generate slug from name
    const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 50);

    const handleSubmit = async () => {
        if (!name.trim()) {
            setError('El nombre es requerido');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            await createAcademy.mutateAsync({
                name: name.trim(),
                slug,
            });
            router.replace('/academy' as any);
        } catch (err: any) {
            console.error('Error creating academy:', err);
            if (err?.code === '23505') {
                setError('Ya existe una academia con ese nombre');
            } else {
                setError(err?.message || 'Error al crear la academia');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <Stack.Screen
                options={{
                    headerTitle: () => (
                        <View style={styles.headerTitleContainer}>
                            <Ionicons name="add-circle" size={24} color={colors.primary[500]} style={{ marginRight: spacing.sm }} />
                            <Text style={styles.headerTitleText}>Nueva Academia</Text>
                        </View>
                    ),
                    headerTitleAlign: 'center',
                    headerLeft: () => (
                        <TouchableOpacity
                            onPress={() => router.back()}
                            style={{ marginLeft: spacing.sm }}
                        >
                            <Ionicons name="arrow-back" size={24} color={colors.neutral[900]} />
                        </TouchableOpacity>
                    ),
                    headerShown: true,
                }}
            />

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.contentWrapper}>
                    {/* Info Card */}
                    <Card style={styles.infoCard} padding="md">
                        <View style={styles.infoContent}>
                            <Ionicons name="information-circle" size={24} color={colors.secondary[500]} />
                            <Text style={styles.infoText}>
                                Al crear una academia, serás el propietario. Podrás invitar colaboradores desde la sección Equipo.
                            </Text>
                        </View>
                    </Card>

                    {/* Form */}
                    <Card style={styles.formCard} padding="xl">
                        <Text style={styles.sectionTitle}>Información de la Academia</Text>

                        <Input
                            label="Nombre de la Academia"
                            placeholder="Ej: Club de Tenis Los Pinos"
                            value={name}
                            onChangeText={(text) => {
                                setName(text);
                                setError(null);
                            }}
                            autoFocus
                        />

                        {error && (
                            <View style={styles.errorContainer}>
                                <Ionicons name="alert-circle" size={16} color={colors.error[500]} />
                                <Text style={styles.errorText}>{error}</Text>
                            </View>
                        )}

                        {/* Submit Button moved inside card for cleaner look or kept outside? User screenshot had it outside full width bar. 
                           "La visual debe ser pro!"
                           Often pro forms have the action at the bottom of the card or floating.
                           The user provided screenshot shows a green bar "Crear Academia" below the form, but fully stretched in the card? No, it looks like a separate button bar.
                           I will keep it simple: Card for form, Button below it, all centered max-800.
                        */}
                    </Card>

                    <View style={styles.buttonContainer}>
                        <Button
                            label={isSubmitting ? 'Creando...' : 'Crear Academia'}
                            onPress={handleSubmit}
                            disabled={isSubmitting || !name.trim()}
                            leftIcon={isSubmitting ? <ActivityIndicator size="small" color={colors.common.white} /> : <Ionicons name="checkmark" size={20} color={colors.common.white} />}
                            shadow
                            style={{ width: '100%' }}
                        />
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.neutral[50],
    },
    headerTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerTitleText: {
        fontSize: typography.size.lg,
        fontWeight: '700',
        color: colors.neutral[900],
    },
    scrollContent: {
        flexGrow: 1,
        alignItems: 'center', // Center the wrapper
        padding: spacing.md,
        paddingBottom: spacing.xxl,
    },
    contentWrapper: {
        width: '100%',
        maxWidth: 700, // slightly tighter for form 
        gap: spacing.lg,
    },
    infoCard: {
        backgroundColor: colors.secondary[50],
        borderColor: colors.secondary[200],
        borderWidth: 1,
    },
    infoContent: {
        flexDirection: 'row',
        // User screenshot: Icon top-left-ish.
        alignItems: 'flex-start',
        gap: spacing.md,
    },
    infoText: {
        flex: 1,
        fontSize: typography.size.sm,
        color: colors.secondary[700],
        lineHeight: 20,
    },
    formCard: {
        // Default white card
    },
    sectionTitle: {
        fontSize: typography.size.lg, // Larger title
        fontWeight: '700',
        color: colors.neutral[900],
        marginBottom: spacing.lg,
    },
    slugPreview: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginTop: spacing.sm,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        backgroundColor: colors.neutral[100],
        borderRadius: 8,
    },
    slugLabel: {
        fontSize: typography.size.xs,
        color: colors.neutral[500],
    },
    slugValue: {
        fontSize: typography.size.sm,
        fontWeight: '600',
        color: colors.primary[600],
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginTop: spacing.md,
        padding: spacing.sm,
        backgroundColor: colors.error[50],
        borderRadius: 8,
    },
    errorText: {
        fontSize: typography.size.sm,
        color: colors.error[600],
    },
    buttonContainer: {
        marginTop: 0, // Handled by gap
    },
});
