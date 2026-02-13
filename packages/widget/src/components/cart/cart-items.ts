/**
 * Cart Items Rendering
 * Handles the display of cart line items including empty state
 */
import { html, type TemplateResult } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { keyed } from 'lit/directives/keyed.js';
import type { Cart } from '@shoprocket/core';
import { t } from '../../utils/i18n';

export interface CartItemsContext {
  cart: Cart | null;
  showEmptyState: boolean;
  removingItems: Set<string>;
  closeCart: () => void;
  navigateToProduct: (item: any) => void;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  formatPrice: (amount: any) => string;
  getMediaUrl: (media: any, transforms?: string) => string;
  handleImageError: (e: Event) => void;
}

export function renderCartItems(context: CartItemsContext): TemplateResult {
  if (!context.cart?.items?.length || context.showEmptyState) {
    return html`
      <div class="sr-cart-empty">
        <svg class="sr-cart-empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path>
        </svg>
        <p class="sr-cart-empty-text">${t('cart.empty', 'Your cart is empty')}</p>
        <button
          class="sr-cart-empty-button"
          @click="${() => context.closeCart()}"
        >
          ${t('action.continue_shopping', 'Continue shopping')}
        </button>
      </div>
    `;
  }

  return html`
    ${repeat(
      context.cart.items,
      (item: any) => item.id,
      (item: any) => html`
      <div class="sr-cart-item-container ${context.removingItems.has(item.id) ? 'removing' : ''}">
        <div class="sr-cart-item">
        <!-- Product Image -->
        <div class="sr-cart-item-image"
             @click="${() => context.navigateToProduct(item)}">
          <img
            src="${context.getMediaUrl((item as any).image || item.media?.[0], 'w=128,h=128,fit=cover')}"
            srcset="${context.getMediaUrl((item as any).image || item.media?.[0], 'w=128,h=128,fit=cover')} 1x,
                    ${context.getMediaUrl((item as any).image || item.media?.[0], 'w=256,h=256,fit=cover')} 2x,
                    ${context.getMediaUrl((item as any).image || item.media?.[0], 'w=384,h=384,fit=cover')} 3x"
            alt="${item.productName}"
            width="128"
            height="128"
            @load="${(e: Event) => {
              const img = e.target as HTMLImageElement;
              img.classList.add('loaded');
            }}"
            @error="${(e: Event) => context.handleImageError(e)}"
          >
        </div>

        <!-- Product Details -->
        <div class="sr-cart-item-content">
          <div class="sr-cart-item-header">
            <div class="sr-cart-item-info">
              <h4 class="sr-cart-item-title"
                  @click="${() => context.navigateToProduct(item)}">${item.productName}</h4>
              ${item.variantName ? html`
                <div class="sr-cart-item-variant">${item.variantName}</div>
              ` : ''}
              ${item.bundleSelections?.length ? html`
                <details class="sr-cart-bundle-details">
                  <summary class="sr-cart-bundle-toggle">
                    <span class="sr-cart-bundle-show">${t('bundle.show_contents', 'Show contents')}</span>
                    <span class="sr-cart-bundle-hide">${t('bundle.hide_contents', 'Hide contents')}</span>
                  </summary>
                  <div class="sr-cart-bundle-items">
                    ${item.bundleSelections.map((sel: any) => html`
                      <div class="sr-cart-bundle-item">
                        ${sel.media ? html`
                          <img class="sr-cart-bundle-item-img"
                            src="${context.getMediaUrl(sel.media, 'w=48,h=48,fit=cover')}"
                            alt="${sel.productName}"
                            width="24" height="24"
                          />
                        ` : ''}
                        <span class="sr-cart-bundle-item-qty">${sel.quantity}x</span>
                        <div class="sr-cart-bundle-item-info">
                          <span class="sr-cart-bundle-item-name">${sel.productName}</span>
                          ${sel.variantName ? html`<span class="sr-cart-bundle-item-variant">${sel.variantName}</span>` : ''}
                        </div>
                      </div>
                    `)}
                  </div>
                </details>
              ` : ''}
            </div>
          </div>

          <div class="sr-cart-item-footer">
            <div class="sr-cart-item-price">
              ${keyed((item.subtotal?.amount ?? (item.price?.amount || 0) * (item.quantity || 0)), html`
                <span class="sr-cart-item-subtotal price-changed">
                  ${context.formatPrice(
                    item.subtotal !== undefined
                      ? item.subtotal
                      : (item.price?.amount || 0) * (item.quantity || 0)
                  )}
                </span>
              `)}
            </div>

            <!-- Quantity Controls with Remove Button -->
            <div class="sr-cart-item-quantity">
              <!-- Remove Button -->
              <button
                class="sr-cart-item-remove"
                @click="${() => context.removeItem(item.id)}"
                aria-label="${t('cart.remove', 'Remove item')}"
                title="${t('cart.remove', 'Remove item')}"
              >
                <svg class="sr-button-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                </svg>
              </button>
              <div class="sr-cart-quantity">
              <button
                class="sr-cart-quantity-button"
                @click="${() => context.updateQuantity(item.id, item.quantity - 1)}"
                ?disabled="${item.quantity === 1}"
                aria-label="${t('cart.decrease_quantity', 'Decrease quantity')}"
              >
                −
              </button>
              <span class="sr-cart-quantity-value">${item.quantity}</span>
              <sr-tooltip
                text="${item.inventoryPolicy === 'deny' && item.inventoryCount !== undefined && item.quantity >= item.inventoryCount ? t('product.max_quantity_in_cart', 'Maximum quantity ({count}) in cart', { count: item.inventoryCount }) : ''}"
                position="top"
              >
                <button
                  class="sr-cart-quantity-button"
                  @click="${() => context.updateQuantity(item.id, item.quantity + 1)}"
                  ?disabled="${item.inventoryPolicy === 'deny' && item.inventoryCount !== undefined && item.quantity >= item.inventoryCount}"
                  aria-label="${t('cart.increase_quantity', 'Increase quantity')}"
                >
                  +
                </button>
              </sr-tooltip>
            </div>
          </div>
        </div>
      </div>
    </div>
    `
    )}
  `;
}