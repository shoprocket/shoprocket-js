import { html, type TemplateResult, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { ShoprocketElement, EVENTS } from '../core/base-component';
import type { Product } from '../types/api';
import { loadingOverlay } from './loading-spinner';

/**
 * Product View Component - Standalone widget for embedding a single product
 * 
 * @element shoprocket-product-view
 * @fires shoprocket:product:added - When product is added to cart
 * 
 * @attr {string} data-shoprocket - Must be "product-view" to initialize this component
 * @attr {string} [data-product-id] - Product ID to display
 * @attr {string} [data-product-slug] - Product slug to display (alternative to ID)
 * @attr {string} [data-show] - Comma-separated features to show (replaces defaults)
 * @attr {string} [data-hide] - Comma-separated features to hide from defaults
 * 
 * Available features for show/hide:
 * - media: Product images
 * - gallery: Image gallery navigation
 * - zoom: Image zoom on hover
 * - title: Product title
 * - price: Product price
 * - stock: Stock availability
 * - variants: Variant selector
 * - quantity: Quantity selector
 * - add-to-cart: Add to cart button
 * - description: Product description
 * - sku: Product SKU
 * 
 * @example
 * <!-- Basic product embed -->
 * <div data-shoprocket="product-view" 
 *      data-product-id="prod_abc123"></div>
 * 
 * @example
 * <!-- Product by slug -->
 * <div data-shoprocket="product-view" 
 *      data-product-slug="awesome-t-shirt"></div>
 * 
 * @example
 * <!-- Minimal product view -->
 * <div data-shoprocket="product-view"
 *      data-product-slug="awesome-t-shirt"
 *      data-show="media,title,price,add-to-cart"></div>
 * 
 * @example
 * <!-- Product without certain features -->
 * <div data-shoprocket="product-view"
 *      data-product-id="prod_123"
 *      data-hide="zoom,description,sku"></div>
 */
export class ProductView extends ShoprocketElement {
  // Keep Shadow DOM for this top-level widget
  // The product-detail component inside will use Light DOM
  
  @property({ type: String, attribute: 'product-id' })
  productId?: string;
  
  @property({ type: String, attribute: 'product-slug' })
  productSlug?: string;

  @property({ type: Object })
  product?: Product;

  override async connectedCallback(): Promise<void> {
    super.connectedCallback();

    // Always ensure product-detail is registered, regardless of how we get the product
    if (!customElements.get('shoprocket-product')) {
      try {
        const { ProductDetail } = await import('./product-detail');
        customElements.define('shoprocket-product', ProductDetail);
      } catch (err) {
        // Element may have been defined by another component in a race condition
        if (!(err instanceof DOMException && err.name === 'NotSupportedError')) {
          throw err;
        }
      }
    }
  }

  protected override async firstUpdated(_changedProperties: PropertyValues): Promise<void> {
    super.firstUpdated(_changedProperties);

    // Don't load here - wait for updated() to check if product prop was passed
    // Properties are set after firstUpdated
  }
  
  protected override async updated(changedProperties: Map<string, any>): Promise<void> {
    super.updated(changedProperties);

    // If product prop was provided, don't load from ID/slug
    if (this.product) {
      return;
    }

    // Need to load product from ID/slug
    const identifier = this.productId || this.productSlug;
    if (!identifier) {
      return; // No way to load product
    }

    // Load if SDK just became available
    if (changedProperties.has('sdk') && this.sdk) {
      await this.loadProduct(identifier);
      return;
    }

    // Load if identifier changed
    if (changedProperties.has('productId') || changedProperties.has('productSlug')) {
      if (this.sdk) {
        await this.loadProduct(identifier);
      }
      return;
    }

    // Initial load: if we have identifier and SDK but no product yet
    if (identifier && this.sdk && !this.product) {
      await this.loadProduct(identifier);
    }
  }
  
  private async loadProduct(identifier: string): Promise<void> {
    if (!this.sdk) {
      console.error('SDK not available');
      this.showError('Widget not initialized. Please check your configuration.');
      return;
    }

    await this.withLoading('product', async () => {
      try {
        // Load basic product data to pass to detail component
        const productData = await this.sdk!.products.get(identifier);
        this.product = productData;

        // Track view
        this.track(EVENTS.VIEW_ITEM, this.product);

        this.clearError();
      } catch (err: any) {
        console.error('Failed to load product:', err);
        if (err.response?.status === 404 || err.status === 404) {
          this.showError('Product not found. This product may no longer be available.');
        } else {
          this.showError('Unable to load product. Please try again later.');
        }
      }
    });
  }
  
  protected override render(): TemplateResult {
    // Show error state
    if (this.errorMessage) {
      return html`
        <div class="sr-empty-state">
          <h3 class="sr-empty-state-title">Product not available</h3>
          <p class="sr-empty-state-message">${this.errorMessage}</p>
        </div>
      `;
    }

    // Show loading state ONLY if we're loading AND don't have product data yet
    if (this.isLoading('product') && !this.product) {
      return loadingOverlay();
    }

    // Show empty state if no product AND no way to load one
    if (!this.product && !this.productId && !this.productSlug) {
      return html`
        <div class="sr-empty-state">
          <p class="sr-empty-state-message">
            Please specify a product-id or product-slug attribute.
          </p>
        </div>
      `;
    }

    // Always render product-detail if we have data OR are loading
    // The product-detail component handles its own empty/loading states
    return html`
      <div class="sr-product-view-container">
        <shoprocket-product
          .sdk="${this.sdk}"
          .product="${this.product}"
          data-widget-type="product-view"
          data-hide="navigation"
        ></shoprocket-product>
      </div>
    `;
  }
}