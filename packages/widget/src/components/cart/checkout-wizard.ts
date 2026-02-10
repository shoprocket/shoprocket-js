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
  handleOtpInput: (e: Event, index: number) => void;
  handleOtpKeydown: (e: KeyboardEvent, index: number) => void;
  handleOtpPaste: (e: ClipboardEvent) => void;
  handleResendOtp: () => Promise<void>;
  handleShippingAddressChange: (e: CustomEvent) => void;
  handleSameAsBillingChange: (e: CustomEvent) => void;
  handleBillingAddressChange: (e: CustomEvent) => void;
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
  const canProceed = true; // Let HTML5 validation handle this

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
            return html`
                <!-- Registered customer -->
                <div class="sr-auth-notice">
                  <svg class="sr-auth-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                  </svg>
                  <div class="sr-auth-content">
                    <p class="sr-auth-title">Welcome back!</p>
                    <p class="sr-auth-subtitle">You have an account with this email address.</p>
                  </div>
                </div>

                ${context.showPasswordField ? html`
                  <!-- Password authentication -->
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
                    <label class="sr-field-label" for="password">Password</label>
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

                  <div class="sr-auth-divider">
                    <span>or</span>
                  </div>
                ` : ''}

                <!-- OTP option -->
                <button
                  class="sr-btn ${context.showPasswordField ? 'sr-btn-secondary' : 'sr-btn-primary'}"
                  ?disabled="${context.sendingLoginLink}"
                  @click="${context.handleSendLoginLink}"
                >
                  ${context.sendingLoginLink ? html`
                    <span class="sr-spinner"></span> ${t('action.sending', 'Sending...')}
                  ` : context.showPasswordField ? t('checkout.use_email_verification', 'Use email verification instead') : html`
                    <svg class="sr-btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                    </svg>
                    Send Verification Code
                  `}
                </button>

                <!-- Guest checkout is implicit - they just continue with the main button -->
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

function renderPaymentContent(_context: CheckoutWizardContext): TemplateResult {
  return html`
    <div class="sr-payment-placeholder">
        <p>Payment integration coming soon...</p>
        <p>For now, this will proceed with a test order.</p>
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

      <!-- Contact Information Card -->
      <div class="sr-review-card">
        <div class="sr-review-card-header">
          <div class="sr-review-card-title">
            <svg class="sr-review-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            <h4>Contact Information</h4>
          </div>
          <button class="sr-review-edit-btn" @click="${() => context.setCheckoutStep('customer')}">
            Edit
          </button>
        </div>

        <div class="sr-review-card-content">
          <p class="sr-review-value">${context.customerData.email}</p>
          ${context.customerData.phone ? html`
            <p class="sr-review-value">${context.customerData.phone}</p>
          ` : ''}
        </div>
      </div>

      <!-- Shipping Address Card -->
      <div class="sr-review-card">
        <div class="sr-review-card-header">
          <div class="sr-review-card-title">
            <svg class="sr-review-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"></path>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
            <h4>Shipping Address</h4>
          </div>
          <button class="sr-review-edit-btn" @click="${() => context.setCheckoutStep('shipping')}">
            Edit
          </button>
        </div>

        <div class="sr-review-card-content">
          <div class="sr-review-address">
            ${context.shippingAddress.name ? html`<p>${context.shippingAddress.name}</p>` : ''}
            ${context.shippingAddress.company ? html`<p>${context.shippingAddress.company}</p>` : ''}
            <p>${context.shippingAddress.line1}</p>
            ${context.shippingAddress.line2 ? html`<p>${context.shippingAddress.line2}</p>` : ''}
            <p>${context.shippingAddress.city}, ${context.shippingAddress.state} ${context.shippingAddress.postalCode}</p>
            <p>${context.shippingAddress.country}</p>
          </div>
        </div>
      </div>

      <!-- Billing Address Card -->
      <div class="sr-review-card">
        <div class="sr-review-card-header">
          <div class="sr-review-card-title">
            <svg class="sr-review-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
            <h4>Billing Address</h4>
          </div>
          ${!context.sameAsBilling ? html`
            <button class="sr-review-edit-btn" @click="${() => context.setCheckoutStep('billing')}">
              Edit
            </button>
          ` : ''}
        </div>

        <div class="sr-review-card-content">
          ${context.sameAsBilling ? html`
            <div class="sr-review-same-address">
              <svg class="sr-check-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>Same as shipping address</span>
            </div>
          ` : html`
            <div class="sr-review-address">
              ${context.billingAddress.name ? html`<p>${context.billingAddress.name}</p>` : ''}
              ${context.billingAddress.company ? html`<p>${context.billingAddress.company}</p>` : ''}
              <p>${context.billingAddress.line1}</p>
              ${context.billingAddress.line2 ? html`<p>${context.billingAddress.line2}</p>` : ''}
              <p>${context.billingAddress.city}, ${context.billingAddress.state} ${context.billingAddress.postalCode}</p>
              <p>${context.billingAddress.country}</p>
            </div>
          `}
        </div>
      </div>

      <!-- Payment Method Card (placeholder for now) -->
      <div class="sr-review-card">
        <div class="sr-review-card-header">
          <div class="sr-review-card-title">
            <svg class="sr-review-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
              <line x1="1" y1="10" x2="23" y2="10"></line>
            </svg>
            <h4>Payment Method</h4>
          </div>
          <button class="sr-review-edit-btn" @click="${() => context.setCheckoutStep('payment')}">
            Edit
          </button>
        </div>

        <div class="sr-review-card-content">
          <p class="sr-review-payment-placeholder">Payment will be processed securely</p>
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