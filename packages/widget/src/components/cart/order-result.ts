/**
 * Order Result Screens
 * Handles success, failure, and pending payment states
 * These are only needed after order submission, making them ideal for lazy loading
 */
import { html, type TemplateResult } from 'lit';
import { formatTaxRate, type OrderReceipt, type TaxBreakdownItem } from '@shoprocket/core';
import { loadingOverlay } from '../loading-spinner';
import { t } from '../../utils/i18n';

/** Renders an info icon with tooltip showing the named tax lines (only when there are several) */
function taxBreakdownTooltip(breakdown: TaxBreakdownItem[] | undefined, context: { formatPrice: (m: any) => string }): TemplateResult | string {
  if (!breakdown || breakdown.length < 2) return '';
  const text = breakdown.map(line => `${line.name} (${formatTaxRate(line)}%): ${context.formatPrice(line.amount)}`).join('\n');
  return html`<sr-tooltip text="${text}" position="top" wrap><span class="sr-tax-info-icon">ⓘ</span></sr-tooltip>`;
}

/** "VAT (20%)" for a single-line breakdown, or the flat label + tooltip when there are several. */
function taxLabel(breakdown: TaxBreakdownItem[] | undefined, context: { formatPrice: (m: any) => string }): TemplateResult | string {
  const only = breakdown?.length === 1 ? breakdown[0] : undefined;
  if (only) return `${only.name} (${formatTaxRate(only)}%)`;
  return html`Tax ${taxBreakdownTooltip(breakdown, context)}`;
}

export interface OrderResultContext {
  /** Integer cents in, formatted string out - the wire's one money shape. */
  formatPrice: (amount: number | undefined) => string;
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
}

export function renderOrderSuccess(
  orderDetails: Partial<OrderReceipt> | null,
  customerEmail: string,
  context: OrderResultContext
): TemplateResult {
  // The receipt (D48). May legitimately be a narrower shape (the /status poll or the checkout
  // acceptance) when the receipt fetch failed - every field below is optional-chained so the
  // confirmation still renders, just without the summary those shapes cannot carry.
  const receipt = orderDetails;
  const subtotal = receipt?.subtotal;
  const shipping = receipt?.shippingTotal;
  const tax = receipt?.taxTotal;
  const discount = receipt?.discountTotal;
  const giftCard = receipt?.giftCardTotal;
  const total = receipt?.total;

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

      ${receipt ? html`
        <div class="sr-order-details">
          <h3 class="sr-order-details-title">Order Summary</h3>

          ${receipt.orderNumber ? html`
            <div class="sr-order-number-row">
              <span class="sr-order-label">Order Number</span>
              <span class="sr-order-number-value">${receipt.orderNumber}</span>
            </div>
          ` : ''}

          ${receipt.items && receipt.items.length > 0 ? html`
            <div class="sr-order-items-section">
              <div class="sr-items-header">Items (${receipt.items.length})</div>
              ${receipt.items.map((item) => html`
                <div class="sr-order-line-item">
                  ${item.imageUrl ? html`
                    <img
                      class="sr-item-image"
                      src="${item.imageUrl}"
                      alt="${item.name}"
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
                    <div class="sr-item-name">${item.name}</div>
                    ${item.variantName ? html`
                      <div class="sr-item-variant">${item.variantName}</div>
                    ` : ''}
                    <div class="sr-item-qty">Qty: ${item.quantity}</div>
                  </div>
                  <div class="sr-item-price">
                    ${context.formatPrice(item.subtotal)}
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

          ${shipping ? html`
            <div class="sr-order-row">
              <span class="sr-order-label">Shipping${receipt.shippingMethodName ? ` (${receipt.shippingMethodName})` : ''}</span>
              <span class="sr-order-value">${context.formatPrice(shipping)}</span>
            </div>
          ` : ''}

          ${tax && !receipt.taxInclusive ? html`
            <div class="sr-order-row">
              <span class="sr-order-label">${taxLabel(receipt.taxes, context)}</span>
              <span class="sr-order-value">${context.formatPrice(tax)}</span>
            </div>
          ` : ''}

          ${discount ? html`
            <div class="sr-order-row">
              <span class="sr-order-label">Discount${receipt.discountCode ? ` (${receipt.discountCode})` : ''}</span>
              <span class="sr-discount-value">-${context.formatPrice(discount)}</span>
            </div>
          ` : ''}

          ${total ? html`
            <div class="sr-order-total-row">
              <span class="sr-total-label">${receipt.amountDue ? 'Total' : 'Total Paid'}</span>
              <span class="sr-total-value">${context.formatPrice(total)}</span>
            </div>
          ` : ''}
          ${tax && receipt.taxInclusive ? html`
            <div class="sr-tax-inclusive-note">
              <span>Includes ${context.formatPrice(tax)} ${receipt.taxes?.length === 1 && receipt.taxes[0]
                ? `${receipt.taxes[0].name} (${formatTaxRate(receipt.taxes[0])}%)`
                : receipt.taxes?.[0]?.name || 'tax'} ${taxBreakdownTooltip(receipt.taxes, context)}</span>
            </div>
          ` : ''}
          ${giftCard ? html`
            <div class="sr-order-row">
              <span class="sr-order-label">Gift card</span>
              <span class="sr-discount-value">-${context.formatPrice(giftCard)}</span>
            </div>
          ` : ''}
          ${receipt.amountDue ? html`
            <div class="sr-order-total-row">
              <span class="sr-total-label">Amount due</span>
              <span class="sr-total-value">${context.formatPrice(receipt.amountDue)}</span>
            </div>
          ` : ''}
        </div>
        ${receipt.amountDue && receipt.paymentInstructions ? html`
          <div class="sr-payment-instructions">
            <h3 class="sr-order-details-title">${receipt.paymentMethodName || 'How to pay'}</h3>
            <p class="sr-payment-instructions-text">${receipt.paymentInstructions}</p>
          </div>
        ` : ''}
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
