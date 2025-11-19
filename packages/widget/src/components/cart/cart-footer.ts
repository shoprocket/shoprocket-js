/**
 * Cart Footer Rendering
 * Handles subtotal display and checkout button
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
}

export function renderCartFooter(context: CartFooterContext): TemplateResult {
  return html`
    <div class="sr-cart-subtotal">
      <span class="sr-cart-subtotal-label">${t('cart.subtotal', 'Subtotal')}</span>
      <span class="sr-cart-subtotal-amount">
        ${keyed(context.cart?.totals?.total?.amount, html`
          <span class="sr-cart-total-price price-changed">${context.formatPrice(context.cart?.totals?.total)}</span>
        `)}
      </span>
    </div>
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