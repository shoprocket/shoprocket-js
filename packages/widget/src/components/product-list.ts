import { html, type TemplateResult } from 'lit';
import type { Product } from '../types/api';
import { skeleton } from '../utils/skeleton';
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
    // Show skeleton loaders while loading
    if (isLoading && !products.length) {
      return ProductListTemplates.renderSkeletonGrid(limit);
    }

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
      <div class="sr-product-grid" data-shoprocket="product-list">
        ${products.length > 0 
          ? products.map(product => ProductListTemplates.renderProduct(product, addedToCartProducts, handlers))
          : emptyContent
        }
      </div>
    `;
  }

  static renderSkeletonGrid(limit: number): TemplateResult {
    const skeletonCount = limit ? Math.min(limit, 8) : 6;
    
    return html`
      <div class="sr-product-grid" data-shoprocket="product-list-skeleton">
        ${Array(skeletonCount).fill(0).map(() => html`
          <div class="sr-product-card-skeleton">
            ${skeleton('image')}
            <div class="sr-product-card-skeleton-content">
              ${skeleton('title')}
              ${skeleton('price')}
              ${skeleton('button')}
            </div>
          </div>
        `)}
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
    const needsOptions = !product.quick_add_eligible || !product.default_variant_id;
    const loadingKey = needsOptions ? `viewProduct-${product.id}` : `addToCart-${product.id}`;
    const isLoading = handlers.isLoadingItem(loadingKey);
    const isAdded = addedToCartProducts.has(product.id);
    const isOutOfStock = product.in_stock === false;
    
    // Check if all available stock is already in cart
    const stockStatus = isAllStockInCart(
      product.id, 
      product.default_variant_id, 
      product.total_inventory
    );
    const allStockInCart = stockStatus.allInCart;
    
    return html`
      <article class="sr-product-card">
        <div class="sr-product-image-container"
             @click="${() => handlers.handleProductClick(product)}">
          <!-- Skeleton for list image -->
          <div class="sr-skeleton" data-skeleton></div>
          <!-- First image -->
          <img 
            src="${handlers.getMediaUrl(product.media?.[0])}" 
            alt="${product.name}" 
            class="sr-product-image sr-product-image-primary ${product.media?.[1] ? 'has-hover' : ''}"
            @load="${(e: Event) => {
              const img = e.target as HTMLImageElement;
              img.classList.add('loaded');
              // Hide skeleton
              const skeleton = img.parentElement?.querySelector('[data-skeleton]');
              if (skeleton) skeleton.remove();
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
        </div>
        
        <!-- Product Info -->
        <div class="sr-card-content">
          <div class="sr-product-info">
            <h3 class="sr-product-title"
                @click="${() => handlers.handleProductClick(product)}">${product.name}</h3>
            
            <div>
              <span class="sr-product-price">${formatProductPrice(product as any)}</span>
            </div>
          </div>
          
          <!-- Quick Actions -->
          <div class="sr-product-actions">
            <button 
              class="sr-button ${isAdded ? 'sr-button-success' : 'sr-button-primary'}"
              @click="${(e: Event) => { e.stopPropagation(); handlers.handleAddToCart(product); }}"
              ?disabled="${isOutOfStock || allStockInCart}"
            >
              ${isOutOfStock ? 'Out of Stock' : 
                allStockInCart ? `Max (${product.total_inventory}) in cart` :
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