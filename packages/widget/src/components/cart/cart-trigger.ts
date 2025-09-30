/**
 * Cart Trigger & Notifications
 * Handles floating cart button, badge, and add-to-cart notifications
 */
import { html, type TemplateResult } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';

export interface CartTriggerContext {
  position: string;
  recentlyAddedProduct: any | null;
  notificationSliding: 'in' | 'out' | null;
  floatingErrorMessage: string | null;
  errorNotificationSliding: 'in' | 'out' | null;
  getMediaUrl: (media: any, transforms?: string) => string;
  formatPrice: (amount: any) => string;
  handleImageError: (e: Event) => void;
}

export function renderTriggerContent(itemCount: number, position: string, shoppingBasketIcon: string): TemplateResult {
  const isMiddle = position.includes('middle');

  if (isMiddle) {
    return html`
      <div class="sr-cart-empty-container">
        ${itemCount > 0 ? html`
          <span class="sr-cart-badge-count">${itemCount}</span>
        ` : ''}
        <span class="sr-cart-icon" aria-hidden="true">${unsafeHTML(shoppingBasketIcon)}</span>
      </div>
    `;
  }

  // Bottom positions - standard layout
  return html`
    <span class="sr-cart-icon" aria-hidden="true">${unsafeHTML(shoppingBasketIcon)}</span>
    ${itemCount > 0 ? html`
      <span class="sr-cart-badge">
        ${itemCount > 99 ? '99+' : itemCount}
      </span>
    ` : ''}
  `;
}

export function renderNotification(context: CartTriggerContext): TemplateResult {
  // Error takes priority over success
  if (context.floatingErrorMessage) {
    // Use middle position for vertical centering with cart toggle
    const verticalPosition = context.position.includes('top') ? 'top' : 'middle';
    const horizontalPosition = context.position.includes('left') ? 'left' : 'right';
    const notificationClasses = `sr-notification-${verticalPosition}-${horizontalPosition}`;

    let animationClass = '';
    if (context.errorNotificationSliding === 'in') {
      animationClass = 'sr-notification-slide-in';
    } else if (context.errorNotificationSliding === 'out') {
      animationClass = 'sr-notification-slide-out';
    }

    return html`
      <div class="sr-add-notification sr-notification-error ${notificationClasses} ${animationClass}">
        <!-- Triangle arrow -->
        ${renderNotificationArrow(context.position)}
        <div class="sr-add-notification-content">
          <svg class="sr-notification-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <div class="sr-add-notification-details">
            <p class="sr-add-notification-title">${context.floatingErrorMessage}</p>
          </div>
        </div>
      </div>
    `;
  }

  if (context.recentlyAddedProduct) {
    const product = context.recentlyAddedProduct;
    // Use same position as cart toggle
    const notificationClasses = `sr-notification-${context.position}`;

    let animationClass = '';
    if (context.notificationSliding === 'in') {
      animationClass = 'sr-notification-slide-in';
    } else if (context.notificationSliding === 'out') {
      animationClass = 'sr-notification-slide-out';
    }

    return html`
      <div class="sr-add-notification ${notificationClasses} ${animationClass}">
        <!-- Triangle arrow -->
        ${renderNotificationArrow(context.position)}
        <div class="sr-add-notification-content">
          ${product.media ? html`
            <div class="sr-add-notification-image">
              <img
                src="${context.getMediaUrl(product.media, 'w=40,h=40,fit=cover')}"
                alt="${product.name}"
                class="sr-add-notification-img"
                @error="${(e: Event) => context.handleImageError(e)}"
              >
            </div>
          ` : ''}
          <div class="sr-add-notification-details">
            <p class="sr-add-notification-title">${product.name}</p>
            <div class="sr-add-notification-info">
              <span class="sr-add-notification-price">${context.formatPrice(product.price)}</span>
              ${product.variantText ? html`
                <span class="sr-add-notification-variant">• ${product.variantText}</span>
              ` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  return html``;
}

function renderNotificationArrow(position: string): TemplateResult {
  const isLeft = position.includes('left');
  const arrowClasses = `sr-notification-arrow sr-notification-arrow-${isLeft ? 'left' : 'right'}`;

  return html`
    <div class="${arrowClasses}">
      <div class="sr-arrow-inner">
      </div>
    </div>
  `;
}