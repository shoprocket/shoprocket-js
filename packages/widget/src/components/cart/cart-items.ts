/**
 * Cart Items Rendering
 * Handles the display of cart line items including empty state
 */
import { html, type TemplateResult } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { keyed } from 'lit/directives/keyed.js';
import type { Cart } from '@shoprocket/core';

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
        <p class="sr-cart-empty-text">Your cart is empty</p>
        <button
          class="sr-cart-empty-button"
          @click="${() => context.closeCart()}"
        >
          Continue shopping
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
                aria-label="Remove item"
                title="Remove item"
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
                aria-label="Decrease quantity"
              >
                −
              </button>
              <span class="sr-cart-quantity-value">${item.quantity}</span>
              <sr-tooltip
                text="${item.inventoryPolicy === 'deny' && item.inventoryCount !== undefined && item.quantity >= item.inventoryCount ? `Maximum quantity (${item.inventoryCount}) in cart` : ''}"
                position="top"
              >
                <button
                  class="sr-cart-quantity-button"
                  @click="${() => context.updateQuantity(item.id, item.quantity + 1)}"
                  ?disabled="${item.inventoryPolicy === 'deny' && item.inventoryCount !== undefined && item.quantity >= item.inventoryCount}"
                  aria-label="Increase quantity"
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