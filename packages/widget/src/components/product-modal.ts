import { html } from 'lit';
import { property, state } from 'lit/decorators.js';
import { ShoprocketElement } from '../core/base-component';
import type { Product } from '@shoprocket/core';
import { t } from '../utils/i18n';

/**
 * Product Modal - Reusable modal overlay for displaying product details
 *
 * Used by:
 * - Buy buttons (when product has variants)
 * - Product cards (future)
 * - Catalog quick view (future)
 *
 * @example
 * const modal = document.createElement('shoprocket-product-modal');
 * modal.product = productData;
 * document.body.appendChild(modal);
 */
export class ProductModal extends ShoprocketElement {
  @property({ type: Object }) product?: Product;
  @property({ type: String }) productId?: string;
  @property({ type: String }) productSlug?: string;

  @state() private isClosing = false;

  // Use Light DOM - modal needs to be rendered at document level
  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  /** Inject modal CSS into document head (idempotent) */
  static injectCSS(): void {
    const styleId = 'shoprocket-modal-css';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      shoprocket-product-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .sr-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: var(--overlay, rgba(0, 0, 0, 0.5));
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        overflow-y: auto;
        padding: 1rem;
        animation: sr-modal-fadeIn 0.2s ease-out;
      }
      .sr-modal-content {
        position: relative;
        background: var(--card, white);
        border-radius: var(--radius, 8px);
        max-width: min(90vw, 1200px);
        width: 100%;
        max-height: 90vh;
        overflow-y: auto;
        animation: sr-modal-slideUp 0.3s ease-out;
        z-index: 1;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      }
      .sr-modal-close {
        position: absolute;
        top: 16px;
        right: 16px;
        width: 32px;
        height: 32px;
        border: none;
        background: var(--sr-modal-close-background, rgba(0, 0, 0, 0.1));
        color: var(--sr-modal-close-color, var(--card-foreground, #333));
        border-radius: var(--radius, 8px);
        cursor: pointer;
        font-size: 20px;
        line-height: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2;
        transition: background 0.2s;
      }
      .sr-modal-close:hover {
        background: var(--sr-modal-close-hover-background, rgba(0, 0, 0, 0.2));
      }
      shoprocket-product-modal.closing .sr-modal-overlay {
        animation: sr-modal-fadeOut 0.2s ease-in;
      }
      shoprocket-product-modal.closing .sr-modal-content {
        animation: sr-modal-slideDown 0.2s ease-in;
      }
      @keyframes sr-modal-fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes sr-modal-fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
      }
      @keyframes sr-modal-slideUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes sr-modal-slideDown {
        from { opacity: 1; transform: translateY(0); }
        to { opacity: 0; transform: translateY(20px); }
      }
      @media (max-width: 768px) {
        .sr-modal-overlay { padding: 0; }
        .sr-modal-content {
          width: 100dvw;
          height: 100dvh;
          max-width: 100dvw;
          max-height: 100dvh;
          border-radius: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  override async connectedCallback(): Promise<void> {
    super.connectedCallback();

    // Ensure modal CSS is injected
    ProductModal.injectCSS();

    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';

    // Listen for ESC key
    this.handleKeyDown = this.handleKeyDown.bind(this);
    document.addEventListener('keydown', this.handleKeyDown);

    // Listen for successful add to cart
    this.handleCartUpdate = this.handleCartUpdate.bind(this);
    window.addEventListener('shoprocket:product:added', this.handleCartUpdate);

    // Lazy load product-view component
    if (!customElements.get('shoprocket-product-view')) {
      try {
        const { ProductView } = await import('./product-view');
        customElements.define('shoprocket-product-view', ProductView);
      } catch (err) {
        // Element may have been defined by another component in a race condition
        if (!(err instanceof DOMException && err.name === 'NotSupportedError')) {
          throw err;
        }
      }
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();

    // Restore body scroll
    document.body.style.overflow = '';

    // Cleanup listeners
    document.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('shoprocket:product:added', this.handleCartUpdate);
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      this.close();
    }
  }

  private handleBackdropClick(e: MouseEvent): void {
    // Only close if clicking the overlay itself, not the content
    if (e.target === e.currentTarget) {
      this.close();
    }
  }

  private handleCartUpdate(): void {
    // Auto-close modal after product added to cart
    setTimeout(() => {
      this.close();
    }, 1500); // Give user time to see success message
  }

  public close(): void {
    if (this.isClosing) return;

    this.isClosing = true;
    this.classList.add('closing');

    // Wait for animation to complete
    setTimeout(() => {
      this.dispatchEvent(new CustomEvent('modal:closed', { bubbles: true }));
      this.remove();
    }, 200);
  }

  protected override render() {
    return html`
      <div class="sr-modal-overlay" @click=${this.handleBackdropClick}>
        <div class="sr-modal-content">
          <button
            class="sr-modal-close"
            @click=${this.close}
            aria-label="${t('modal.close', 'Close modal')}"
          >
            ×
          </button>

          <shoprocket-product-view
            .sdk=${this.sdk}
            .productData=${this.product || undefined}
            data-product=${this.productSlug || this.productId || ''}
          ></shoprocket-product-view>
        </div>
      </div>
    `;
  }
}
