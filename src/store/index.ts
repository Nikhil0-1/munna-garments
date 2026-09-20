import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id?: number | string;
  uid?: string;
  name: string;
  username?: string;
  email?: string;
  role: string;
  permissions?: Record<string, boolean>;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  login: (user: User, token: string) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
  isOwner: () => boolean;
  hasPermission: (perm: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      login: (user, token) => {
        localStorage.setItem('mrg_token', token);
        set({ user, token });
      },
      logout: () => {
        localStorage.removeItem('mrg_token');
        localStorage.removeItem('mrg_user');
        set({ user: null, token: null });
      },
      isAuthenticated: () => !!get().token,
      isOwner: () => get().user?.role === 'owner',
      hasPermission: (perm) => {
        if (get().user?.role === 'owner') return true;
        const perms = get().user?.permissions || {};
        return !!(perms.all || perms[perm]);
      },
    }),
    {
      name: 'mrg-auth',
      partialize: (state) => ({ user: state.user, token: state.token }),
    }
  )
);

export interface NetworkState {
  isOnline: boolean;
  setOnline: (status: boolean) => void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  setOnline: (status) => set({ isOnline: status }),
}));

export interface ShopSettings {
  shop_name: string;
  shop_location: string;
  shop_phone: string;
  shop_whatsapp: string;
  shop_email: string;
  shop_address: string;
  shop_city: string;
  shop_state: string;
  shop_pincode: string;
  shop_gstin: string;
  shop_website: string;
  shop_google_maps: string;
  shop_instagram: string;
  shop_tagline: string;
  invoice_prefix: string;
  currency_symbol: string;
  primary_color: string;
  return_policy: string;
  terms_conditions: string;
  thank_you_message: string;
  [key: string]: any;
}

export interface SettingsState {
  settings: ShopSettings;
  loading: boolean;
  setSettings: (settings: Partial<ShopSettings>) => void;
  setLoading: (loading: boolean) => void;
}

const defaultSettings: ShopSettings = {
  shop_name: 'Munna Readymade Garments',
  shop_location: 'Dhobwal Bazzar',
  shop_phone: '+91 9876543210',
  shop_whatsapp: '+919876543210',
  shop_email: '',
  shop_address: 'Dhobwal Bazzar, Jalandhar',
  shop_city: 'Jalandhar',
  shop_state: 'Punjab',
  shop_pincode: '144001',
  shop_gstin: '',
  shop_website: '',
  shop_google_maps: 'https://maps.google.com/?q=Dhobwal+Bazzar+Jalandhar',
  shop_instagram: '',
  shop_tagline: 'Quality Fashion, Affordable Prices',
  invoice_prefix: 'MRG',
  currency_symbol: '₹',
  primary_color: '#C9A96E',
  return_policy: 'Exchange within 7 days with original bill.',
  terms_conditions: 'All prices inclusive of applicable taxes.',
  thank_you_message: 'Thank you for shopping at Munna Readymade Garments!',
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: defaultSettings,
      loading: false,
      setSettings: (newSettings) =>
        set((state) => ({ settings: { ...state.settings, ...newSettings } as ShopSettings })),
      setLoading: (loading) => set({ loading }),
    }),
    { name: 'mrg-settings' }
  )
);
