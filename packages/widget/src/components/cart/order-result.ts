/**
 * Order Result Screens
 * Handles success, failure, and pending payment states
 * These are only needed after order submission, making them ideal for lazy loading
 */
import { html, type TemplateResult } from 'lit';
import type { Money } from '../../types/api';
import type { OrderDetails } from './cart-types';
import { loadingSpinner } from '../loading-spinner';

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

  return html`
    <div class="sr-order-success" style="text-align: center; padding: 2rem 1rem;">
      <!-- Success icon with filled green background -->
      <div style="width: 80px; height: 80px; background: rgba(34, 197, 94, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem;">
        <svg style="width: 40px; height: 40px; color: var(--color-success, #22c55e);" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
        </svg>
      </div>

      <h2 style="font-size: 1.5rem; font-weight: 600; color: var(--color-text); margin: 0 0 0.5rem;">Order Confirmed!</h2>
      <p style="color: var(--color-text-muted); margin: 0 0 1.5rem;">Thank you for your purchase</p>

      <!-- Email confirmation notice -->
      ${customerEmail ? html`
        <div style="background: var(--color-surface-accent, #f9fafb); border-radius: 0.5rem; padding: 1rem; margin: 0 0 1.5rem;">
          <p style="font-size: 0.875rem; color: var(--color-text); margin: 0 0 0.5rem;">
            📧 A confirmation email has been sent to:
          </p>
          <p style="font-size: 0.875rem; color: var(--color-text); font-weight: 500; margin: 0;">
            ${customerEmail}
          </p>
        </div>
      ` : ''}

      <!-- Order details -->
      ${orderData ? html`
        <div style="text-align: left; background: white; border: 1px solid var(--color-border, #e5e7eb); border-radius: 0.5rem; padding: 1rem; margin: 0 0 1.5rem;">
          <h3 style="font-size: 0.875rem; font-weight: 600; color: var(--color-text); margin: 0 0 0.75rem;">Order Summary</h3>

          ${orderData.order_number ? html`
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--color-border, #f3f4f6);">
              <span style="font-size: 0.75rem; color: var(--color-text-muted);">Order Number</span>
              <span style="font-size: 0.75rem; font-family: monospace; color: var(--color-text);">${orderData.order_number}</span>
            </div>
          ` : ''}

          ${orderData.items ? html`
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--color-border, #f3f4f6);">
              <span style="font-size: 0.75rem; color: var(--color-text-muted);">Items</span>
              <span style="font-size: 0.75rem; font-weight: 500; color: var(--color-text);">${orderData.items.length}</span>
            </div>
          ` : ''}

          ${orderData.subtotal ? html`
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--color-border, #f3f4f6);">
              <span style="font-size: 0.75rem; color: var(--color-text-muted);">Subtotal</span>
              <span style="font-size: 0.75rem; color: var(--color-text);">${context.formatPrice(orderData.subtotal)}</span>
            </div>
          ` : ''}

          ${orderData.shipping_cost && orderData.shipping_cost.amount > 0 ? html`
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--color-border, #f3f4f6);">
              <span style="font-size: 0.75rem; color: var(--color-text-muted);">Shipping</span>
              <span style="font-size: 0.75rem; color: var(--color-text);">${context.formatPrice(orderData.shipping_cost)}</span>
            </div>
          ` : ''}

          ${orderData.tax_amount && orderData.tax_amount.amount > 0 ? html`
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--color-border, #f3f4f6);">
              <span style="font-size: 0.75rem; color: var(--color-text-muted);">Tax</span>
              <span style="font-size: 0.75rem; color: var(--color-text);">${context.formatPrice(orderData.tax_amount)}</span>
            </div>
          ` : ''}

          ${orderData.discount_amount && orderData.discount_amount.amount > 0 ? html`
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--color-border, #f3f4f6);">
              <span style="font-size: 0.75rem; color: var(--color-text-muted);">Discount</span>
              <span style="font-size: 0.75rem; color: var(--color-success, #22c55e);">-${context.formatPrice(orderData.discount_amount)}</span>
            </div>
          ` : ''}

          ${orderData.total ? html`
            <div style="display: flex; justify-content: space-between; padding: 0.75rem 0 0;">
              <span style="font-size: 0.875rem; font-weight: 600; color: var(--color-text);">Total Paid</span>
              <span style="font-size: 0.875rem; font-weight: 600; color: var(--color-primary);">${context.formatPrice(orderData.total)}</span>
            </div>
          ` : ''}
        </div>
      ` : ''}

      <button
        class="sr-btn sr-btn-primary"
        @click="${context.handleContinueShopping}"
        style="width: 100%; max-width: 200px;"
      >
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
    <div class="sr-payment-pending" style="text-align: center; padding: 3rem 1rem; min-height: 400px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
      ${paymentTimeout ? html`
        <!-- Timeout state -->
        <svg style="width: 64px; height: 64px; color: var(--color-warning, #f59e0b); margin: 0 auto 1.5rem;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <h2 style="font-size: 1.5rem; font-weight: 600; color: var(--color-text); margin: 0 0 0.5rem;">Payment Taking Longer Than Expected</h2>
        <p style="color: var(--color-text-muted); margin: 0 0 1.5rem; max-width: 400px;">
          Your payment is still being processed. This can sometimes take a few minutes.
        </p>
        <p style="color: var(--color-text-muted); margin: 0 0 2rem; max-width: 400px; font-size: 0.875rem;">
          Check your email for a confirmation, or you can check your order status below.
        </p>
        <div style="display: flex; gap: 1rem; flex-wrap: wrap; justify-content: center;">
          <button
            class="sr-btn sr-btn-primary"
            @click="${context.handleCheckOrderStatus}"
          >
            Check Order Status
          </button>
          <button
            class="sr-btn sr-btn-secondary"
            @click="${context.handleBackToCart}"
          >
            Back to Cart
          </button>
        </div>
      ` : html`
        <!-- Loading state -->
        ${loadingSpinner('lg')}
        <h2 style="font-size: 1.5rem; font-weight: 600; color: var(--color-text); margin: 1.5rem 0 0.5rem;">Processing Payment</h2>
        <p style="color: var(--color-text-muted); margin: 0; max-width: 400px;">
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
    <div class="sr-order-failure" style="text-align: center; padding: 3rem 1rem;">
      <svg style="width: 64px; height: 64px; color: var(--color-error, #ef4444); margin: 0 auto 1.5rem;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
      </svg>
      <h2 style="font-size: 1.5rem; font-weight: 600; color: var(--color-text); margin: 0 0 0.5rem;">Payment Failed</h2>
      <p style="color: var(--color-text-muted); margin: 0 0 1.5rem; max-width: 400px;">
        ${orderFailureReason || 'There was a problem processing your payment'}
      </p>
      <div style="display: flex; gap: 1rem; flex-wrap: wrap; justify-content: center;">
        <button
          class="sr-btn sr-btn-primary"
          @click="${context.handleRetryPayment}"
        >
          Try Again
        </button>
        <button
          class="sr-btn sr-btn-secondary"
          @click="${context.handleBackToCart}"
        >
          Back to Cart
        </button>
      </div>
    </div>
  `;
}