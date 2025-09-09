import { html, type TemplateResult, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { ShoprocketElement } from '../core/base-component';
import type { Product, ApiResponse } from '../types/api';
import { renderErrorNotification, renderSuccessNotification } from './error-notification';
import { loadingSpinner } from './loading-spinner';

/**
 * Product List Component
 */
@customElement('shoprocket-product-list')
export class ProductList extends ShoprocketElement {
  @property({ type: String, attribute: 'store-id' })
  storeId!: string;

  @property({ type: String })
  category?: string;

  @property({ type: Number })
  limit = 12;

  @state()
  products: Product[] = [];

  @state()
  private addedToCartProducts: Set<string> = new Set();

  protected override async firstUpdated(_changedProperties: PropertyValues): Promise<void> {
    super.firstUpdated(_changedProperties);
    await this.loadProducts();
  }

  private async loadProducts(): Promise<void> {
    await this.withLoading('products', async () => {
      try {
        const response = await this.sdk.products.list({
          per_page: this.limit,
          category: this.category,
        }) as ApiResponse<Product[]>;

        this.products = response.data || [];
        this.clearError();
      } catch (err) {
        console.error('Failed to load products:', err);
        this.showError('Unable to load products. Please try again later.');
        this.products = [];
      }
    });
  }

  protected override render(): TemplateResult {
    // Show skeleton loaders while loading
    if (this.isLoading('products') && !this.products.length) {
      return this.renderSkeletonGrid();
    }

    return html`
      ${renderErrorNotification(this.errorMessage)}
      ${renderSuccessNotification(this.successMessage)}
      <div class="sr sr:grid sr:grid-cols-2 sr:gap-x-4 sr:gap-y-8 sr:md:grid-cols-3 sr:lg:grid-cols-4" data-shoprocket="product-list">
        ${this.products.map(product => this.renderProduct(product))}
      </div>
    `;
  }

  private renderSkeletonGrid(): TemplateResult {
    const skeletonCount = this.limit ? Math.min(this.limit, 8) : 6;
    
    return html`
      <div class="sr sr:grid sr:grid-cols-[repeat(auto-fill,minmax(250px,1fr))] sr:gap-4 md:sr:grid-cols-[repeat(auto-fill,minmax(250px,1fr))] sm:sr:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] sm:sr:gap-2" data-shoprocket="product-list-skeleton">
        ${Array(skeletonCount).fill(0).map(() => html`
          <div class="sr:bg-white sr:rounded-lg sr:shadow-md sr:overflow-hidden">
            <!-- Image skeleton -->
            <div class="sr:relative sr:aspect-square sr-skeleton"></div>
            
            <!-- Content skeleton -->
            <div class="sr:p-4 sr:space-y-3">
              <!-- Title skeleton -->
              <div class="sr-skeleton sr:h-4 sr:w-3/4 sr:rounded"></div>
              
              <!-- Price skeleton -->
              <div class="sr-skeleton sr:h-5 sr:w-20 sr:rounded"></div>
              
              <!-- Button skeleton -->
              <div class="sr-skeleton sr:h-10 sr:w-full sr:rounded"></div>
            </div>
          </div>
        `)}
      </div>
    `;
  }

  private renderProduct(product: Product): TemplateResult {
    const needsOptions = !product.quick_add_eligible || !product.default_variant_id;
    const loadingKey = needsOptions ? `viewProduct-${product.id}` : `addToCart-${product.id}`;
    const isLoading = this.isLoading(loadingKey);
    const isAdded = this.addedToCartProducts.has(product.id);
    
    return html`
      <article class="sr:group sr:cursor-pointer sr:text-left sr:flex sr:flex-col sr:h-full">
        <div class="sr:relative sr:w-full sr:aspect-[3/4] sr:mb-4 sr:overflow-hidden sr:bg-gray-50 sr:cursor-pointer sr:flex-shrink-0"
             @click="${() => this.handleProductClick(product)}">
          <!-- Skeleton for list image -->
          <div class="sr-skeleton sr:absolute sr:inset-0" data-skeleton></div>
          <!-- Sale Badge - placeholder for future API -->
          <!-- First image -->
          <img 
            src="${this.getMediaUrl(product.media?.[0])}" 
            alt="${product.name}" 
            class="sr:absolute sr:inset-0 sr:w-full sr:h-full sr:object-cover sr:transition-all sr:duration-500 sr:group-hover:scale-105 sr:opacity-0 ${product.media?.[1] ? 'sr:group-hover:opacity-0' : ''}"
            @load="${(e: Event) => {
              const img = e.target as HTMLImageElement;
              img.classList.remove('sr:opacity-0');
              img.classList.add('sr:opacity-100');
              // Hide skeleton
              const skeleton = img.parentElement?.querySelector('[data-skeleton]');
              if (skeleton) skeleton.remove();
            }}"
            @error="${(e: Event) => this.handleImageError(e)}"
          >
          <!-- Second image (shown on hover if available) -->
          ${product.media?.[1] ? html`
            <img 
              src="${this.getMediaUrl(product.media[1])}" 
              alt="${product.name} - Image 2" 
              class="sr:absolute sr:inset-0 sr:w-full sr:h-full sr:object-cover sr:transition-all sr:duration-300 sr:opacity-0 sr:group-hover:opacity-100 sr:group-hover:scale-110"
              @error="${(e: Event) => this.handleImageError(e)}"
            >
          ` : ''}
        </div>
        
        <!-- Product Info -->
        <div class="sr:flex sr:flex-col sr:flex-1">
          <div class="sr:flex-1">
            <h3 class="sr:text-sm sr:font-medium sr:text-gray-900 sr:leading-tight sr:group-hover:text-gray-600 sr:transition-colors sr:cursor-pointer sr:mb-2"
                @click="${() => this.handleProductClick(product)}">${product.name}</h3>
            
            <div class="sr:flex sr:items-center sr:gap-2">
              <span class="sr:text-sm sr:font-medium sr:text-gray-900">${this.formatPrice(product.price)}</span>
            </div>
          </div>
          
          <!-- Quick Actions -->
          <div class="sr:pt-3">
            <button 
              class="${isAdded ? 'sr:bg-green-600 sr:hover:bg-green-700' : 'sr:bg-gray-900 sr:hover:bg-black'} sr:text-white sr:w-full sr:py-2.5 sr:px-4 sr:text-sm sr:font-medium sr:rounded-sm sr:transition-all sr:duration-200 sr:transform sr:hover:scale-[1.02] sr:cursor-pointer ${isLoading || isAdded ? 'sr:cursor-not-allowed sr:opacity-75' : ''}"
              @click="${(e: Event) => { e.stopPropagation(); this.handleAddToCart(product); }}"
              ?disabled="${isLoading || isAdded}"
            >
              ${isAdded ? html`
                <span class="sr:flex sr:items-center sr:justify-center sr:gap-2">
                  <svg class="sr:w-4 sr:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  Added
                </span>
              ` : isLoading ? html`<span class="sr:flex sr:items-center sr:justify-center sr:h-5">${loadingSpinner('sm')}</span>` : (needsOptions ? 'Select Options' : 'Add to Cart')}
            </button>
          </div>
        </div>
      </article>
    `;
  }

  private handleProductClick(product: Product): void {
    this.dispatchEvent(new CustomEvent('product-selected', {
      bubbles: true,
      composed: true,
      detail: { product }
    }));
  }

  private async handleAddToCart(product: Product): Promise<void> {
    // Check if product needs options selected
    if (!product.quick_add_eligible || !product.default_variant_id) {
      // Show product detail view
      this.handleProductClick(product);
      return;
    }
    
    // Can quick add - add to cart with loading state
    const loadingKey = `addToCart-${product.id}`;
    await this.withLoading(loadingKey, async () => {
      try {
        await this.sdk.cart.addItem({
          product_id: product.id,
          variant_id: product.default_variant_id,
          quantity: 1,
          source_url: window.location.href
        });
        
        // Dispatch events
        this.dispatchEvent(new CustomEvent('shoprocket:cart:updated', {
          bubbles: true,
          composed: true,
          detail: { productId: product.id, variantId: product.default_variant_id }
        }));

        window.dispatchEvent(new CustomEvent('shoprocket:product:added', {
          detail: { 
            product: {
              id: product.id,
              name: product.name,
              price: product.price,
              media: product.media?.[0],
              variantText: null
            }
          }
        }));
        
        // Show success state
        this.addedToCartProducts.add(product.id);
        setTimeout(() => {
          this.addedToCartProducts.delete(product.id);
          this.requestUpdate();
        }, 2000);
      } catch (error) {
        console.error('Failed to add to cart:', error);
        this.showError('Failed to add item to cart. Please try again.');
      }
    });
  }
}