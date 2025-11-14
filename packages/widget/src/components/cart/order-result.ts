/**
 * Order Result Screens
 * Handles success, failure, and pending payment states
 * These are only needed after order submission, making them ideal for lazy loading
 */
import { html, type TemplateResult } from 'lit';
import type { Money } from '@shoprocket/core';
import type { OrderDetails } from './cart-types';
import { loadingOverlay } from '../loading-spinner';

export interface OrderResultContext {
  formatPrice: (money: Money | undefined) => string;
  handleContinueShopping: () => void;
  handleCheckOrderStatus: () => void;
  handleRetryPayment: () => void;
  handleBackToCart: () => void;
  getMediaUrl: (media: any, transforms?: string) => string;
  handleImageError: (e: Event) => void;
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
      <p class="sr-success-subtitle">Thank you for your purchase</p>

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

          ${tax && tax.amount > 0 ? html`
            <div class="sr-order-row">
              <span class="sr-order-label">Tax</span>
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
        <h2 class="sr-pending-title">Payment Taking Longer Than Expected</h2>
        <p class="sr-pending-message">
          Your payment is still being processed. This can sometimes take a few minutes.
        </p>
        <p class="sr-pending-hint">
          Check your email for a confirmation, or you can check your order status below.
        </p>
        <div class="sr-pending-actions">
          <button class="sr-btn sr-btn-primary" @click="${context.handleCheckOrderStatus}">
            Check Order Status
          </button>
          <button class="sr-btn sr-btn-secondary" @click="${context.handleBackToCart}">
            Back to Cart
          </button>
        </div>
      ` : html`
        ${loadingOverlay()}
        <h2 class="sr-pending-title">Processing Payment</h2>
        <p class="sr-pending-message">
          Please wait while we process your payment...
        </p>
      `}
    </div>
  `;
}

export function renderOrderFailure(
  orderFailureReason: string,
  context: OrderResultContext
): TemplateResult {
  return html`
    <div class="sr-order-failure">
      <svg class="sr-failure-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
      </svg>
      <h2 class="sr-failure-title">Payment Failed</h2>
      <p class="sr-failure-message">
        ${orderFailureReason || 'There was a problem processing your payment'}
      </p>
      <div class="sr-failure-actions">
        <button class="sr-btn sr-btn-primary" @click="${context.handleRetryPayment}">
          Try Again
        </button>
        <button class="sr-btn sr-btn-secondary" @click="${context.handleBackToCart}">
          Back to Cart
        </button>
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
