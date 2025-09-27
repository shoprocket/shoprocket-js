import { html, type TemplateResult } from 'lit';
import type { Product } from '../types/api';
import { formatProductPrice } from '../utils/formatters';
import { loadingSpinner } from './loading-spinner';
import { isAllStockInCart } from '../utils/cart-utils';

/**
 * Product List Template Helper
 * Provides template methods for rendering product lists
 * Used by ProductCatalog component
 */
export class ProductListTemplates {
  static renderProductList(
    products: Product[],
    isLoading: boolean,
    limit: number,
    errorMessage: string | null,
    successMessage: string | null,
    addedToCartProducts: Set<string>,
    handlers: {
      handleProductClick: (product: Product) => void;
      handleAddToCart: (product: Product) => Promise<void>;
      formatPrice: (price: any) => string;
      getMediaUrl: (media: any) => string;
      handleImageError: (e: Event) => void;
      isLoadingItem: (key: string) => boolean;
    }
  ): TemplateResult {
    // Create skeleton products for initial loading
    const displayProducts = isLoading && !products.length
      ? Array(limit || 12).fill(null).map((_, i) => ({
          id: `skeleton-${i}`,
          name: '',
          price: 0,
          media: [null],
          in_stock: true,
          quick_add_eligible: true
        } as any))
      : products;

    // Empty content for when no products are found
    const emptyContent = !isLoading && !products.length && !errorMessage ? html`
      <div class="sr-empty-state">
        <h3 class="sr-empty-state-title">No products found</h3>
        <p class="sr-empty-state-message">
          There are no products available at the moment.<br> Please check back later.
        </p>
      </div>
    ` : '';

    return html`
      ${errorMessage ? html`
        <div class="sr-error-message">
          ${errorMessage}
        </div>
      ` : ''}
      ${successMessage ? html`
        <div class="sr-success-message">
          ${successMessage}
        </div>
      ` : ''}
      <div class="sr-product-grid" data-shoprocket="product-list" ?data-loading="${isLoading}">
        ${displayProducts.length > 0 
          ? displayProducts.map(product => ProductListTemplates.renderProduct(product, addedToCartProducts, handlers))
          : emptyContent
        }
      </div>
    `;
  }


  static renderProduct(
    product: Product,
    addedToCartProducts: Set<string>,
    handlers: {
      handleProductClick: (product: Product) => void;
      handleAddToCart: (product: Product) => Promise<void>;
      formatPrice: (price: number | string) => string;
      getMediaUrl: (media: any) => string;
      handleImageError: (e: Event) => void;
      isLoadingItem: (key: string) => boolean;
    }
  ): TemplateResult {
    // Check if this is a skeleton product
    const isSkeleton = product.id.startsWith('skeleton-');
    
    // Let the API determine if quick add is eligible - it knows about variants, options, etc.
    const needsOptions = !isSkeleton && product.quick_add_eligible === false;
    const loadingKey = needsOptions ? `viewProduct-${product.id}` : `addToCart-${product.id}`;
    const isLoading = !isSkeleton && handlers.isLoadingItem(loadingKey);
    const isAdded = !isSkeleton && addedToCartProducts.has(product.id);
    const isOutOfStock = !isSkeleton && product.in_stock === false;
    
    // Check if all available stock is already in cart
    const stockStatus = !isSkeleton ? isAllStockInCart(
      product.id, 
      product.default_variant_id, 
      product.inventory_count
    ) : { allInCart: false };
    const allStockInCart = stockStatus.allInCart;
    
    return html`
      <article class="sr-product-card">
        <div class="sr-product-image-container"
             @click="${!isSkeleton ? () => handlers.handleProductClick(product) : null}">
          ${!isSkeleton ? html`
            <!-- Always render img tag to ensure placeholder shows on error -->
            <img 
              src="${product.media?.[0] ? handlers.getMediaUrl(product.media[0]) : '/placeholder-not-found.jpg'}" 
              alt="${product.name}" 
              class="sr-product-image sr-product-image-primary ${product.media?.[1] ? 'has-hover' : ''}"
              @load="${(e: Event) => {
                const img = e.target as HTMLImageElement;
                img.classList.add('loaded');
              }}"
              @error="${(e: Event) => handlers.handleImageError(e)}"
            >
            <!-- Second image (shown on hover if available) -->
            ${product.media?.[1] ? html`
              <img 
                src="${handlers.getMediaUrl(product.media[1])}" 
                alt="${product.name} - Image 2" 
                class="sr-product-image sr-product-image-hover"
                @error="${(e: Event) => handlers.handleImageError(e)}"
              >
            ` : ''}
          ` : ''}
        </div>
        
        <!-- Product Info -->
        <div class="sr-card-content">
          <div class="sr-product-info">
            <h3 class="sr-product-title"
                @click="${!isSkeleton ? () => handlers.handleProductClick(product) : null}">${isSkeleton ? '' : product.name}</h3>
            
            <div>
              <span class="sr-product-price">${isSkeleton ? '' : formatProductPrice(product as any)}</span>
            </div>
          </div>
          
          <!-- Quick Actions -->
          <div class="sr-product-actions">
            <button 
              class="sr-button ${isAdded ? 'sr-button-success' : 'sr-button-primary'}"
              @click="${(e: Event) => { e.stopPropagation(); !isSkeleton && handlers.handleAddToCart(product); }}"
              ?disabled="${isSkeleton || isOutOfStock || allStockInCart}"
            >
              ${isSkeleton ? '' : 
                isOutOfStock ? 'Out of Stock' : 
                allStockInCart ? `Max (${product.inventory_count}) in cart` :
                isAdded ? html`
                  <span class="sr-button-content">
                    <svg class="sr-button-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    Added
                  </span>
                ` : isLoading ? html`<span class="sr-button-content">${loadingSpinner('sm')}</span>` : (needsOptions ? 'Select Options' : 'Add to Cart')}
            </button>
          </div>
        </div>
      </article>
    `;
  }

}