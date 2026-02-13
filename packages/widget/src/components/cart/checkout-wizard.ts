/**
 * Checkout Wizard Rendering
 * Handles multi-step checkout flow: customer → shipping → billing → payment → review
 */
import { html, type TemplateResult } from 'lit';
import { loadingSpinner, loadingOverlay } from '../loading-spinner';
import type { CheckoutStep, CustomerCheckResult } from './cart-types';
import type { CustomerData, CustomerFormErrors } from '../customer-form';
import type { AddressData, AddressFormErrors } from '../address-form';
import type { Cart } from '@shoprocket/core';
import { t } from '../../utils/i18n';

export interface CheckoutWizardContext {
  // Cart state
  cart: Cart | null;

  // Checkout flow state
  checkoutStep: CheckoutStep;
  chunkLoading: boolean;
  checkoutLoading: boolean;

  // Customer step
  customerData: Partial<CustomerData>;
  customerErrors: CustomerFormErrors;
  isGuest: boolean;
  checkingCustomer: boolean;
  customerCheckResult?: CustomerCheckResult;
  showPasswordField: boolean;
  authDismissed: boolean;
  customerPassword: string;
  signingIn: boolean;
  sendingLoginLink: boolean;
  loginLinkSent: boolean;

  // OTP verification
  otpCode: string;
  verifyingOtp: boolean;
  otpError: string;
  resendingOtp: boolean;

  // Address steps
  shippingAddress: Partial<AddressData>;
  shippingErrors: AddressFormErrors;
  billingAddress: Partial<AddressData>;
  billingErrors: AddressFormErrors;
  sameAsBilling: boolean;

  // Payment methods
  paymentMethods: any[];
  selectedPaymentMethod: any;
  paymentMethodsLoading: boolean;

  // Review step
  reviewItemsExpanded: boolean;

  // SDK
  sdk: any;

  // Event handlers (bound to cart.ts)
  handleBackButton: () => void;
  handleCustomerChange: (e: CustomEvent) => void;
  handleCustomerCheck: (e: CustomEvent) => void;
  handleGuestToggle: (e: CustomEvent) => void;
  handlePasswordInput: (e: Event) => void;
  handleSendLoginLink: () => Promise<void>;
  handlePasswordLogin: () => Promise<void>;
  handleShowPasswordField: () => void;
  handleDismissAuth: () => void;
  handleOtpInput: (e: Event, index: number) => void;
  handleOtpKeydown: (e: KeyboardEvent, index: number) => void;
  handleOtpPaste: (e: ClipboardEvent) => void;
  handleResendOtp: () => Promise<void>;
  handleShippingAddressChange: (e: CustomEvent) => void;
  handleSameAsBillingChange: (e: CustomEvent) => void;
  handleBillingAddressChange: (e: CustomEvent) => void;
  handlePaymentMethodSelect: (method: any) => void;
  toggleReviewItems: () => void;
  handleStepNext: () => void;
  handleCheckoutComplete: () => Promise<void>;
  setCheckoutStep: (step: CheckoutStep) => void;
  exitCheckout: () => void;

  // Utilities
  formatPrice: (amount: any) => string;
  getMediaUrl: (media: any, transforms?: string) => string;
  handleImageError: (e: Event) => void;
  getCheckoutStepTitle: () => string;
  track: (event: string, data?: any) => void;
}

export function renderCheckoutFlow(context: CheckoutWizardContext): TemplateResult {
  // Show loading overlay only while chunks are loading
  // checkoutLoading is handled by button spinner (don't hide whole form during payment redirect)
  if (context.chunkLoading) {
    return loadingOverlay();
  }

  // Only render the current active step for better performance
  switch (context.checkoutStep) {
    case 'customer':
      return html`
        <div class="sr-checkout-step">
          ${renderCustomerContent(context)}
        </div>
      `;

    case 'shipping':
      return html`
        <div class="sr-checkout-step">
          ${renderShippingContent(context)}
        </div>
      `;

    case 'billing':
      // Skip billing if same as shipping
      if (context.sameAsBilling) {
        // This shouldn't happen, but handle gracefully
        context.setCheckoutStep('payment');
        return html`
          <div class="sr-checkout-step">
            ${renderPaymentContent(context)}
          </div>
        `;
      }
      return html`
        <div class="sr-checkout-step">
          ${renderBillingContent(context)}
        </div>
      `;

    case 'payment':
      return html`
        <div class="sr-checkout-step">
          ${renderPaymentContent(context)}
        </div>
      `;

    case 'review':
      return html`
        <div class="sr-checkout-step">
          ${renderReviewContent(context)}
        </div>
      `;

    default:
      // Fallback to customer step if unknown
      return html`
        <div class="sr-checkout-step">
          ${renderCustomerContent(context)}
        </div>
      `;
  }
}

export function renderCheckoutFooter(context: CheckoutWizardContext): TemplateResult {
  // On payment step, require a method to be selected
  const canProceed = context.checkoutStep !== 'payment' || !!context.selectedPaymentMethod;

  // Show cart summary during checkout (except review step which shows full breakdown in main content)
  const subtotal = context.cart?.totals?.subtotal || { amount: 0, currency: 'USD', formatted: '$0.00' };

  return html`
    ${context.checkoutStep !== 'review' ? html`
      <div class="sr-cart-subtotal">
        <span class="sr-cart-subtotal-label">Subtotal</span>
        <span class="sr-cart-subtotal-amount">
          <span class="sr-cart-total-price">${context.formatPrice(subtotal)}</span>
        </span>
      </div>
    ` : ''}

    ${context.checkoutStep === 'review' ? html`
      <button
        class="sr-cart-checkout-button"
        @click="${context.handleCheckoutComplete}"
        ?disabled="${context.checkoutLoading || !canProceed}"
      >
        ${context.checkoutLoading ? loadingSpinner('sm') : t('checkout.complete_order', 'Complete Order')}
      </button>
    ` : html`
      <button
        class="sr-cart-checkout-button sr-checkout-next-button"
        @click="${context.handleStepNext}"
        ?disabled="${context.checkoutLoading || context.chunkLoading || !canProceed}"
      >
        ${context.checkoutLoading || context.chunkLoading ? loadingSpinner('sm') : 'Continue'}
      </button>
    `}

    <p class="sr-cart-powered-by">
      ${context.checkoutStep === 'review' ? html`
        By completing your order, you agree to our terms
      ` : html`
        <svg class="sr-secure-icon" width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M6 0.75L1.5 2.625V5.625C1.5 8.4375 3.4875 11.0625 6 11.625C8.5125 11.0625 10.5 8.4375 10.5 5.625V2.625L6 0.75ZM9.375 5.625C9.375 7.9125 7.8 9.9375 6 10.4625C4.2 9.9375 2.625 7.9125 2.625 5.625V3.3L6 1.875L9.375 3.3V5.625ZM4.6875 6L4.125 6.5625L5.25 7.6875L7.875 5.0625L7.3125 4.5L5.25 6.5625L4.6875 6Z" fill="#10B981"/>
        </svg>
        Secure checkout powered by
        <a href="https://shoprocket.io?utm_source=widget&utm_medium=cart&utm_campaign=powered_by"
           target="_blank"
           rel="noopener noreferrer"
           class="sr-cart-powered-by-link">
          <b>Shoprocket</b>
        </a>
      `}
    </p>
  `;
}

function renderCustomerContent(context: CheckoutWizardContext): TemplateResult {
  // If OTP form is showing, only render the OTP section
  if (context.loginLinkSent) {
    return html`
      <div class="sr-checkout-step">
        <!-- OTP verification form -->
        <div class="sr-otp-section">
          <div class="sr-otp-header">
            <h4 class="sr-otp-title">Enter verification code</h4>
            <p class="sr-otp-subtitle">We sent a 6-digit code to ${context.customerData.email}</p>
          </div>

          ${context.resendingOtp ? html`
            <!-- Show loading state while resending -->
            <div class="sr-otp-resending" style="text-align: center; padding: 2rem 0;">
              <span class="sr-spinner"></span>
              <p style="margin-top: 1rem; color: var(--color-text-muted); font-size: 0.875rem;">
                Sending new code...
              </p>
            </div>
          ` : html`
            <!-- Show OTP input fields when not resending -->
            <div class="sr-otp-inputs">
              ${Array.from({length: 6}, (_, i) => html`
                <input
                  type="text"
                  inputmode="numeric"
                  maxlength="1"
                  class="sr-otp-input ${context.otpError ? 'sr-field-error' : ''}"
                  .value="${context.otpCode[i] || ''}"
                  @input="${(e: Event) => context.handleOtpInput(e, i)}"
                  @keydown="${(e: KeyboardEvent) => context.handleOtpKeydown(e, i)}"
                  @paste="${(e: ClipboardEvent) => context.handleOtpPaste(e)}"
                  data-otp-index="${i}"
                />
              `)}
            </div>

            ${context.otpError ? html`
              <div class="sr-field-error-message">${context.otpError}</div>
            ` : ''}

            ${context.verifyingOtp ? html`
              <div class="sr-otp-verifying">
                <span class="sr-spinner"></span> Verifying...
              </div>
            ` : ''}
          `}

          <div class="sr-otp-resend">
            <p>Didn't receive code?
              <button
                class="sr-auth-link"
                @click="${context.handleResendOtp}"
                ?disabled="${context.resendingOtp}"
              >
                ${context.resendingOtp ? t('action.sending', 'Sending...') : t('action.resend', 'Resend')}
              </button>
            </p>
          </div>

          <!-- Proceed as guest option -->
          <div class="sr-otp-guest-option">
            <button class="sr-auth-link" @click="${() => {
              context.loginLinkSent = false;
              context.otpCode = '';
              context.otpError = '';
              context.customerCheckResult = undefined;
            }}">
              Continue as guest instead
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // Otherwise show the normal customer form flow
  return html`
    <shoprocket-customer-form
        .customer="${context.customerData}"
        .errors="${context.customerErrors}"
        .required="${true}"
        .show-guest-option="${true}"
        .is-guest="${context.isGuest}"
        @customer-change="${context.handleCustomerChange}"
        @customer-check="${context.handleCustomerCheck}"
        @guest-toggle="${context.handleGuestToggle}"
      ></shoprocket-customer-form>

    ${context.checkingCustomer && context.customerData.email ? html`
      <div class="sr-checking-customer">
        <span class="sr-spinner"></span>
        <span class="sr-checking-text">Checking email...</span>
      </div>
    ` : context.customerCheckResult && context.customerCheckResult.exists ? html`
      <div class="sr-auth-section">
        ${(() => {
          // API now returns camelCase via CustomerCheckResource
          if (context.customerCheckResult!.exists && !context.customerCheckResult!.hasPassword) {
            // Customer exists but no password (guest checkout previously)
            return html`
                <!-- Guest customer (no account) -->
                ${!context.loginLinkSent ? html`
                  <div class="sr-returning-notice">
                    <svg class="sr-notice-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <div class="sr-notice-text">
                      <p>Welcome back!</p>
                      <button
                        class="sr-auth-link"
                        ?disabled="${context.sendingLoginLink}"
                        @click="${context.handleSendLoginLink}"
                      >
                        ${context.sendingLoginLink ? html`
                          <span class="sr-spinner"></span> ${t('action.sending', 'Sending...')}
                        ` : t('checkout.load_saved_details', 'Load my saved details')}
                      </button>
                    </div>
                  </div>
                ` : ''}
              `;

          } else if (context.customerCheckResult!.exists && context.customerCheckResult!.hasPassword) {
            // Customer exists with password (registered account)
            // Compact banner — expands to password field on demand, dismissible
            if (context.authDismissed) return '';

            return html`
                ${context.showPasswordField ? html`
                  <!-- Expanded: password sign-in -->
                  <div class="sr-auth-banner">
                    <span class="sr-auth-banner-text">${t('checkout.welcome_back', 'Welcome back!')}</span>
                    <button class="sr-auth-banner-dismiss" @click="${context.handleDismissAuth}" aria-label="${t('action.dismiss', 'Dismiss')}">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                  </div>
                  <div class="sr-field-group">
                    <input
                      type="password"
                      id="password"
                      class="sr-field-input peer ${context.customerPassword ? 'has-value' : ''}"
                      .value="${context.customerPassword}"
                      placeholder=" "
                      autocomplete="current-password"
                      @input="${context.handlePasswordInput}"
                    >
                    <label class="sr-field-label" for="password">${t('field.password', 'Password')}</label>
                  </div>

                  <button
                    class="sr-btn sr-btn-primary"
                    ?disabled="${!context.customerPassword || context.signingIn}"
                    @click="${context.handlePasswordLogin}"
                  >
                    ${context.signingIn ? html`
                      <span class="sr-spinner"></span> ${t('action.signing_in', 'Signing in...')}
                    ` : t('action.sign_in', 'Sign In')}
                  </button>

                  <div class="sr-auth-banner-alt">
                    <button
                      class="sr-auth-link"
                      ?disabled="${context.sendingLoginLink}"
                      @click="${context.handleSendLoginLink}"
                    >
                      ${context.sendingLoginLink ? t('action.sending', 'Sending...') : t('checkout.email_sign_in_code', 'Email me a sign-in code')}
                    </button>
                  </div>
                ` : html`
                  <!-- Collapsed: compact banner with inline actions -->
                  <div class="sr-auth-banner">
                    <span class="sr-auth-banner-text">
                      <strong>${t('checkout.welcome_back', 'Welcome back!')}</strong><br>
                      <button class="sr-auth-link" @click="${context.handleShowPasswordField}">${t('action.sign_in', 'Sign in')}</button>
                      ${t('checkout.or', 'or')}
                      <button
                        class="sr-auth-link"
                        ?disabled="${context.sendingLoginLink}"
                        @click="${context.handleSendLoginLink}"
                      >${context.sendingLoginLink ? t('action.sending', 'Sending...') : t('checkout.email_code', 'email me a code')}</button>
                      ${t('checkout.to_load_details', 'to load saved details.')}
                    </span>
                    <button class="sr-auth-banner-dismiss" @click="${context.handleDismissAuth}" aria-label="${t('action.dismiss', 'Dismiss')}">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                  </div>
                `}
              `;
          }

          // Shouldn't reach here but return empty for safety
          return '';
        })()}
      </div>
    ` : ''}
  `;
}

function renderShippingContent(context: CheckoutWizardContext): TemplateResult {
  return html`
    <shoprocket-address-form
      title=""
      type="shipping"
      .sdk="${context.sdk}"
      .address="${context.shippingAddress}"
      .errors="${context.shippingErrors}"
      .required="${true}"
      .show-name="${false}"
      .show-phone="${false}"
      .showSameAsBilling="${true}"
      .sameAsBilling="${context.sameAsBilling}"
      @address-change="${context.handleShippingAddressChange}"
      @same-as-billing-change="${context.handleSameAsBillingChange}"
    ></shoprocket-address-form>
  `;
}

function renderBillingContent(context: CheckoutWizardContext): TemplateResult {
  return html`
    <shoprocket-address-form
        title=""
        type="billing"
        .sdk="${context.sdk}"
        .address="${context.billingAddress}"
        .errors="${context.billingErrors}"
        .required="${true}"
        .show-name="${false}"
        @address-change="${context.handleBillingAddressChange}"
            ></shoprocket-address-form>
  `;
}

function getPaymentMethodIcon(method: any): TemplateResult {
  const icon = method.icon || 'credit-card';
  switch (icon) {
    case 'credit-card':
      return html`<svg class="sr-payment-method-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>`;
    case 'paypal':
      return html`<svg class="sr-payment-method-icon" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 3.72a.77.77 0 0 1 .757-.654h6.17c2.046 0 3.464.508 4.21 1.51.322.43.524.903.616 1.442.096.563.098 1.235.006 2.058l-.007.052v.46l.359.203c.304.163.546.35.73.563.307.354.505.793.589 1.307.087.527.058 1.152-.084 1.857-.164.812-.432 1.523-.793 2.105a4.418 4.418 0 0 1-1.218 1.349 4.912 4.912 0 0 1-1.627.759c-.614.175-1.32.264-2.098.264H11.57a.947.947 0 0 0-.936.808l-.035.203-1.166 7.39-.027.15a.097.097 0 0 1-.096.082H7.076z"/></svg>`;
    case 'bitcoin':
      return html`<svg class="sr-payment-method-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11.767 19.089c4.924.868 6.14-6.025 1.216-6.894m-1.216 6.894L5.86 18.047m5.908 1.042-.347 1.97m1.563-8.864c4.924.869 6.14-6.025 1.215-6.893m-1.215 6.893-6.91-1.22m6.91 1.22.347-1.97M7.116 16.94l-2.453-.433.478-2.711m7.455 1.316L5.86 18.047M7.116 4.174l-2.453-.433-.478 2.711m7.455-1.316-6.524-1.15"></path></svg>`;
    case 'banknote':
      return html`<svg class="sr-payment-method-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"></rect><circle cx="12" cy="12" r="2"></circle><path d="M6 12h.01M18 12h.01"></path></svg>`;
    case 'apple':
      return html`<svg class="sr-payment-method-icon" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>`;
    case 'smartphone':
      return html`<svg class="sr-payment-method-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>`;
    default:
      return html`<svg class="sr-payment-method-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>`;
  }
}

function renderPaymentContent(context: CheckoutWizardContext): TemplateResult {
  if (context.paymentMethodsLoading) {
    return html`<div class="sr-payment-methods-loading">${loadingSpinner('md')}</div>`;
  }

  if (!context.paymentMethods.length) {
    return html`
      <div class="sr-payment-placeholder">
        <p>${t('checkout.no_payment_methods', 'No payment methods available')}</p>
        <p>${t('checkout.contact_store', 'Please contact the store for assistance.')}</p>
      </div>
    `;
  }

  return html`
    <div class="sr-payment-methods">
      ${context.paymentMethods.map(method => {
        const isSelected = context.selectedPaymentMethod?.type === method.type
          && context.selectedPaymentMethod?.gateway === method.gateway
          && (context.selectedPaymentMethod?.manualMethodId || context.selectedPaymentMethod?.manual_method_id) === (method.manualMethodId || method.manual_method_id);
        return html`
          <button
            class="sr-payment-method-card ${isSelected ? 'sr-selected' : ''}"
            @click="${() => context.handlePaymentMethodSelect(method)}"
            type="button"
          >
            <div class="sr-payment-method-card-inner">
              ${getPaymentMethodIcon(method)}
              <div class="sr-payment-method-info">
                <span class="sr-payment-method-name">${method.name}</span>
                ${method.description ? html`
                  <span class="sr-payment-method-description">${method.description}</span>
                ` : ''}
              </div>
              <div class="sr-payment-method-radio">
                <div class="sr-radio-circle ${isSelected ? 'sr-radio-selected' : ''}">
                  ${isSelected ? html`<div class="sr-radio-dot"></div>` : ''}
                </div>
              </div>
            </div>
          </button>
        `;
      })}
    </div>
  `;
}

function renderReviewContent(context: CheckoutWizardContext): TemplateResult {
  return html`
    <div class="sr-review-container">
      <!-- Order Summary Card -->
      <div class="sr-review-card">
        <div class="sr-review-card-header">
          <div class="sr-review-card-title">
            <svg class="sr-review-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 11l3 3L22 4"></path>
              <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"></path>
            </svg>
            <h4>Order Summary</h4>
          </div>
          <button class="sr-review-edit-btn" @click="${() => context.exitCheckout()}">
            Edit
          </button>
        </div>

        <div class="sr-review-card-content">
          <!-- Collapsible items toggle -->
          <button class="sr-review-items-toggle" @click="${context.toggleReviewItems}" type="button">
            <span>${context.cart?.itemCount || context.cart?.items?.length || 0} ${(context.cart?.itemCount || context.cart?.items?.length || 0) === 1 ? 'item' : 'items'}</span>
            <svg class="sr-review-items-chevron ${context.reviewItemsExpanded ? 'sr-expanded' : ''}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>

          <!-- Items list (collapsible) -->
          <div class="sr-review-items-collapsible ${context.reviewItemsExpanded ? 'sr-expanded' : ''}">
            <div class="sr-order-items-review">
              ${context.cart?.items?.map(item => html`
                <div class="sr-order-item-review">
                  <div class="sr-order-item-details">
                    <div class="sr-order-item-image-container">
                      <img
                        src="${context.getMediaUrl((item as any).image || item.media?.[0], 'w=64,h=64,fit=cover')}"
                        alt="${item.productName}"
                        class="sr-order-item-image"
                        @load="${(e: Event) => {
                          const img = e.target as HTMLImageElement;
                          img.classList.add('loaded');
                        }}"
                        @error="${(e: Event) => context.handleImageError(e)}"
                      >
                    </div>
                    <div class="sr-order-item-info">
                      <span class="sr-order-item-name">${item.productName}</span>
                      ${item.variantName ? html`
                        <span class="sr-order-item-variant">${item.variantName}</span>
                      ` : ''}
                      <span class="sr-order-item-quantity">Qty: ${item.quantity}</span>
                    </div>
                  </div>
                  <span class="sr-order-item-price">${context.formatPrice(item.price)}</span>
                </div>
              `)}
            </div>
          </div>

          <!-- Totals (always visible) -->
          <div class="sr-order-totals-review">
            <div class="sr-order-total-line">
              <span>Subtotal</span>
              <span>${context.formatPrice(context.cart?.totals?.subtotal)}</span>
            </div>
            ${context.cart?.totals?.discount && context.cart.totals.discount.amount > 0 ? html`
              <div class="sr-order-total-line sr-discount-line">
                <span>Discount</span>
                <span class="sr-discount-amount">-${context.formatPrice(context.cart.totals.discount)}</span>
              </div>
            ` : ''}
            ${context.cart?.totals?.tax ? html`
              <div class="sr-order-total-line">
                <span>Tax</span>
                <span>${context.formatPrice(context.cart.totals.tax)}</span>
              </div>
            ` : ''}
            ${context.cart?.totals?.shipping ? html`
              <div class="sr-order-total-line">
                <span>Shipping</span>
                <span>${context.formatPrice(context.cart.totals.shipping)}</span>
              </div>
            ` : ''}
            <div class="sr-order-total-final">
              <span>Total</span>
              <span class="sr-order-total-amount">${context.formatPrice(context.cart?.totals?.total)}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Details Section (flat rows, no card borders) -->
      <div class="sr-review-details">
        <!-- Contact -->
        <div class="sr-review-row">
          <div class="sr-review-row-header">
            <span class="sr-review-row-label">
              <svg class="sr-review-row-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              Contact
            </span>
            <button class="sr-review-edit-btn" @click="${() => context.setCheckoutStep('customer')}">Edit</button>
          </div>
          <div class="sr-review-row-value">
            ${context.customerData.email}${context.customerData.phone ? html`, ${context.customerData.phone}` : ''}
          </div>
        </div>

        <!-- Ship to -->
        <div class="sr-review-row">
          <div class="sr-review-row-header">
            <span class="sr-review-row-label">
              <svg class="sr-review-row-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"></path>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                <line x1="12" y1="22.08" x2="12" y2="12"></line>
              </svg>
              Ship to
            </span>
            <button class="sr-review-edit-btn" @click="${() => context.setCheckoutStep('shipping')}">Edit</button>
          </div>
          <div class="sr-review-row-value">
            ${context.shippingAddress.line1}${context.shippingAddress.line2 ? html`, ${context.shippingAddress.line2}` : ''}, ${context.shippingAddress.city}, ${context.shippingAddress.state} ${context.shippingAddress.postalCode}, ${context.shippingAddress.country}
          </div>
        </div>

        <!-- Bill to -->
        <div class="sr-review-row">
          <div class="sr-review-row-header">
            <span class="sr-review-row-label">
              <svg class="sr-review-row-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
              Bill to
            </span>
            <button class="sr-review-edit-btn" @click="${() => context.setCheckoutStep(context.sameAsBilling ? 'shipping' : 'billing')}">Edit</button>
          </div>
          <div class="sr-review-row-value">
            ${context.sameAsBilling
              ? 'Same as shipping'
              : html`${context.billingAddress.line1}${context.billingAddress.line2 ? html`, ${context.billingAddress.line2}` : ''}, ${context.billingAddress.city}, ${context.billingAddress.state} ${context.billingAddress.postalCode}, ${context.billingAddress.country}`
            }
          </div>
        </div>

        <!-- Payment -->
        <div class="sr-review-row">
          <div class="sr-review-row-header">
            <span class="sr-review-row-label">
              <svg class="sr-review-row-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                <line x1="1" y1="10" x2="23" y2="10"></line>
              </svg>
              Payment
            </span>
            <button class="sr-review-edit-btn" @click="${() => context.setCheckoutStep('payment')}">Edit</button>
          </div>
          <div class="sr-review-row-value">
            ${context.selectedPaymentMethod?.name || 'Not selected'}
          </div>
        </div>
      </div>

      <!-- Security Notice -->
      <div class="sr-review-security">
        <svg class="sr-security-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0110 0v4"></path>
        </svg>
        <span>Your information is secure and encrypted</span>
      </div>
    </div>
  `;
}