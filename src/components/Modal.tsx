import React from 'react';
import { Modal as RNModal, ModalProps, View, StyleSheet, Platform } from 'react-native';
import Toast from 'react-native-toast-message';
import { toastConfig } from './ToastConfig';

/**
 * A wrapper around React Native's Modal that ensures Toasts are visible on top of it.
 * This is necessary because on native platforms, the Modal component covers the 
 * main application root where the global Toast usually resides.
 */
export const Modal = ({ children, ...props }: ModalProps) => {
    return (
        <RNModal {...props}>
            <View style={styles.container}>
                {children}
                {/* 
                  We include a local Toast instance inside the modal. 
                  react-native-toast-message handles this by showing the toast 
                  in the most recently mounted instance.
                */}
                <View style={styles.toastWrapper} pointerEvents="box-none">
                    <Toast config={toastConfig} topOffset={60} />
                </View>
            </View>
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
