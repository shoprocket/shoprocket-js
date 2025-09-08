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
      <div class="sr sr:grid sr:grid-cols-[repeat(auto-fill,minmax(250px,1fr))] sr:gap-4 md:sr:grid-cols-[repeat(auto-fill,minmax(250px,1fr))] sm:sr:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] sm:sr:gap-2" data-sr-product-list>
        ${this.products.map(product => this.renderProduct(product))}
      </div>
    `;
  }

  private renderSkeletonGrid(): TemplateResult {
    const skeletonCount = this.limit ? Math.min(this.limit, 8) : 6;
    
    return html`
      <div class="sr sr:grid sr:grid-cols-[repeat(auto-fill,minmax(250px,1fr))] sr:gap-4 md:sr:grid-cols-[repeat(auto-fill,minmax(250px,1fr))] sm:sr:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] sm:sr:gap-2">
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
      <article class="sr:border sr:border-gray-200 sr:rounded-lg sr:p-4 sr:text-center sm:sr:p-3">
        <div class="sr:relative sr:w-full sr:h-[200px] sm:sr:h-[150px] sr:rounded sr:mb-2 sr:overflow-hidden sr:bg-gray-100 sr:cursor-pointer sr:group"
             @click="${() => this.handleProductClick(product)}">
          <!-- Skeleton for list image -->
          <div class="sr-skeleton sr:absolute sr:inset-0"></div>
          <!-- First image -->
          <img 
            src="${this.getMediaUrl(product.media?.[0])}" 
            alt="${product.name}" 
            class="sr:absolute sr:inset-0 sr:w-full sr:h-full sr:object-cover sr:transition-all sr:duration-300 sr:group-hover:scale-110 sr:opacity-0 ${product.media?.[1] ? 'sr:group-hover:opacity-0' : ''}"
            @load="${(e: Event) => {
              const img = e.target as HTMLImageElement;
              img.classList.remove('sr:opacity-0');
              img.classList.add('sr:opacity-100');
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
        <h3 class="sr:text-lg sr:my-2 sr:cursor-pointer sr:hover:underline"
            @click="${() => this.handleProductClick(product)}">${product.name}</h3>
        <p class="sr:text-xl sr:font-bold sr:text-gray-800 sr:my-2">${this.formatPrice(product.price)}</p>
        
        <div class="sr:flex sr:gap-2 sr:mt-3">
          <button 
            class="${isAdded ? 'sr:bg-green-600 sr:hover:bg-green-700' : isLoading ? 'sr:bg-gray-300 sr:cursor-wait' : 'sr:bg-black sr:hover:bg-gray-800'} sr:text-white sr:border-none sr:py-2 sr:px-4 sr:rounded sr:cursor-pointer sr:text-sm sr:flex-1 sr:transition-colors sr:duration-200 sr:flex sr:items-center sr:justify-center sr:gap-2"
            @click="${() => this.handleAddToCart(product)}"
            ?disabled="${isLoading || isAdded}"
          >
            ${isAdded ? html`
              <svg class="sr:w-4 sr:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
              </svg>
              Added to Cart
            ` : isLoading ? loadingSpinner('sm') : (needsOptions ? 'Select Options' : 'Add to Cart')}
          </button>
          <button
            class="sr:bg-white sr:text-black sr:border sr:border-gray-300 sr:hover:bg-gray-50 sr:py-2 sr:px-3 sr:rounded sr:cursor-pointer sr:text-sm sr:transition-colors sr:duration-200"
            @click="${() => this.handleProductClick(product)}"
            title="View Product"
          >
            <svg class="sr:w-4 sr:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
            </svg>
          </button>
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
          quantity: 1
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