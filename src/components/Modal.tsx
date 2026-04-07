import React from 'react';
import { Modal as RNModal, ModalProps, View, StyleSheet, Platform, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { toastConfig } from './ToastConfig';

/**
 * A wrapper around React Native's Modal that ensures Toasts are visible on top of it.
 * This is necessary because on native platforms, the Modal component covers the 
 * main application root where the global Toast usually resides.
 * Also provides global Keyboard avoiding behavior for Android and iOS when translucent status bars break standard adjustResize.
 */
export const Modal = ({ children, transparent = true, animationType = 'none', ...props }: ModalProps) => {
    return (
        <RNModal 
            transparent={transparent} 
            animationType={animationType} 
            statusBarTranslucent={true} 
            {...props}
        >
            <KeyboardAvoidingView 
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
            >
                {children}
                {/* 
                  We include a local Toast instance inside the modal. 
                  react-native-toast-message handles this by showing the toast 
                  in the most recently mounted instance.
                */}
                <View style={styles.toastWrapper} pointerEvents="box-none">
                    <Toast config={toastConfig} topOffset={60} />
                </View>
            </KeyboardAvoidingView>
        </RNModal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    toastWrapper: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 9999,
        elevation: 9999,
    },
});

export default Modal;
