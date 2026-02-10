import { html, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { ShoprocketElement } from '../core/base-component';
import { t } from '../utils/i18n';
import type { CustomerProfile, CustomerOrder, CustomerOrderDetail, PaginationMeta } from '@shoprocket/core';
import type { AccountLoginContext } from './account/account-types';
import type { AccountOrdersContext } from './account/account-types';
import type { AccountDetailsContext } from './account/account-types';

// Lazy-loaded sub-module cache
type AccountModules = {
  login?: typeof import('./account/account-login');
  orders?: typeof import('./account/account-orders');
  details?: typeof import('./account/account-details');
};

export class AccountWidget extends ShoprocketElement {
  // Lazy module cache
  private modules: AccountModules = {};

  @property({ type: String, reflect: true })
  mode: 'drawer' | 'inline' = 'inline';

  // View state
  @state() private view: 'login' | 'dashboard' = 'login';
  @state() private activeTab: 'orders' | 'details' = 'orders';
  @state() private loading = true;

  // Profile state
  @state() private profile: CustomerProfile | null = null;

  // Orders state
  @state() private orders: CustomerOrder[] = [];
  @state() private ordersPage = 1;
  @state() private ordersMeta: PaginationMeta | null = null;
  @state() private selectedOrder: CustomerOrderDetail | null = null;
  @state() private ordersLoading = false;

  // Login state
  @state() private loginEmail = '';
  @state() private loginMode: 'check' | 'password' | 'otp' = 'check';
  @state() private otpCode: string[] = ['', '', '', '', '', ''];
  @state() private authError = '';
  @state() private authLoading = false;

  // Profile edit state
  @state() private saving = false;
  @state() private profileSuccess = '';
  @state() private profileError = '';

  // Password state
  @state() private changingPassword = false;
  @state() private passwordError = '';
  @state() private passwordSuccess = '';

  // Drawer state
  @state() private drawerOpen = false;

  private boundOpenHandler = () => this.openDrawer();
  private boundCloseHandler = () => this.closeDrawer();

  override connectedCallback(): void {
    super.connectedCallback();
    this.checkAuthAndLoad();
    window.addEventListener('shoprocket:account:open', this.boundOpenHandler);
    window.addEventListener('shoprocket:account:close', this.boundCloseHandler);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('shoprocket:account:open', this.boundOpenHandler);
    window.removeEventListener('shoprocket:account:close', this.boundCloseHandler);
  }

  private async ensureModule<K extends keyof AccountModules>(name: K): Promise<NonNullable<AccountModules[K]>> {
    if (!this.modules[name]) {
      if (name === 'login') {
        this.modules.login = await import('./account/account-login');
      } else if (name === 'orders') {
        this.modules.orders = await import('./account/account-orders');
      } else if (name === 'details') {
        this.modules.details = await import('./account/account-details');
      }
    }
    return this.modules[name] as NonNullable<AccountModules[K]>;
  }

  private async checkAuthAndLoad(): Promise<void> {
    try {
      const profile = await this.sdk.account.getProfile();
      this.profile = profile;
      this.view = 'dashboard';
      await this.loadOrders();
    } catch {
      this.view = 'login';
    } finally {
      this.loading = false;
    }
  }

  private async loadOrders(): Promise<void> {
    this.ordersLoading = true;
    try {
      const result = await this.sdk.account.getOrders(this.ordersPage);
      this.orders = result.data;
      this.ordersMeta = result.meta;
    } catch (error) {
      console.error('Failed to load orders:', error);
    } finally {
      this.ordersLoading = false;
    }
  }

  // --- Login handlers ---
  private async handleCheckEmail(): Promise<void> {
    if (!this.loginEmail || !this.loginEmail.includes('@')) return;
    this.authLoading = true;
    this.authError = '';
    try {
      // @ts-ignore - TypeScript module resolution issues but method exists at runtime
      const result = await this.sdk.cart.checkCheckoutData(this.loginEmail);
      if (!result.exists) {
        this.authError = t('account.no_account', 'No account found with this email.');
      } else if (result.hasPassword) {
        this.loginMode = 'password';
      } else {
        await this.handleSendOtp();
      }
    } catch {
      this.authError = t('account.check_failed', 'Unable to check email. Please try again.');
    } finally {
      this.authLoading = false;
    }
  }

  private async handlePasswordLogin(password: string): Promise<void> {
    this.authLoading = true;
    this.authError = '';
    try {
      // @ts-ignore
      const result = await this.sdk.cart.passwordLogin(this.loginEmail, password);
      if (result.authenticated) {
        await this.checkAuthAndLoad();
      } else {
        this.authError = result.message || t('account.invalid_password', 'Invalid password.');
      }
    } catch (error: any) {
      if (error.status === 429) {
        this.authError = t('error.rate_limit', 'Too many attempts. Please wait a moment.');
      } else {
        this.authError = error.message || t('account.login_failed', 'Login failed. Please try again.');
      }
    } finally {
      this.authLoading = false;
    }
  }

  private async handleSendOtp(): Promise<void> {
    this.authLoading = true;
    this.authError = '';
    try {
      // @ts-ignore
      const result = await this.sdk.cart.sendAuth(this.loginEmail);
      if (result.authSent) {
        this.loginMode = 'otp';
        this.otpCode = ['', '', '', '', '', ''];
        this.updateComplete.then(() => {
          const firstInput = this.shadowRoot?.querySelector('[data-otp-index="0"]') as HTMLInputElement;
          firstInput?.focus();
        });
      }
    } catch (error: any) {
      if (error.status === 429) {
        this.authError = t('error.rate_limit', 'Too many attempts. Please wait a moment.');
      } else {
        this.authError = t('account.send_code_failed', 'Failed to send code. Please try again.');
      }
    } finally {
      this.authLoading = false;
    }
  }

  private async handleVerifyOtp(code: string): Promise<void> {
    this.authLoading = true;
    this.authError = '';
    try {
      // @ts-ignore
      const result = await this.sdk.cart.verifyAuth(this.loginEmail, code);
      if (result.authenticated) {
        await this.checkAuthAndLoad();
      } else {
        this.authError = result.message || t('account.invalid_code', 'Invalid code. Please try again.');
      }
    } catch (error: any) {
      this.authError = error.message || t('account.verify_failed', 'Verification failed. Please try again.');
    } finally {
      this.authLoading = false;
    }
  }

  private handleOtpInput(e: Event, index: number): void {
    const input = e.target as HTMLInputElement;
    const value = input.value;
    if (!/^\d*$/.test(value)) { input.value = ''; return; }
    this.authError = '';
    const codes = [...this.otpCode];
    codes[index] = value;
    this.otpCode = codes;
    if (value && index < 5) {
      const next = this.shadowRoot?.querySelector(`[data-otp-index="${index + 1}"]`) as HTMLInputElement;
      next?.focus();
    }
    const fullCode = codes.join('');
    if (fullCode.length === 6 && /^\d{6}$/.test(fullCode)) {
      this.handleVerifyOtp(fullCode);
    }
  }

  private handleOtpKeydown(e: KeyboardEvent, index: number): void {
    if (e.key === 'Backspace' && !this.otpCode[index] && index > 0) {
      const prev = this.shadowRoot?.querySelector(`[data-otp-index="${index - 1}"]`) as HTMLInputElement;
      prev?.focus();
    }
  }

  private handleOtpPaste(e: ClipboardEvent): void {
    e.preventDefault();
    const paste = e.clipboardData?.getData('text')?.trim() || '';
    const digits = paste.replace(/\D/g, '').slice(0, 6);
    if (digits.length > 0) {
      const codes = digits.split('');
      while (codes.length < 6) codes.push('');
      this.otpCode = codes;
      // Fill all inputs
      codes.forEach((d, i) => {
        const input = this.shadowRoot?.querySelector(`[data-otp-index="${i}"]`) as HTMLInputElement;
        if (input) input.value = d;
      });
      if (digits.length === 6) {
        this.handleVerifyOtp(digits);
      } else {
        const nextEmpty = this.shadowRoot?.querySelector(`[data-otp-index="${digits.length}"]`) as HTMLInputElement;
        nextEmpty?.focus();
      }
    }
  }

  private handleLoginBack(): void {
    this.loginMode = 'check';
    this.authError = '';
    this.otpCode = ['', '', '', '', '', ''];
  }

  // --- Dashboard handlers ---
  private async handleSelectOrder(orderId: string): Promise<void> {
    this.ordersLoading = true;
    try {
      this.selectedOrder = await this.sdk.account.getOrder(orderId);
    } catch (error) {
      console.error('Failed to load order:', error);
    } finally {
      this.ordersLoading = false;
    }
  }

  private handleBackToOrders(): void {
    this.selectedOrder = null;
  }

  private async handlePageChange(page: number): Promise<void> {
    this.ordersPage = page;
    await this.loadOrders();
  }

  private async handleUpdateProfile(data: { firstName: string; lastName: string; phone: string }): Promise<void> {
    this.saving = true;
    this.profileSuccess = '';
    this.profileError = '';
    try {
      this.profile = await this.sdk.account.updateProfile(data);
      this.profileSuccess = t('account.profile_saved', 'Profile updated successfully.');
      setTimeout(() => { this.profileSuccess = ''; }, 3000);
    } catch (error: any) {
      this.profileError = error.message || t('account.profile_save_failed', 'Failed to save profile. Please try again.');
      setTimeout(() => { this.profileError = ''; }, 5000);
    } finally {
      this.saving = false;
    }
  }

  private async handleChangePassword(currentPassword: string, newPassword: string): Promise<void> {
    this.changingPassword = true;
    this.passwordError = '';
    this.passwordSuccess = '';
    try {
      await this.sdk.account.changePassword(currentPassword, newPassword);
      this.passwordSuccess = t('account.password_changed', 'Password updated successfully.');
      setTimeout(() => { this.passwordSuccess = ''; }, 3000);
    } catch (error: any) {
      this.passwordError = error.message || t('account.password_change_failed', 'Failed to change password.');
    } finally {
      this.changingPassword = false;
    }
  }

  private async handleLogout(): Promise<void> {
    try {
      await this.sdk.account.logout();
    } catch {
      // Continue with client-side cleanup even if server logout fails
    }
    this.profile = null;
    this.orders = [];
    this.selectedOrder = null;
    this.view = 'login';
    this.loginEmail = '';
    this.loginMode = 'check';
    this.activeTab = 'orders';
    if (this.mode === 'drawer') {
      this.closeDrawer();
    }
  }

  // --- Drawer ---
  private openDrawer(): void {
    this.drawerOpen = true;
  }

  private closeDrawer(): void {
    this.drawerOpen = false;
  }

  // --- Render ---
  protected override render(): TemplateResult {
    if (this.mode === 'drawer') {
      return this.renderDrawer();
    }
    return this.renderInline();
  }

  private renderDrawer(): TemplateResult {
    return html`
      <div
        class="sr-account-overlay ${this.drawerOpen ? 'open' : 'closed'}"
        @click=${() => this.closeDrawer()}
      ></div>
      <div class="sr-account-panel ${this.drawerOpen ? 'open' : 'closed'}">
        <div class="sr-account-header">
          <h2 class="sr-account-title">${t('account.my_account', 'My Account')}</h2>
          <button class="sr-account-close" @click=${() => this.closeDrawer()} aria-label="${t('account.close', 'Close')}">
            <svg class="sr-button-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        <div class="sr-account-body">
          ${this.renderContent()}
        </div>
      </div>
    `;
  }

  private renderInline(): TemplateResult {
    return html`
      <div class="sr-account-inline">
        ${this.renderContent()}
      </div>
    `;
  }

  private renderContent(): TemplateResult {
    if (this.loading) {
      return html`<div class="sr-account-loading">${t('account.loading', 'Loading...')}</div>`;
    }
    if (this.view === 'login') {
      return this.renderLogin();
    }
    return this.renderDashboard();
  }

  private renderLogin(): TemplateResult {
    if (!this.modules.login) {
      this.ensureModule('login').then(() => this.requestUpdate());
      return html`<div class="sr-account-loading">${t('account.loading', 'Loading...')}</div>`;
    }
    const ctx: AccountLoginContext = {
      sdk: this.sdk,
      loginEmail: this.loginEmail,
      loginMode: this.loginMode,
      otpCode: this.otpCode,
      authError: this.authError,
      authLoading: this.authLoading,
      onEmailChange: (email) => { this.loginEmail = email; },
      onCheckEmail: () => this.handleCheckEmail(),
      onPasswordLogin: (pw) => this.handlePasswordLogin(pw),
      onSendOtp: () => this.handleSendOtp(),
      onVerifyOtp: (code) => this.handleVerifyOtp(code),
      onOtpInput: (e, i) => this.handleOtpInput(e, i),
      onOtpKeydown: (e, i) => this.handleOtpKeydown(e, i),
      onOtpPaste: (e) => this.handleOtpPaste(e),
      onBack: () => this.handleLoginBack(),
    };
    return this.modules.login.renderAccountLogin(ctx);
  }

  private renderDashboard(): TemplateResult {
    return html`
      ${this.profile ? html`
        <div class="sr-account-profile-header">
          <div class="sr-account-avatar">${(this.profile.firstName?.[0] || this.profile.email[0] || '?').toUpperCase()}</div>
          <div class="sr-account-profile-info">
            <span class="sr-account-profile-name">${this.profile.firstName} ${this.profile.lastName}</span>
            <span class="sr-account-profile-email">${this.profile.email}</span>
          </div>
        </div>
      ` : ''}
      <div class="sr-account-tabs">
        <button
          class="sr-account-tab ${this.activeTab === 'orders' ? 'active' : ''}"
          @click=${() => { this.activeTab = 'orders'; this.selectedOrder = null; }}
        >${t('account.orders', 'Orders')}</button>
        <button
          class="sr-account-tab ${this.activeTab === 'details' ? 'active' : ''}"
          @click=${() => { this.activeTab = 'details'; }}
        >${t('account.details', 'Details')}</button>
      </div>
      <div class="sr-account-tab-content">
        ${this.activeTab === 'orders' ? this.renderOrders() : this.renderDetails()}
      </div>
    `;
  }

  private renderOrders(): TemplateResult {
    if (!this.modules.orders) {
      this.ensureModule('orders').then(() => this.requestUpdate());
      return html`<div class="sr-account-loading">${t('account.loading', 'Loading...')}</div>`;
    }
    const ctx: AccountOrdersContext = {
      orders: this.orders,
      ordersMeta: this.ordersMeta,
      ordersPage: this.ordersPage,
      selectedOrder: this.selectedOrder,
      loading: this.ordersLoading,
      onSelectOrder: (id) => this.handleSelectOrder(id),
      onBackToOrders: () => this.handleBackToOrders(),
      onPageChange: (p) => this.handlePageChange(p),
      formatPrice: (amount) => amount.formatted,
    };
    return this.modules.orders.renderAccountOrders(ctx);
  }

  private renderDetails(): TemplateResult {
    if (!this.modules.details || !this.profile) {
      if (!this.modules.details) {
        this.ensureModule('details').then(() => this.requestUpdate());
      }
      return html`<div class="sr-account-loading">${t('account.loading', 'Loading...')}</div>`;
    }
    const ctx: AccountDetailsContext = {
      profile: this.profile,
      saving: this.saving,
      changingPassword: this.changingPassword,
      passwordError: this.passwordError,
      passwordSuccess: this.passwordSuccess,
      profileSuccess: this.profileSuccess,
      profileError: this.profileError,
      onUpdateProfile: (data) => this.handleUpdateProfile(data),
      onChangePassword: (cur, pw) => this.handleChangePassword(cur, pw),
      onLogout: () => this.handleLogout(),
    };
    return this.modules.details.renderAccountDetails(ctx);
  }
}
