import { create } from 'zustand';

interface ViewState {
    isGlobalView: boolean;
    setGlobalView: (value: boolean) => void;
}

export const useViewStore = create<ViewState>((set) => ({
    isGlobalView: false,
    setGlobalView: (value) => set({ isGlobalView: value }),
}));
