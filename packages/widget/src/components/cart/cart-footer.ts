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
  minimumOrderValue?: number | null;
  onCouponInput: (value: string) => void;
  onApplyCoupon: () => Promise<void>;
  onRemoveCoupon: () => Promise<void>;
  giftCardCode: string;
  giftCardError: string | null;
  giftCardLoading: boolean;
  showGiftCardField: boolean;
  onGiftCardInput: (value: string) => void;
  onApplyGiftCard: () => Promise<void>;
  onRemoveGiftCard: () => Promise<void>;
}

/** Money in the shape formatPrice wants, from a plain minor-unit amount. */
function money(context: CartFooterContext, amount: number) {
  return { amount, currency: (context.cart as any)?.currency || context.cart?.currencyCode || '', formatted: '' };
}

/**
 * The coupon field, and whatever is currently coming off the cart.
 *
 * Reads the server's answer rather than deriving one: `cart.discounts` is every discount applying
 * right now (a typed code AND any automatic ones), and `cart.discountError` says why a typed code
 * is not among them. A code that does not qualify yet is deliberately still held by the server, so
 * the input keeps rendering it with the reason underneath rather than silently dropping it.
 */
function renderCouponSection(context: CartFooterContext): TemplateResult {
  const applied = context.cart?.discounts ?? [];
  const typedCode = context.cart?.discountCode ?? null;
  const codeDiscount = applied.find((d) => !d.automatic) ?? null;
  // The server's rejection wins over any locally-held one: it is the authority on why.
  const error = context.cart?.discountError?.message ?? context.couponError;

  return html`
    ${applied.length ? html`
      <div class="sr-coupon-applied-list">
        ${applied.map((d) => html`
          <div class="sr-coupon-applied">
            <div class="sr-coupon-applied-info">
              <span class="sr-coupon-badge">${d.code ?? d.name}</span>
              ${d.automatic
                ? html`<span class="sr-coupon-desc">${t('cart.automatic_discount', 'Automatic')}</span>`
                : html`
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
                  `}
            </div>
            <span class="sr-coupon-discount">-${context.formatPrice(money(context, d.amount))}</span>
          </div>
        `)}
      </div>
    ` : ''}

    ${codeDiscount ? '' : html`
      <div class="sr-coupon-form">
        <input
          type="text"
          class="sr-coupon-input ${error ? 'sr-field-error' : ''}"
          placeholder="${t('cart.coupon_placeholder', 'Discount code')}"
          .value="${context.couponCode || typedCode || ''}"
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
    `}
    ${error ? html`<p class="sr-coupon-error">${error}</p>` : ''}
  `;
}

/**
 * The gift card field, and the card currently tendered.
 *
 * Deliberately NOT modelled on the coupon field, because a gift card is tender rather than a
 * discount and the server treats it differently: a refused code is NOT stored on the cart (it is a
 * bearer secret), so there is nothing to echo back and the input must hold its own value. That is
 * why the error is read straight off the response into local state rather than off `cart`.
 *
 * `remainingBalance` is the point of the feature - a shopper spending part of a card needs to see
 * what they keep, or the card looks consumed.
 */
function renderGiftCardSection(context: CartFooterContext): TemplateResult {
  const applied = context.cart?.giftCard ?? null;
  const error = context.giftCardError;

  if (applied) {
    return html`
      <div class="sr-giftcard-applied">
        <div class="sr-giftcard-applied-info">
          <span class="sr-giftcard-badge">
            ${t('cart.gift_card_ending', 'Gift card ••••{{last4}}').replace('{{last4}}', applied.last4)}
          </span>
          ${applied.remainingBalance > 0 ? html`
            <span class="sr-giftcard-remaining">
              ${t('cart.gift_card_remaining', '{{amount}} left after this order')
                .replace('{{amount}}', context.formatPrice(money(context, applied.remainingBalance)))}
            </span>
          ` : ''}
        </div>
        <span class="sr-giftcard-amount">-${context.formatPrice(money(context, applied.amount))}</span>
        <button
          class="sr-giftcard-remove-btn"
          @click="${context.onRemoveGiftCard}"
          aria-label="${t('cart.remove_gift_card', 'Remove gift card')}"
          title="${t('cart.remove_gift_card', 'Remove gift card')}"
        >
          <svg class="sr-giftcard-remove-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
          </svg>
        </button>
      </div>
    `;
  }

  return html`
    <div class="sr-giftcard-form">
      <input
        type="text"
        class="sr-giftcard-input ${error ? 'sr-field-error' : ''}"
        placeholder="${t('cart.gift_card_placeholder', 'Gift card code')}"
        .value="${context.giftCardCode}"
        autocomplete="off"
        @input="${(e: Event) => context.onGiftCardInput((e.target as HTMLInputElement).value)}"
        @keydown="${(e: KeyboardEvent) => e.key === 'Enter' && context.giftCardCode && context.onApplyGiftCard()}"
        ?disabled="${context.giftCardLoading}"
      />
      <button
        class="sr-giftcard-apply"
        @click="${context.onApplyGiftCard}"
        ?disabled="${!context.giftCardCode || context.giftCardLoading}"
      >
        ${context.giftCardLoading ? loadingSpinner('sm') : t('cart.apply', 'Apply')}
      </button>
    </div>
    ${error ? html`<p class="sr-giftcard-error">${error}</p>` : ''}
  `;
}

export function renderCartFooter(context: CartFooterContext): TemplateResult {
  const hasDiscount = (context.cart?.discounts?.length ?? 0) > 0;
  const giftCard = context.cart?.giftCard ?? null;
  // `amountDue` is what the gateway will actually collect; `total` is still what the order costs.
  const amountDue = (context.cart?.totals as any)?.amountDue ?? 0;
  const hasGiftCard = !!giftCard;
  const cartTotal = context.cart?.totals?.subtotal?.amount ?? 0;
  const minOrder = context.minimumOrderValue;
  const belowMinimum = minOrder != null && minOrder > 0 && cartTotal < minOrder;

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
    ${context.showGiftCardField ? renderGiftCardSection(context) : ''}
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
    ${hasGiftCard ? html`
      <div class="sr-cart-amount-due">
        <span class="sr-cart-amount-due-label">${t('cart.amount_due', 'Amount due')}</span>
        <span class="sr-cart-amount-due-amount">
          ${keyed(amountDue, html`
            <span class="sr-cart-total-price price-changed">${context.formatPrice(money(context, amountDue))}</span>
          `)}
        </span>
      </div>
    ` : ''}
    ${belowMinimum ? html`
      <p class="sr-minimum-order-notice">
        ${t('cart.minimum_order', 'Minimum order amount is {{amount}}').replace('{{amount}}', context.formatPrice({ amount: minOrder, currency: context.cart?.currency || '', formatted: '' }))}
      </p>
    ` : ''}
    <button
      class="sr-cart-checkout-button"
      @click="${context.startCheckout}"
      ?disabled="${!context.cart?.items?.length || context.chunkLoading || belowMinimum}"
    >
      ${context.chunkLoading ? loadingSpinner('sm') : t('checkout.proceed', 'Checkout')}
    </button>
    <p class="sr-cart-powered-by">
      ${t('cart.taxes_shipping_calculated', 'Taxes and shipping calculated at checkout')}
    </p>
  `;
}
