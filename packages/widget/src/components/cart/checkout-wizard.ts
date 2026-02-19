/**
 * Checkout Wizard Rendering
 * Handles multi-step checkout flow: customer → shipping → billing → payment → review
 */
import { html, type TemplateResult } from 'lit';
import { loadingSpinner, loadingOverlay } from '../loading-spinner';
import type { CheckoutStep, CustomerCheckResult } from './cart-types';
import type { CustomerData, CustomerFormErrors } from '../customer-form';
import type { AddressData, AddressFormErrors } from '../address-form';
import type { Cart, CheckoutSettings, TaxBreakdownItem } from '@shoprocket/core';
import { t } from '../../utils/i18n';

/** Renders an info icon with tooltip showing per-jurisdiction tax breakdown (only when multiple items) */
function taxBreakdownTooltip(breakdown: TaxBreakdownItem[] | undefined, context: { formatPrice: (m: any) => string }): TemplateResult | string {
  if (!breakdown || breakdown.length < 2) return '';
  const text = breakdown.map(t => `${t.name} (${t.rate}%): ${context.formatPrice({ amount: t.amount, currency: '', formatted: t.formatted })}`).join('\n');
  return html`<sr-tooltip text="${text}" position="top" wrap><span class="sr-tax-info-icon">ⓘ</span></sr-tooltip>`;
}

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
  paymentStepSkipped: boolean;

  // Review step
  reviewItemsExpanded: boolean;

  // Checkout settings
  checkoutSettings?: CheckoutSettings;
  termsAccepted: boolean;
  marketingOptIn: boolean;
  orderNotes: string;
  handleTermsAcceptedChange: (checked: boolean) => void;
  handleMarketingOptInChange: (checked: boolean) => void;
  handleOrderNotesChange: (value: string) => void;

  // Features
  addressAutocompleteEnabled: boolean;
  visitorCountry: string;

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
      // Skip payment if only one non-manual gateway (auto-selected)
      if (context.paymentStepSkipped) {
        context.setCheckoutStep('review');
        return html`
          <div class="sr-checkout-step">
            ${renderReviewContent(context)}
          </div>
        `;
      }
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
  const settings = context.checkoutSettings;
  const termsMode = settings?.termsMode ?? 'hidden';

  // On payment step, require a method to be selected
  // On review step with required_checkbox, also require terms acceptance
  let canProceed = context.checkoutStep !== 'payment' || !!context.selectedPaymentMethod;
  if (context.checkoutStep === 'review' && termsMode === 'required_checkbox' && !context.termsAccepted) {
    canProceed = false;
  }

  // Show cart summary during checkout (except review step which shows full breakdown in main content)
  const subtotal = context.cart?.totals?.subtotal || { amount: 0, currency: 'USD', formatted: '$0.00' };
  const discount = context.cart?.totals?.discount;
  const hasDiscount = discount && discount.amount > 0;
  const discountCode = context.cart?.discountCode;
  const discountDesc = context.cart?.discountType === 'percentage' && context.cart?.discountValue
    ? `${Math.round(Number(context.cart.discountValue))}% off` : '';

  return html`
    ${context.checkoutStep !== 'review' ? html`
      <div class="sr-cart-subtotal">
        <span class="sr-cart-subtotal-label">${t('cart.subtotal', 'Subtotal')}</span>
        <span class="sr-cart-subtotal-amount">
          <span class="sr-cart-total-price">${context.formatPrice(subtotal)}</span>
        </span>
      </div>
      ${hasDiscount ? html`
        <div class="sr-coupon-applied sr-coupon-applied-compact">
          <div class="sr-coupon-applied-info">
            ${discountCode ? html`<span class="sr-coupon-badge">${discountCode}</span>` : ''}
            ${discountDesc ? html`<span class="sr-coupon-desc">${discountDesc}</span>` : ''}
          </div>
          <span class="sr-coupon-discount">-${context.formatPrice(discount)}</span>
        </div>
        <div class="sr-cart-estimated-total">
          <span class="sr-cart-estimated-total-label">${t('cart.estimated_total', 'Estimated total')}</span>
          <span class="sr-cart-estimated-total-amount">
            <span class="sr-cart-total-price">${context.formatPrice(context.cart?.totals?.total)}</span>
          </span>
        </div>
      ` : ''}
    ` : ''}

    ${context.checkoutStep === 'review' ? renderTermsSection(context) : ''}

    ${context.checkoutStep === 'review' ? html`
      <button
        class="sr-cart-checkout-button"
        @click="${context.handleCheckoutComplete}"
        ?disabled="${context.checkoutLoading || !canProceed}"
      >
        ${context.checkoutLoading ? loadingSpinner('sm') : t('checkout.place_order', 'Place Order')}
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

    ${context.checkoutStep === 'review' ? renderPolicyLinks(context) : ''}
    <p class="sr-cart-powered-by">
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
    </p>
  `;
}

function renderTermsLink(settings: CheckoutSettings): TemplateResult {
  if (settings.termsDisplay === 'url' && settings.termsUrl) {
    return html`<a href="${settings.termsUrl}" target="_blank" rel="noopener noreferrer" class="sr-terms-link">${t('checkout.terms_conditions', 'Terms & Conditions')}</a>`;
  }
  return html`<span class="sr-terms-link">${t('checkout.terms_conditions', 'Terms & Conditions')}</span>`;
}

/** Chevron SVG matching the one used in review items toggle */
const termsChevron = html`<svg class="sr-terms-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

function toggleTermsExpander(e: Event) {
  (e.currentTarget as HTMLElement).closest('.sr-terms-details')?.classList.toggle('sr-expanded');
}

function renderTermsNotice(settings: CheckoutSettings): TemplateResult {
  const noticeText = settings.termsNoticeText
    || t('checkout.terms_notice_default', 'By completing this purchase, you agree to our Terms & Conditions');

  // Text mode: wrap notice in an expandable panel so clicking reveals the full terms
  if (settings.termsDisplay === 'text' && settings.termsText) {
    return html`
      <div class="sr-terms-details">
        <button type="button" class="sr-terms-details-summary" @click="${toggleTermsExpander}">${noticeText} ${termsChevron}</button>
        <div class="sr-terms-text-wrapper">
          <div class="sr-terms-text-overflow">
            <div class="sr-terms-text-content">${settings.termsText}</div>
          </div>
        </div>
      </div>
    `;
  }

  // URL mode with custom notice: show notice + inline link
  if (settings.termsDisplay === 'url' && settings.termsUrl && settings.termsNoticeText) {
    return html`
      <p class="sr-cart-terms">
        ${settings.termsNoticeText} <a href="${settings.termsUrl}" target="_blank" rel="noopener noreferrer" class="sr-terms-link">${t('checkout.view_terms', 'View Terms')}</a>
      </p>
    `;
  }

  // URL mode with default text: "By completing... you agree to our [Terms & Conditions]"
  if (settings.termsDisplay === 'url' && settings.termsUrl) {
    return html`
      <p class="sr-cart-terms">
        ${t('checkout.terms_notice_default_partial', 'By completing this purchase, you agree to our')} ${renderTermsLink(settings)}
      </p>
    `;
  }

  // Fallback: plain notice text
  return html`<p class="sr-cart-terms">${noticeText}</p>`;
}

function renderTermsSection(context: CheckoutWizardContext): TemplateResult {
  const settings = context.checkoutSettings;
  if (!settings) return html``;

  const termsMode = settings.termsMode;

  if (termsMode === 'required_checkbox') {
    const hasTextExpander = settings.termsDisplay === 'text' && settings.termsText;
    return html`
      <label class="sr-terms-checkbox-row">
        <input
          type="checkbox"
          class="sr-terms-checkbox"
          .checked="${context.termsAccepted}"
          @change="${(e: Event) => context.handleTermsAcceptedChange((e.target as HTMLInputElement).checked)}"
        >
        <span class="sr-terms-checkbox-label">
          ${t('checkout.agree_to', 'I agree to the')} ${renderTermsLink(settings)}
        </span>
      </label>
      ${hasTextExpander ? html`
        <div class="sr-terms-details">
          <button type="button" class="sr-terms-details-summary" @click="${toggleTermsExpander}">${t('checkout.view_terms', 'View Terms & Conditions')} ${termsChevron}</button>
          <div class="sr-terms-text-wrapper">
            <div class="sr-terms-text-content">${settings.termsText}</div>
          </div>
        </div>
      ` : ''}
    `;
  }

  if (termsMode === 'notice') {
    return renderTermsNotice(settings);
  }

  // hidden - no terms shown
  return html``;
}

function renderPolicyLinks(context: CheckoutWizardContext): TemplateResult {
  const settings = context.checkoutSettings;
  if (!settings) return html``;

  const { privacyPolicyUrl, refundPolicyUrl } = settings;
  if (!privacyPolicyUrl && !refundPolicyUrl) return html``;

  return html`
    <div class="sr-policy-links">
      ${privacyPolicyUrl ? html`
        <a href="${privacyPolicyUrl}" target="_blank" rel="noopener noreferrer" class="sr-policy-link">${t('checkout.privacy_policy', 'Privacy Policy')}</a>
      ` : ''}
      ${privacyPolicyUrl && refundPolicyUrl ? html`<span class="sr-policy-separator">&middot;</span>` : ''}
      ${refundPolicyUrl ? html`
        <a href="${refundPolicyUrl}" target="_blank" rel="noopener noreferrer" class="sr-policy-link">${t('checkout.refund_policy', 'Refund Policy')}</a>
      ` : ''}
    </div>
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
              <p style="margin-top: 1rem; color: var(--muted-foreground); font-size: 0.875rem;">
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
        .phoneVisibility="${context.checkoutSettings?.phoneNumberField ?? 'optional'}"
        .showMarketing="${context.checkoutSettings?.showMarketingOptIn ?? false}"
        .marketingOptIn="${context.marketingOptIn}"
        @customer-change="${context.handleCustomerChange}"
        @customer-check="${context.handleCustomerCheck}"
        @guest-toggle="${context.handleGuestToggle}"
        @marketing-change="${(e: CustomEvent) => context.handleMarketingOptInChange(e.detail.optIn)}"
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
  const settings = context.checkoutSettings;
  return html`
    <shoprocket-address-form
      title=""
      type="shipping"
      .sdk="${context.sdk}"
      .address="${context.shippingAddress}"
      .errors="${context.shippingErrors}"
      .required="${true}"
      .show-name="${false}"
      .showSameAsBilling="${true}"
      .sameAsBilling="${context.sameAsBilling}"
      .autocompleteEnabled="${context.addressAutocompleteEnabled}"
      .visitorCountry="${context.visitorCountry}"
      .companyVisibility="${settings?.companyNameField ?? 'hidden'}"
      .phoneVisibility="${'hidden'}"
      .line2Visibility="${settings?.addressLine2Field ?? 'optional'}"
      @address-change="${context.handleShippingAddressChange}"
      @same-as-billing-change="${context.handleSameAsBillingChange}"
    ></shoprocket-address-form>
  `;
}

function renderBillingContent(context: CheckoutWizardContext): TemplateResult {
  const settings = context.checkoutSettings;
  return html`
    <shoprocket-address-form
        title=""
        type="billing"
        .sdk="${context.sdk}"
        .address="${context.billingAddress}"
        .errors="${context.billingErrors}"
        .required="${true}"
        .show-name="${false}"
        .autocompleteEnabled="${context.addressAutocompleteEnabled}"
        .visitorCountry="${context.visitorCountry}"
        .companyVisibility="${settings?.companyNameField ?? 'hidden'}"
        .phoneVisibility="${'hidden'}"
        .line2Visibility="${settings?.addressLine2Field ?? 'optional'}"
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
      return html`<svg class="sr-payment-method-icon" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M23.638 14.904c-1.602 6.43-8.113 10.34-14.542 8.736C2.67 22.05-1.244 15.525.362 9.105 1.962 2.67 8.475-1.243 14.9.358c6.43 1.605 10.342 8.115 8.738 14.548v-.002zm-6.35-4.613c.24-1.59-.974-2.45-2.64-3.03l.54-2.153-1.315-.33-.525 2.107c-.345-.087-.705-.167-1.064-.25l.526-2.127-1.32-.33-.54 2.165c-.285-.067-.565-.132-.84-.2l-1.815-.45-.35 1.407s.975.225.955.236c.535.136.63.486.615.766l-1.477 5.92c-.075.166-.24.406-.614.314.015.02-.96-.24-.96-.24l-.66 1.51 1.71.426.93.242-.54 2.19 1.32.327.54-2.17c.36.1.705.19 1.05.273l-.51 2.154 1.32.33.545-2.19c2.24.427 3.93.257 4.64-1.774.57-1.637-.03-2.58-1.217-3.196.854-.193 1.5-.76 1.68-1.93h.01zm-3.01 4.22c-.404 1.64-3.157.75-4.05.53l.72-2.9c.896.23 3.757.67 3.33 2.37zm.41-4.24c-.37 1.49-2.662.735-3.405.55l.654-2.64c.744.18 3.137.524 2.75 2.084v.006z"/></svg>`;
    case 'banknote':
      return html`<svg class="sr-payment-method-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"></rect><circle cx="12" cy="12" r="2"></circle><path d="M6 12h.01M18 12h.01"></path></svg>`;
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
        const isSelected = context.selectedPaymentMethod?.gateway === method.gateway
          && (context.selectedPaymentMethod?.manual_method_id) === (method.manual_method_id);
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
                  <span class="sr-order-item-price">${context.formatPrice(item.subtotal)}</span>
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
                <span>${context.cart.discountCode ? html`
                  <span class="sr-coupon-badge-sm">${context.cart.discountCode}</span>
                  ${context.cart.discountType === 'percentage' && context.cart.discountValue
                    ? html` <span class="sr-discount-desc">${Math.round(Number(context.cart.discountValue))}% off</span>`
                    : ''}
                ` : t('cart.discount', 'Discount')}</span>
                <span class="sr-discount-amount">-${context.formatPrice(context.cart.totals.discount)}</span>
              </div>
            ` : ''}
            ${context.cart?.totals?.tax && context.cart.totals.tax.amount > 0 && !context.cart?.taxInclusive ? html`
              <div class="sr-order-total-line">
                <span>${context.cart.taxBreakdown?.length === 1
                  ? `${context.cart.taxBreakdown[0].name} (${context.cart.taxBreakdown[0].rate}%)`
                  : html`Tax ${taxBreakdownTooltip(context.cart.taxBreakdown, context)}`}</span>
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
            ${context.cart?.totals?.tax && context.cart.totals.tax.amount > 0 && context.cart?.taxInclusive ? html`
              <div class="sr-tax-inclusive-note">
                <span>Includes ${context.formatPrice(context.cart.totals.tax)} ${context.cart.taxBreakdown?.length === 1
                  ? `${context.cart.taxBreakdown[0].name} (${context.cart.taxBreakdown[0].rate}%)`
                  : context.cart.taxBreakdown?.[0]?.name || 'tax'} ${taxBreakdownTooltip(context.cart.taxBreakdown, context)}</span>
              </div>
            ` : ''}
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

        <!-- Ship to (hidden for digital-only carts) -->
        ${context.cart?.requiresShipping !== false ? html`
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
              ${context.shippingAddress.formatted || [context.shippingAddress.line1, context.shippingAddress.city, context.shippingAddress.postalCode, context.shippingAddress.country].filter(Boolean).join(', ')}
            </div>
          </div>
        ` : ''}

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
            <button class="sr-review-edit-btn" @click="${() => context.setCheckoutStep(context.sameAsBilling && context.cart?.requiresShipping !== false ? 'shipping' : 'billing')}">Edit</button>
          </div>
          <div class="sr-review-row-value">
            ${context.sameAsBilling && context.cart?.requiresShipping !== false
              ? 'Same as shipping'
              : (context.billingAddress.formatted || [context.billingAddress.line1, context.billingAddress.city, context.billingAddress.postalCode, context.billingAddress.country].filter(Boolean).join(', '))
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
            ${!context.paymentStepSkipped ? html`
              <button class="sr-review-edit-btn" @click="${() => context.setCheckoutStep('payment')}">Edit</button>
            ` : ''}
          </div>
          <div class="sr-review-row-value">
            ${context.selectedPaymentMethod?.name || 'Not selected'}
          </div>
        </div>

        ${renderOrderExtras(context)}
      </div>
    </div>
  `;
}

function renderOrderExtras(context: CheckoutWizardContext): TemplateResult {
  const settings = context.checkoutSettings;
  const showNotes = settings?.showNotesField ?? false;

  if (!showNotes) return html``;

  return html`
    <div class="sr-review-row sr-review-notes-row ${context.orderNotes ? 'sr-expanded' : ''}">
      <button type="button" class="sr-review-notes-toggle" @click="${(e: Event) => {
        const row = (e.currentTarget as HTMLElement).closest('.sr-review-notes-row')!;
        row.classList.toggle('sr-expanded');
        const textarea = row.querySelector('textarea');
        if (row.classList.contains('sr-expanded') && textarea) textarea.focus();
      }}">
        <span class="sr-review-row-label">
          <svg class="sr-review-row-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
          ${t('checkout.add_note', 'Add a note')}
        </span>
        <svg class="sr-review-notes-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
      </button>
      <div class="sr-review-notes-body">
        <textarea
          id="sr-order-notes"
          class="sr-review-notes-input"
          placeholder="${t('checkout.order_notes_placeholder', 'Special instructions or notes for your order...')}"
          .value="${context.orderNotes}"
          @input="${(e: Event) => context.handleOrderNotesChange((e.target as HTMLTextAreaElement).value)}"
          rows="2"
        ></textarea>
      </div>
    </div>
  `;
}