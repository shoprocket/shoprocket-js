/**
 * Order Result Screens
 * Handles success, failure, and pending payment states
 * These are only needed after order submission, making them ideal for lazy loading
 */
import { html, type TemplateResult } from 'lit';
import type { Money, TaxBreakdownItem } from '@shoprocket/core';
import type { OrderDetails } from './cart-types';
import { loadingOverlay } from '../loading-spinner';
import { t } from '../../utils/i18n';

/** Renders an info icon with tooltip showing per-jurisdiction tax breakdown (only when multiple items) */
function taxBreakdownTooltip(breakdown: TaxBreakdownItem[] | undefined, context: { formatPrice: (m: any) => string }): TemplateResult | string {
  if (!breakdown || breakdown.length < 2) return '';
  const text = breakdown.map(t => `${t.name} (${t.rate}%): ${context.formatPrice({ amount: t.amount, currency: '', formatted: t.formatted })}`).join('\n');
  return html`<sr-tooltip text="${text}" position="top" wrap><span class="sr-tax-info-icon">ⓘ</span></sr-tooltip>`;
}

export interface OrderResultContext {
  formatPrice: (money: Money | undefined) => string;
  handleContinueShopping: () => void;
  handleCheckOrderStatus: () => void;
  handleRetryPayment: () => void;
  handleBackToCart: () => void;
  getMediaUrl: (media: any, transforms?: string) => string;
  handleImageError: (e: Event) => void;
  checkingOrderStatus: boolean;

  // Checkout settings
  confirmationMessage?: string | null;
  redirectAfterCheckout?: boolean;
  redirectUrl?: string | null;
  redirecting?: boolean;

  // Account creation (order success only)
  isAuthenticated: boolean;
  accountPassword: string;
  creatingAccount: boolean;
  accountCreated: boolean;
  accountError: string;
  handleAccountPasswordInput: (e: Event) => void;
  handleCreateAccount: () => Promise<void>;
}

export function renderOrderSuccess(
  orderDetails: OrderDetails | null,
  customerEmail: string,
  context: OrderResultContext
): TemplateResult {
  const orderData = orderDetails?.data || orderDetails;

  // All APIs now use consistent nested totals structure
  const subtotal = orderData?.totals?.subtotal;
  const shipping = orderData?.totals?.shipping;
  const tax = orderData?.totals?.tax;
  const discount = orderData?.totals?.discount;
  const total = orderData?.totals?.total;

  return html`
    <div class="sr-order-success">
      <div class="sr-success-icon">
        <svg fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
        </svg>
      </div>

      <h2 class="sr-success-title">Order Confirmed!</h2>
      <p class="sr-success-subtitle">${context.confirmationMessage || t('checkout.thank_you', 'Thank you for your purchase')}</p>

      ${context.redirecting && context.redirectUrl ? html`
        <div class="sr-redirect-notice">
          <p class="sr-redirect-text">${t('checkout.redirecting', 'Redirecting you...')}</p>
          <a href="${context.redirectUrl}" class="sr-redirect-link">${t('checkout.click_if_not_redirected', 'Click here if not redirected')}</a>
        </div>
      ` : ''}

      ${customerEmail && customerEmail.trim() ? html`
        <div class="sr-email-notice">
          <p class="sr-email-label">A confirmation email has been sent to:</p>
          <p class="sr-email-address">${customerEmail}</p>
        </div>
      ` : ''}

      ${orderData ? html`
        <div class="sr-order-details">
          <h3 class="sr-order-details-title">Order Summary</h3>

          ${orderData.order?.number ? html`
            <div class="sr-order-number-row">
              <span class="sr-order-label">Order Number</span>
              <span class="sr-order-number-value">${orderData.order.number}</span>
            </div>
          ` : ''}

          ${orderData.items && orderData.items.length > 0 ? html`
            <div class="sr-order-items-section">
              <div class="sr-items-header">Items (${orderData.items.length})</div>
              ${orderData.items.map((item: any) => html`
                <div class="sr-order-line-item">
                  ${item.image ? html`
                    <img
                      class="sr-item-image"
                      src="${context.getMediaUrl(item.image, '&w=80&h=80&fit=cover')}"
                      alt="${item.productName}"
                      @error="${context.handleImageError}"
                    />
                  ` : html`
                    <div class="sr-item-image-placeholder">
                      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                  `}
                  <div class="sr-item-info">
                    <div class="sr-item-name">${item.productName}</div>
                    ${item.variantName ? html`
                      <div class="sr-item-variant">${item.variantName}</div>
                    ` : ''}
                    <div class="sr-item-qty">Qty: ${item.quantity}</div>
                  </div>
                  <div class="sr-item-price">
                    ${context.formatPrice(item.subtotal || { amount: item.price * item.quantity, currency: orderData.currency, formatted: '' })}
                  </div>
                </div>
              `)}
            </div>
          ` : ''}

          ${subtotal ? html`
            <div class="sr-order-row">
              <span class="sr-order-label">Subtotal</span>
              <span class="sr-order-value">${context.formatPrice(subtotal)}</span>
            </div>
          ` : ''}

          ${shipping && shipping.amount > 0 ? html`
            <div class="sr-order-row">
              <span class="sr-order-label">Shipping</span>
              <span class="sr-order-value">${context.formatPrice(shipping)}</span>
            </div>
          ` : ''}

          ${tax && tax.amount > 0 && !orderData?.taxInclusive ? html`
            <div class="sr-order-row">
              <span class="sr-order-label">${orderData?.taxBreakdown?.length === 1
                ? `${orderData.taxBreakdown[0].name} (${orderData.taxBreakdown[0].rate}%)`
                : html`Tax ${taxBreakdownTooltip(orderData?.taxBreakdown, context)}`}</span>
              <span class="sr-order-value">${context.formatPrice(tax)}</span>
            </div>
          ` : ''}

          ${discount && discount.amount > 0 ? html`
            <div class="sr-order-row">
              <span class="sr-order-label">Discount</span>
              <span class="sr-discount-value">-${context.formatPrice(discount)}</span>
            </div>
          ` : ''}

          ${total ? html`
            <div class="sr-order-total-row">
              <span class="sr-total-label">Total Paid</span>
              <span class="sr-total-value">${context.formatPrice(total)}</span>
            </div>
          ` : ''}
          ${tax && tax.amount > 0 && orderData?.taxInclusive ? html`
            <div class="sr-tax-inclusive-note">
              <span>Includes ${context.formatPrice(tax)} ${orderData?.taxBreakdown?.length === 1
                ? `${orderData.taxBreakdown[0].name} (${orderData.taxBreakdown[0].rate}%)`
                : orderData?.taxBreakdown?.[0]?.name || 'tax'} ${taxBreakdownTooltip(orderData?.taxBreakdown, context)}</span>
            </div>
          ` : ''}
        </div>
      ` : ''}

      ${!context.isAuthenticated ? html`
        <div class="sr-account-creation-section">
          ${context.accountCreated ? html`
            <div class="sr-account-created">
              <svg class="sr-account-created-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <p class="sr-account-created-text">${t('account.created', 'Account created!')}</p>
            </div>
          ` : html`
            <h4 class="sr-account-creation-title">${t('account.save_details', 'Save your details for next time')}</h4>
            <p class="sr-account-creation-subtitle">${t('account.speed_checkout', 'Speed through checkout on your next order.')}</p>

            <div class="sr-account-creation-form">
              <div class="sr-field-group">
                <input
                  type="password"
                  id="account-password"
                  class="sr-field-input peer ${context.accountPassword ? 'has-value' : ''}"
                  .value="${context.accountPassword}"
                  placeholder=" "
                  autocomplete="new-password"
                  @input="${context.handleAccountPasswordInput}"
                >
                <label class="sr-field-label" for="account-password">${t('field.password', 'Password')}</label>
              </div>

              ${context.accountError ? html`
                <div class="sr-field-error-message">${context.accountError}</div>
              ` : ''}

              <button
                class="sr-btn sr-btn-primary"
                ?disabled="${!context.accountPassword || context.creatingAccount}"
                @click="${context.handleCreateAccount}"
              >
                ${context.creatingAccount ? html`
                  <span class="sr-spinner"></span> ${t('account.creating', 'Creating account...')}
                ` : t('account.create', 'Create Account')}
              </button>
            </div>
          `}
        </div>
      ` : ''}

      <button class="sr-btn sr-btn-primary sr-continue-btn" @click="${context.handleContinueShopping}">
        Continue Shopping
      </button>
    </div>
  `;
}

export function renderPaymentPending(
  paymentTimeout: boolean,
  context: OrderResultContext
): TemplateResult {
  return html`
    <div class="sr-payment-pending">
      ${paymentTimeout ? html`
        <svg class="sr-pending-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <h2 class="sr-pending-title">${t('payment.taking_longer', 'Payment Taking Longer Than Expected')}</h2>
        <p class="sr-pending-message">
          ${t('payment.still_processing', 'Your payment is still being processed. This can sometimes take a few minutes.')}
        </p>
        <p class="sr-pending-hint">
          ${t('payment.check_email_hint', 'Check your email for a confirmation, or you can check your order status below.')}
        </p>
        <div class="sr-pending-actions">
          <button class="sr-btn sr-btn-primary" ?disabled="${context.checkingOrderStatus}" @click="${context.handleCheckOrderStatus}">
            ${context.checkingOrderStatus ? html`
              <span class="sr-spinner"></span> ${t('payment.checking_status', 'Checking...')}
            ` : t('payment.check_status', 'Check Order Status')}
          </button>
        </div>
        <p class="sr-pending-reassurance">
          ${t('payment.charged_reassurance', 'If you were charged, your order will be confirmed shortly. Check your email for confirmation.')}
        </p>
      ` : html`
        ${loadingOverlay()}
        <h2 class="sr-pending-title">${t('payment.processing', 'Processing Payment')}</h2>
        <p class="sr-pending-message">
          ${t('payment.please_wait', 'Please wait while we confirm your payment...')}
        </p>
        <p class="sr-pending-hint sr-pending-hint-polling">
          ${t('payment.do_not_close', 'Please do not close this window.')}
        </p>
      `}
    </div>
  `;
}

export function renderOrderFailure(
  orderFailureReason: string,
  context: OrderResultContext,
  errorCode?: string
): TemplateResult {
  const isValidationError = errorCode === 'CART_VALIDATION_FAILED';
  const title = isValidationError
    ? t('error.checkout_issue', 'Checkout Issue')
    : t('error.payment_failed', 'Payment Failed');
  const defaultMessage = isValidationError
    ? t('error.cart_validation_failed', 'Please review your cart and try again')
    : t('error.payment_processing_failed', 'There was a problem processing your payment');

  // Split multi-line messages (from multiple validation errors)
  const messages = (orderFailureReason || defaultMessage).split('\n').filter(Boolean);

  return html`
    <div class="sr-order-failure">
      <svg class="sr-failure-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
      </svg>
      <h2 class="sr-failure-title">${title}</h2>
      ${messages.length > 1
        ? html`<ul class="sr-failure-messages">${messages.map(m => html`<li>${m}</li>`)}</ul>`
        : html`<p class="sr-failure-message">${messages[0]}</p>`
      }
      <div class="sr-failure-actions">
        <button class="sr-btn sr-btn-primary" @click="${isValidationError ? context.handleBackToCart : context.handleRetryPayment}">
          ${isValidationError ? t('action.review_cart', 'Review Cart') : t('action.try_again', 'Try Again')}
        </button>
        ${!isValidationError ? html`
          <button class="sr-btn sr-btn-secondary" @click="${context.handleBackToCart}">
            ${t('action.back_to_cart', 'Back to Cart')}
          </button>
        ` : ''}
      </div>
    </div>
  `;
}

export function renderOrderNotFound(context: OrderResultContext): TemplateResult {
  return html`
    <div class="sr-order-not-found">
      <svg class="sr-not-found-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
      </svg>
      <h2 class="sr-not-found-title">Order Not Found</h2>
      <p class="sr-not-found-message">
        Unable to find order details. If you just completed a payment, please check your email for confirmation.
      </p>
      <div class="sr-not-found-actions">
        <button class="sr-btn sr-btn-primary" @click="${context.handleContinueShopping}">
          Continue Shopping
        </button>
      </div>
    </div>
  `;
}
