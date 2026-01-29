import { Ionicons } from '@expo/vector-icons';
import { City, Country, State } from 'country-state-city';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Input } from '@/src/design/components/Input';
import { ProSelect } from '@/src/design/components/ProSelect';
import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';

interface LocationPickerProps {
    countryCode: string;
    stateCode: string;
    cityName: string;
    onCountryChange: (code: string) => void;
    onStateChange: (code: string) => void;
    onCityChange: (name: string) => void;
}

export const LocationPicker: React.FC<LocationPickerProps> = ({
    countryCode,
    stateCode,
    cityName,
    onCountryChange,
    onStateChange,
    onCityChange,
}) => {
    const { t } = useTranslation();
    const [countries, setCountries] = useState<Array<{ label: string; value: string }>>([]);
    const [states, setStates] = useState<Array<{ label: string; value: string }>>([]);
    const [cities, setCities] = useState<Array<{ label: string; value: string }>>([]);

    // Load countries on mount
    useEffect(() => {
        const allCountries = Country.getAllCountries();
        const countryOptions = [
            { label: t('selectCountry'), value: '' },
            ...allCountries.map((country) => ({
                label: country.name,
                value: country.isoCode,
            })),
        ];
        setCountries(countryOptions);
    }, [t]);

    // Load states when country changes
    useEffect(() => {
        if (countryCode) {
            const countryStates = State.getStatesOfCountry(countryCode);
            const stateOptions = [
                { label: t('selectState'), value: '' },
                ...countryStates.map((state) => ({
                    label: state.name,
                    value: state.isoCode,
                })),
            ];
            setStates(stateOptions);
        } else {
            setStates([{ label: t('selectState'), value: '' }]);
            setCities([{ label: t('selectCity'), value: '' }]);
        }
    }, [countryCode, t]);

    // Load cities when state changes
    useEffect(() => {
        if (countryCode && stateCode) {
            // Special case for Buenos Aires, Argentina (country: AR, state: B)
            if (countryCode === 'AR' && stateCode === 'B') {
                const buenosAiresCities = [
                    'Tigre', 'San Isidro', 'Vicente López', 'San Fernando',
                    'La Plata', 'Avellaneda', 'Quilmes', 'Lomas de Zamora',
                    'Lanús', 'San Martín', 'Tres de Febrero', 'Morón',
                    'Ituzaingó', 'Hurlingham', 'San Miguel', 'José C. Paz',
                    'Malvinas Argentinas', 'Pilar', 'Escobar', 'Campana',
                    'Zárate', 'Luján', 'Mercedes', 'Pergamino',
                    'Junín', 'Chivilcoy', 'Tandil', 'Olavarría',
                    'Azul', 'Bahía Blanca', 'Mar del Plata', 'Necochea',
                    'Balcarce', 'Dolores', 'Chascomús', 'Lobos',
                    'Cañuelas', 'San Vicente', 'Brandsen', 'La Matanza',
                    'Moreno', 'Merlo', 'General Rodríguez', 'Marcos Paz'
                ].sort();

                const cityOptions = [
                    { label: t('selectCity'), value: '' },
                    ...buenosAiresCities.map((city) => ({
                        label: city,
                        value: city,
                    })),
                ];
                setCities(cityOptions);
            } else {
                // Use library data for other locations
                const stateCities = City.getCitiesOfState(countryCode, stateCode);
                const cityOptions = [
                    { label: t('selectCity'), value: '' },
                    ...stateCities.map((city) => ({
                        label: city.name,
                        value: city.name,
                    })),
                ];
                setCities(cityOptions);
            }
        } else {
            setCities([{ label: t('selectCity'), value: '' }]);
        }
    }, [countryCode, stateCode, t]);

    const handleCountryChange = (code: string) => {
        onCountryChange(code);
        onStateChange('');
        onCityChange('');
    };

    const handleStateChange = (code: string) => {
        onStateChange(code);
        onCityChange('');
    };

    // Determine if we should show Select or Input for cities
    const hasCitiesData = cities.length > 0;

    return (
        <View style={styles.container}>
            <ProSelect
                label={t('country')}
                value={countryCode}
                onChange={handleCountryChange}
                options={countries}
                leftIcon={<Ionicons name="flag-outline" size={20} color={colors.neutral[400]} />}
                placeholder={t('selectCountry')}
                searchable={true}
            />

            <ProSelect
                label={t('stateProvince')}
                value={stateCode}
                onChange={handleStateChange}
                options={states}
                leftIcon={<Ionicons name="map-outline" size={20} color={colors.neutral[400]} />}
                placeholder={t('selectState')}
                searchable={true}
            />

            {/* Show ProSelect if cities data is available, otherwise show Input */}
            {hasCitiesData ? (
                <ProSelect
                    label={t('city')}
                    value={cityName}
                    onChange={onCityChange}
                    options={cities}
                    leftIcon={<Ionicons name="location-outline" size={20} color={colors.neutral[400]} />}
                    placeholder={t('selectCity')}
                    searchable={true}
                />
            ) : (
                <View>
                    <Input
                        label={t('city')}
                        size="sm"
                        value={cityName}
                        onChangeText={onCityChange}
                        placeholder={t('cityPlaceholder')}
                        leftIcon={<Ionicons name="location-outline" size={20} color={colors.neutral[400]} />}
                    />
                    {stateCode && (
                        <Text style={styles.hint}>{t('cityManualEntry')}</Text>
                    )}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        gap: 0,
    },
    hint: {
        fontSize: typography.size.xs,
        color: colors.neutral[500],
        marginTop: -spacing.sm,
        marginBottom: spacing.sm,
        fontStyle: 'italic',
    },
});
