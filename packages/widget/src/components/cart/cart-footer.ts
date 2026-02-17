/**
 * Cart Footer Rendering
 * Handles subtotal display, coupon code input, and checkout button
 *
 * Display convention (matches Shopify/WooCommerce/BigCommerce):
 *   Subtotal = sum of items BEFORE cart-level discounts
 *   Discount line shown as negative deduction
 *   Estimated total shown when discount is active
 *   Tax & shipping calculated at checkout
 */
import { html, type TemplateResult } from 'lit';
import { keyed } from 'lit/directives/keyed.js';
import { loadingSpinner } from '../loading-spinner';
import type { Cart } from '@shoprocket/core';
import { t } from '../../utils/i18n';

export interface CartFooterContext {
  cart: Cart | null;
  chunkLoading: boolean;
  formatPrice: (amount: any) => string;
  startCheckout: () => Promise<void>;
  couponCode: string;
  couponError: string | null;
  couponLoading: boolean;
  showCouponField: boolean;
  onCouponInput: (value: string) => void;
  onApplyCoupon: () => Promise<void>;
  onRemoveCoupon: () => Promise<void>;
}

function getDiscountLabel(cart: Cart): string {
  if (cart.discountType === 'percentage' && cart.discountValue) {
    const pct = Number(cart.discountValue);
    return `${pct % 1 === 0 ? Math.round(pct) : pct}% off`;
  }
  return '';
}

function renderCouponSection(context: CartFooterContext): TemplateResult {
  const appliedCode = context.cart?.discountCode;
  const discount = context.cart?.totals?.discount;
  const hasDiscount = discount && discount.amount > 0;

  if (appliedCode && hasDiscount) {
    const description = getDiscountLabel(context.cart!);
    return html`
      <div class="sr-coupon-applied">
        <div class="sr-coupon-applied-info">
          <span class="sr-coupon-badge">${appliedCode}</span>
          ${description ? html`<span class="sr-coupon-desc">${description}</span>` : ''}
          <button
            class="sr-coupon-remove-btn"
            @click="${context.onRemoveCoupon}"
            aria-label="${t('cart.remove_discount', 'Remove discount')}"
            title="${t('cart.remove_discount', 'Remove discount')}"
          >
            <svg class="sr-coupon-remove-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
          </button>
        </div>
        <span class="sr-coupon-discount">-${context.formatPrice(discount)}</span>
      </div>
    `;
  }

  return html`
    <div class="sr-coupon-form">
      <input
        type="text"
        class="sr-coupon-input ${context.couponError ? 'sr-field-error' : ''}"
        placeholder="${t('cart.coupon_placeholder', 'Discount code')}"
        .value="${context.couponCode}"
        @input="${(e: Event) => context.onCouponInput((e.target as HTMLInputElement).value)}"
        @keydown="${(e: KeyboardEvent) => e.key === 'Enter' && context.couponCode && context.onApplyCoupon()}"
        ?disabled="${context.couponLoading}"
      />
      <button
        class="sr-coupon-apply"
        @click="${context.onApplyCoupon}"
        ?disabled="${!context.couponCode || context.couponLoading}"
      >
        ${context.couponLoading ? loadingSpinner('sm') : t('cart.apply', 'Apply')}
      </button>
    </div>
    ${context.couponError ? html`<p class="sr-coupon-error">${context.couponError}</p>` : ''}
  `;
}

export function renderCartFooter(context: CartFooterContext): TemplateResult {
  const hasDiscount = context.cart?.totals?.discount && context.cart.totals.discount.amount > 0;

  return html`
    <div class="sr-cart-subtotal">
      <span class="sr-cart-subtotal-label">${t('cart.subtotal', 'Subtotal')}</span>
      <span class="sr-cart-subtotal-amount">
        ${keyed(context.cart?.totals?.subtotal?.amount, html`
          <span class="sr-cart-total-price price-changed">${context.formatPrice(context.cart?.totals?.subtotal)}</span>
        `)}
      </span>
    </div>
    ${context.showCouponField ? renderCouponSection(context) : ''}
    ${hasDiscount ? html`
      <div class="sr-cart-estimated-total">
        <span class="sr-cart-estimated-total-label">${t('cart.estimated_total', 'Estimated total')}</span>
        <span class="sr-cart-estimated-total-amount">
          ${keyed(context.cart?.totals?.total?.amount, html`
            <span class="sr-cart-total-price price-changed">${context.formatPrice(context.cart?.totals?.total)}</span>
          `)}
        </span>
      </div>
    ` : ''}
    <button
      class="sr-cart-checkout-button"
      @click="${context.startCheckout}"
      ?disabled="${!context.cart?.items?.length || context.chunkLoading}"
    >
      ${context.chunkLoading ? loadingSpinner('sm') : t('checkout.proceed', 'Checkout')}
    </button>
    <p class="sr-cart-powered-by">
      ${t('cart.taxes_shipping_calculated', 'Taxes and shipping calculated at checkout')}
    </p>
  `;
}
