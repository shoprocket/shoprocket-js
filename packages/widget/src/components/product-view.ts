import { html, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { ShoprocketElement, EVENTS } from '../core/base-component';
import type { Product } from '../types/api';

/**
 * Product View Component - Standalone widget for embedding a single product
 *
 * @element shoprocket-product-view
 * @fires shoprocket:product:added - When product is added to cart
 *
 * @attr {string} data-shoprocket - Must be "product-view" to initialize this component
 * @attr {string} data-product - Product ID or slug to display (API auto-detects format)
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
 * <!-- Product by ID -->
 * <div data-shoprocket="product-view"
 *      data-product="prod_abc123"></div>
 *
 * @example
 * <!-- Product by slug -->
 * <div data-shoprocket="product-view"
 *      data-product="awesome-t-shirt"></div>
 *
 * @example
 * <!-- Minimal product view -->
 * <div data-shoprocket="product-view"
 *      data-product="awesome-t-shirt"
 *      data-show="media,title,price,add-to-cart"></div>
 *
 * @example
 * <!-- Product without certain features -->
 * <div data-shoprocket="product-view"
 *      data-product="prod_123"
 *      data-hide="zoom,description,sku"></div>
 */
export class ProductView extends ShoprocketElement {
  // Keep Shadow DOM for this top-level widget
  // The product-detail component inside will use Light DOM

  @property({ type: String, attribute: 'data-product' })
  product?: string;

  @property({ type: Object })
  productData?: Product;

  @state()
  private hasLoadedProduct = false;

  @state()
  private componentReady = false;

  override async connectedCallback(): Promise<void> {
    super.connectedCallback();

    // Always ensure product-detail is registered, regardless of how we get the product
    if (!customElements.get('shoprocket-product')) {
      try {
        const { ProductDetail } = await import('./product-detail');
        customElements.define('shoprocket-product', ProductDetail);
        this.componentReady = true;
      } catch (err) {
        // Element may have been defined by another component in a race condition
        if (!(err instanceof DOMException && err.name === 'NotSupportedError')) {
          throw err;
        }
        this.componentReady = true;
      }
    } else {
      this.componentReady = true;
    }
  }

  protected override async firstUpdated(_changedProperties: PropertyValues): Promise<void> {
    super.firstUpdated(_changedProperties);

    // Don't load here - wait for updated() to check if product prop was passed
    // Properties are set after firstUpdated
  }
  
  protected override async updated(changedProperties: Map<string, any>): Promise<void> {
    super.updated(changedProperties);

    // If productData prop was provided directly, don't load from identifier
    if (this.productData) {
      return;
    }

    // Need to load product from identifier
    if (!this.product) {
      return; // No way to load product
    }

    // Don't load if already loading or already loaded this product
    if (this.isLoading('product') || this.hasLoadedProduct) {
      return;
    }

    // Load if SDK just became available
    if (changedProperties.has('sdk') && this.sdk) {
      await this.loadProductByIdentifier(this.product);
      return;
    }

    // Load if identifier changed
    if (changedProperties.has('product')) {
      if (this.sdk) {
        this.hasLoadedProduct = false; // Reset flag for new product
        await this.loadProductByIdentifier(this.product);
      }
      return;
    }

    // Initial load: if we have identifier and SDK but no data yet
    if (this.product && this.sdk && !this.productData) {
      await this.loadProductByIdentifier(this.product);
    }
  }
  
  private async loadProductByIdentifier(identifier: string): Promise<void> {
    if (!this.sdk) {
      console.error('SDK not available');
      this.showError('Widget not initialized. Please check your configuration.');
      return;
    }

    await this.withLoading('product', async () => {
      try {
        // Load basic product data to pass to detail component
        const data = await this.sdk!.products.get(identifier);
        this.productData = data;
        this.hasLoadedProduct = true;

        // Track view
        this.track(EVENTS.VIEW_ITEM, this.productData);

        this.clearError();
      } catch (err: any) {
        console.error('Failed to load product:', err);
        this.hasLoadedProduct = true; // Still set to prevent retries
        if (err.response?.status === 404 || err.status === 404) {
          this.showError('Product not found. This product may no longer be available.', 0); // duration: 0 = don't auto-clear
        } else {
          this.showError('Unable to load product. Please try again later.', 0);
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

    // Show empty state if no product AND no way to load one
    if (!this.productData && !this.product) {
      return html`
        <div class="sr-empty-state">
          <p class="sr-empty-state-message">
            Please specify a data-product attribute.
          </p>
        </div>
      `;
    }

    // Show skeleton while component is loading
    if (!this.componentReady) {
      return html`
        <div class="sr-product-view-container sr-product-view-loading">
          <div class="sr-product-detail" data-loading>
            <div class="sr-product-detail-grid">
              <div class="sr-product-detail-media">
                <div class="sr-media-container sr-product-detail-image-main"></div>
              </div>
              <div class="sr-product-detail-info">
                <h1 class="sr-product-detail-title"></h1>
                <div class="sr-product-detail-price"></div>
                <p class="sr-product-detail-summary"></p>
                <button class="sr-button" disabled></button>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    // Render product-detail component (it will show skeleton when productData is undefined)
    return html`
      <div class="sr-product-view-container">
        <shoprocket-product
          .sdk="${this.sdk}"
          .product="${this.productData}"
          data-widget-type="product-view"
          data-hide="navigation"
        ></shoprocket-product>
      </div>
    `;
  }
}