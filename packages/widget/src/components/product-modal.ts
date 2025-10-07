import { html } from 'lit';
import { property, state } from 'lit/decorators.js';
import { ShoprocketElement } from '../core/base-component';
import type { Product } from '../types/api';

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

  override async connectedCallback(): Promise<void> {
    super.connectedCallback();

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
            aria-label="Close modal"
          >
            ×
          </button>

          <shoprocket-product-view
            .sdk=${this.sdk}
            .product=${this.product}
            data-product-id=${this.productId || ''}
            data-product-slug=${this.productSlug || ''}
          ></shoprocket-product-view>
        </div>
      </div>
    `;
  }
}
