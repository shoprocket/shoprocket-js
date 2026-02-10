import type { ShoprocketCore, CustomerProfile, CustomerOrder, CustomerOrderDetail, PaginationMeta } from '@shoprocket/core';
import type { TemplateResult } from 'lit';

export interface AccountLoginContext {
  sdk: ShoprocketCore;
  loginEmail: string;
  loginMode: 'check' | 'password' | 'otp' | 'reset-password';
  otpCode: string[];
  authError: string;
  authLoading: boolean;
  onEmailChange: (email: string) => void;
  onCheckEmail: () => void;
  onPasswordLogin: (password: string) => void;
  onSendOtp: () => void;
  onVerifyOtp: (code: string) => void;
  onOtpInput: (e: Event, index: number) => void;
  onOtpKeydown: (e: KeyboardEvent, index: number) => void;
  onOtpPaste: (e: ClipboardEvent) => void;
  onForgotPassword: () => void;
  onResetPassword: (newPassword: string) => void;
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
  changingPassword: boolean;
  passwordError: string;
  passwordSuccess: string;
  profileSuccess: string;
  profileError: string;
  onUpdateProfile: (data: { firstName: string; lastName: string; phone: string }) => void;
  onChangePassword: (currentPassword: string, newPassword: string) => void;
  onLogout: () => void;
}
