import { html, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { ShoprocketElement, EVENTS } from '../core/base-component';
import type { Product } from '../types/api';

/**
 * Product View Component - Standalone widget for embedding a single product
 * Uses Shadow DOM for isolation, renders product detail in Light DOM inside
 */
export class ProductView extends ShoprocketElement {
  // Keep Shadow DOM for this top-level widget
  // The product-detail component inside will use Light DOM
  
  @property({ type: String, attribute: 'product-id' })
  productId?: string;
  
  @property({ type: String, attribute: 'product-slug' })
  productSlug?: string;
  
  @state()
  private product?: Product;
  
  protected override async firstUpdated(_changedProperties: PropertyValues): Promise<void> {
    super.firstUpdated(_changedProperties);
    
    
    // Load product if we have an identifier and SDK is available
    const identifier = this.productId || this.productSlug;
    if (identifier && this.sdk) {
      await this.loadProduct(identifier);
    } else if (identifier && !this.sdk) {
      // SDK not yet available, it will be set by widget manager
      // and we'll load in the updated() lifecycle
    }
  }
  
  protected override async updated(changedProperties: Map<string, any>): Promise<void> {
    super.updated(changedProperties);
    
    // Check if SDK just became available
    if (changedProperties.has('sdk') && this.sdk && !this.product) {
      const identifier = this.productId || this.productSlug;
      if (identifier) {
        await this.loadProduct(identifier);
      }
    }
    
    // Reload product if identifier changes
    if ((changedProperties.has('productId') || changedProperties.has('productSlug')) && this.sdk) {
      const identifier = this.productId || this.productSlug;
      if (identifier) {
        await this.loadProduct(identifier);
      }
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
    
    // Show loading state
    if (this.isLoading('product') && !this.product) {
      return html`
        <div class="sr-loading-container">
          <div class="sr-loading-spinner"></div>
        </div>
      `;
    }
    
    // Show empty state if no product
    if (!this.product && !this.productId && !this.productSlug) {
      return html`
        <div class="sr-empty-state">
          <p class="sr-empty-state-message">
            Please specify a product-id or product-slug attribute.
          </p>
        </div>
      `;
    }
    
    // Render the product detail component (which uses Light DOM)
    return html`
      <div class="sr-product-view-container">
        ${this.product || this.productId || this.productSlug ? html`
          <shoprocket-product
            .sdk="${this.sdk}"
            .product="${this.product}"
            product-id="${this.productId || ''}"
            product-slug="${this.productSlug || ''}"
            data-widget-type="product-view"
            data-hide="navigation"
          ></shoprocket-product>
        ` : ''}
      </div>
    `;
  }
}