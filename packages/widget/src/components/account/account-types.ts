import type { ShoprocketCore, CustomerProfile, CustomerOrder, CustomerOrderDetail, PaginationMeta } from '@shoprocket/core';
import type { TemplateResult } from 'lit';

export interface AccountLoginContext {
  sdk: ShoprocketCore;
  loginEmail: string;
  loginMode: 'check' | 'otp';
  otpCode: string[];
  authError: string;
  authLoading: boolean;
  onEmailChange: (email: string) => void;
  onCheckEmail: () => void;
  onSendOtp: () => void;
  onVerifyOtp: (code: string) => void;
  onOtpInput: (e: Event, index: number) => void;
  onOtpKeydown: (e: KeyboardEvent, index: number) => void;
  onOtpPaste: (e: ClipboardEvent) => void;
  onBack: () => void;
}

export interface AccountOrdersContext {
  orders: CustomerOrder[];
  ordersMeta: PaginationMeta | null;
  ordersPage: number;
  selectedOrder: CustomerOrderDetail | null;
  loading: boolean;
  onSelectOrder: (orderId: string) => void;
  onBackToOrders: () => void;
  onPageChange: (page: number) => void;
  formatPrice: (amount: { formatted: string }) => string;
}

export interface AccountDetailsContext {
  profile: CustomerProfile;
  saving: boolean;
  profileSuccess: string;
  profileError: string;
  onUpdateProfile: (data: { firstName: string; lastName: string; phone: string }) => void;
  onLogout: () => void;
}
