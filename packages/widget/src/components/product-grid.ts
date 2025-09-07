import { html, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { ShoprocketElement } from '../core/base-component';
import type { Product, ProductVariant, ApiResponse, ProductOption } from '../types/api';
import { renderErrorNotification, renderSuccessNotification } from './error-notification';

/**
 * Product Grid Component
 */
@customElement('shoprocket-product-grid')
export class ProductGrid extends ShoprocketElement {
  @property({ type: String, attribute: 'store-id' })
  storeId!: string;

  @property({ type: String })
  category?: string;

  @property({ type: Number })
  limit = 12;

  @state()
  private products: Product[] = [];

  @state()
  private selectedProduct?: Product;

  @state()
  private selectedOptions: { [optionId: string]: string } = {};

  @state()
  private selectedVariant?: ProductVariant;

  @state()
  private currentView: 'list' | 'product' = 'list';
  
  @state()
  private selectedMediaIndex: number = 0;
  
  @state()
  private zoomActive: boolean = false;
  
  @state()
  private zoomPosition: { x: number; y: number } = { x: 0, y: 0 };
  
  @state()
  private addedToCartProducts: Set<string> = new Set();
  
  private handleHashChange = async (): Promise<void> => {
    if (window.location.hash.startsWith('#!/')) {
      const slug = window.location.hash.substring(3);
      const product = this.products.find(p => p.slug === slug);
      if (product && (!this.selectedProduct || this.selectedProduct.slug !== slug)) {
        await this.showProductDetail(product);
      }
    } else if (this.currentView === 'product') {
      this.backToList();
    }
  };

  override async connectedCallback(): Promise<void> {
    super.connectedCallback();
    
    await this.loadProducts();
    
    // Check if URL has a product hash on load
    if (window.location.hash.startsWith('#!/')) {
      const slug = window.location.hash.substring(3);
      const product = this.products.find(p => p.slug === slug);
      if (product) {
        await this.showProductDetail(product);
      }
    }
    
    // Listen for hash changes
    window.addEventListener('hashchange', this.handleHashChange);
  }
  
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('hashchange', this.handleHashChange);
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
    // Check if products are being loaded initially
    if (this.isLoading('products') && !this.products.length) {
      return html`<div class="sr:text-center sr:py-8 sr:text-gray-600">Loading products...</div>`;
    }


    if (this.currentView === 'product' && this.selectedProduct) {
      return this.renderProductView();
    }

    return html`
      ${renderErrorNotification(this.errorMessage)}
      ${renderSuccessNotification(this.successMessage)}
      <div class="sr sr:grid sr:grid-cols-[repeat(auto-fill,minmax(250px,1fr))] sr:gap-4 md:sr:grid-cols-[repeat(auto-fill,minmax(250px,1fr))] sm:sr:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] sm:sr:gap-2" data-sr>
        ${this.products.map(product => {
          const needsOptions = !product.quick_add_eligible || !product.default_variant_id;
          const loadingKey = needsOptions ? `viewProduct-${product.id}` : `addToCart-${product.id}`;
          const isLoading = this.isLoading(loadingKey);
          const isAdded = this.addedToCartProducts.has(product.id);
          
          return html`
            <article class="sr:border sr:border-gray-200 sr:rounded-lg sr:p-4 sr:text-center sm:sr:p-3">
              <div class="sr:relative sr:w-full sr:h-[200px] sm:sr:h-[150px] sr:rounded sr:mb-2 sr:overflow-hidden sr:bg-gray-100 sr:cursor-pointer sr:group"
                   @click="${() => this.showProductDetail(product)}">
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
                  @click="${() => this.showProductDetail(product)}">${product.name}</h3>
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
                  ` : isLoading ? (needsOptions ? 'Loading...' : 'Adding...') : (needsOptions ? 'Select Options' : 'Add to Cart')}
                </button>
                <button
                  class="sr:bg-white sr:text-black sr:border sr:border-gray-300 sr:hover:bg-gray-50 sr:py-2 sr:px-3 sr:rounded sr:cursor-pointer sr:text-sm sr:transition-colors sr:duration-200"
                  @click="${() => this.showProductDetail(product)}"
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
        })}
      </div>
    `;
  }

  private async handleAddToCart(product?: any): Promise<void> {
    // If called from grid with a product
    if (product) {
      // Check if product needs options selected
      if (!product.quick_add_eligible || !product.default_variant_id) {
        // Show product detail view immediately (optimistic)
        this.showProductDetail(product);
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
          
          // Dispatch event
          this.dispatchEvent(new CustomEvent('shoprocket:cart:updated', {
            bubbles: true,
            composed: true,
            detail: { productId: product.id, variantId: product.default_variant_id }
          }));

          // Successfully added to cart
          // Emit event with product details for cart notification
          window.dispatchEvent(new CustomEvent('shoprocket:product:added', {
            detail: { 
              product: {
                id: product.id,
                name: product.name,
                price: product.price,
                media: product.media?.[0],
                variantText: null // No variant for quick add
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
    // If called from detail view (no product argument)
    else if (this.selectedProduct) {
      if (!this.canAddToCart()) return;

      const variantId = this.selectedVariant?.id || this.selectedProduct?.default_variant_id;
      if (!variantId) {
        this.showError('Please select all options before adding to cart.');
        return;
      }

      // Add to cart with loading state
      const loadingKey = `addToCart-${this.selectedProduct.id}`;
      await this.withLoading(loadingKey, async () => {
        try {
          await this.sdk.cart.addItem({
            product_id: this.selectedProduct!.id,
            variant_id: variantId,
            quantity: 1
          });
          
          // Dispatch event
          this.dispatchEvent(new CustomEvent('shoprocket:cart:updated', {
            bubbles: true,
            composed: true,
            detail: { productId: this.selectedProduct!.id, variantId }
          }));

          // Successfully added to cart
          // Emit event with product details for cart notification
          window.dispatchEvent(new CustomEvent('shoprocket:product:added', {
            detail: { 
              product: {
                id: this.selectedProduct!.id,
                name: this.selectedProduct!.name,
                price: this.getSelectedPrice(),
                media: this.getSelectedMedia(),
                variantText: this.getSelectedVariantText()
              }
            }
          }));
          
          // Show success state
          this.addedToCartProducts.add(this.selectedProduct!.id);
          setTimeout(() => {
            this.addedToCartProducts.delete(this.selectedProduct!.id);
            this.requestUpdate();
          }, 2000);
        } catch (error) {
          console.error('Failed to add to cart:', error);
          this.showError('Failed to add item to cart. Please try again.');
        }
      });
    }
  }

  private async showProductDetail(product: any): Promise<void> {
    // Show view immediately with basic data
    this.selectedProduct = product;
    this.selectedOptions = {};
    this.selectedVariant = undefined;
    this.selectedMediaIndex = 0;
    this.currentView = 'product';
    this.zoomActive = false;
    
    // Update URL hash with product slug
    window.location.hash = `!/${product.slug || product.id}`;
    
    // Load full details in background (don't await)
    this.loadProductDetails(product.id);
  }
  
  private async loadProductDetails(productId: string): Promise<void> {
    await this.withLoading(`productDetail-${productId}`, async () => {
      try {
        // Load full product details with variants and options
        const response = await this.sdk.products.get(productId, ['variants', 'options', 'options.values', 'media', 'displayVariant.media']);
        
        // Only update if still viewing the same product
        if (this.currentView === 'product' && this.selectedProduct?.id === productId) {
          this.selectedProduct = response;
          
          // If single variant, pre-select it
          if (response.variants?.length === 1) {
            this.selectedVariant = response.variants[0];
          }
        }
      } catch (error) {
        console.error('Failed to load product details:', error);
      }
    });
  }

  private backToList(): void {
    this.currentView = 'list';
    // Clear URL hash
    window.location.hash = '';
  }

  
  private handleMouseEnterZoom(): void {
    this.zoomActive = true;
  }
  
  private handleMouseLeaveZoom(): void {
    this.zoomActive = false;
  }
  
  private handleMouseMoveZoom(e: MouseEvent): void {
    if (!this.zoomActive) return;
    
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    
    // Calculate position as percentage
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    this.zoomPosition = { x, y };
  }

  private selectOption(optionId: string, valueId: string): void {
    this.selectedOptions = { ...this.selectedOptions, [optionId]: valueId };
    this.updateSelectedVariant();
  }

  private updateSelectedVariant(): void {
    if (!this.selectedProduct?.variants) return;

    // Find variant that matches all selected options
    const selectedOptionValues = Object.values(this.selectedOptions);
    
    this.selectedVariant = this.selectedProduct.variants.find((variant: any) => {
      const variantOptionValues = variant.option_values || variant.option_value_ids || [];
      return selectedOptionValues.every(valueId => variantOptionValues.includes(valueId));
    });
    
    // If variant has specific media, find its index and select it
    if (this.selectedVariant?.media_id && this.selectedProduct?.media) {
      const mediaIndex = this.selectedProduct.media.findIndex((m: any) => m.id === this.selectedVariant!.media_id);
      if (mediaIndex !== -1) {
        this.selectedMediaIndex = mediaIndex;
      }
    }
  }
  
  private getDisplayMedia(): any {
    // If we have a selected variant with a specific media_id, find and use that media
    if (this.selectedVariant?.media_id && this.selectedProduct?.media) {
      const variantMedia = this.selectedProduct.media.find((m: any) => m.id === this.selectedVariant!.media_id);
      if (variantMedia) {
        return variantMedia;
      }
    }
    // Fall back to the first product media (same as shown in list)
    return this.selectedProduct?.media?.[0];
  }
  
  private getSelectedMedia(): any {
    // Return media based on selected index
    return this.selectedProduct?.media?.[this.selectedMediaIndex] || this.getDisplayMedia();
  }

  private canAddToCart(): boolean {
    if (!this.selectedProduct) return false;
    
    // For single variant products, always can add
    if (this.selectedProduct.variants?.length === 1) return true;
    
    // For multi-variant, need all options selected
    if (!this.selectedProduct.options) return false;
    
    return this.selectedProduct.options.every((option: any) => 
      this.selectedOptions[option.id]
    );
  }


  private getSelectedPrice(): number {
    if (!this.selectedProduct) return 0;
    return this.selectedVariant?.price?.amount || this.selectedProduct.price?.amount || 0;
  }

  private getSelectedVariantText(): string | null {
    if (!this.selectedProduct?.options || !this.selectedOptions) return null;
    
    // Build variant text from selected options
    const variantParts: string[] = [];
    
    this.selectedProduct.options.forEach((option: ProductOption) => {
      const selectedValueId = this.selectedOptions[option.id];
      if (selectedValueId) {
        const selectedValue = option.values?.find(v => v.id === selectedValueId);
        if (selectedValue) {
          variantParts.push(selectedValue.value);
        }
      }
    });
    
    return variantParts.length > 0 ? variantParts.join(' / ') : null;
  }

  private renderProductView(): TemplateResult {
    if (!this.selectedProduct) return html``;

    return html`
      ${renderErrorNotification(this.errorMessage)}
      ${renderSuccessNotification(this.successMessage)}
      <div class="sr" data-sr>
        <!-- Back Button -->
        <button class="sr:mb-6 sr:text-blue-600 sr:hover:text-blue-800 sr:bg-transparent sr:border-none sr:cursor-pointer sr:text-base sr:font-medium" @click="${() => this.backToList()}">
          ← Back to Products
        </button>
        
        <!-- Product Details - Full width, no modal styling -->
        <div class="sr:w-full">
          <div class="sr:grid sr:grid-cols-1 sr:lg:grid-cols-2 sr:gap-4 sr:lg:gap-8">
            <!-- Product Images - Left side on desktop -->
            <div>
              <div class="sr:sticky sr:top-6">
                <!-- Main image with skeleton and zoom -->
                <div class="sr:relative sr:w-full sr:aspect-square sr:rounded-lg sr:mb-4 sr:overflow-hidden sr:cursor-zoom-in"
                     @mouseenter="${() => this.handleMouseEnterZoom()}"
                     @mouseleave="${() => this.handleMouseLeaveZoom()}"
                     @mousemove="${(e: MouseEvent) => this.handleMouseMoveZoom(e)}">
                  <!-- Regular display image -->
                  <img 
                    src="${this.getMediaUrl(this.getSelectedMedia(), 'w=800,h=800,fit=cover')}" 
                    alt="${this.selectedProduct.name}"
                    class="sr:absolute sr:inset-0 sr:w-full sr:h-full sr:object-cover ${this.zoomActive ? 'sr:opacity-0' : 'sr:opacity-100'}"
                    @error="${(e: Event) => this.handleImageError(e)}"
                  >
                  <!-- High-res image for zoom (always rendered but hidden when not zooming) -->
                  <img 
                    src="${this.getMediaUrl(this.getSelectedMedia(), 'w=1600,h=1600,fit=cover')}" 
                    alt="${this.selectedProduct.name}"
                    class="sr:absolute sr:inset-0 sr:w-full sr:h-full sr:object-cover ${this.zoomActive ? 'sr:opacity-100' : 'sr:opacity-0'}"
                    style="${this.zoomActive ? `transform: scale(2); transform-origin: ${this.zoomPosition.x}% ${this.zoomPosition.y}%;` : ''}"
                    loading="lazy"
                    @error="${(e: Event) => this.handleImageError(e)}"
                  >
                  <!-- Zoom lens indicator -->
                  ${this.zoomActive ? html`
                    <div class="sr:absolute sr:pointer-events-none sr:border sr:border-white/50 sr:rounded-full sr:w-24 sr:h-24 sr:shadow-2xl sr:bg-white/10"
                         style="left: ${this.zoomPosition.x}%; top: ${this.zoomPosition.y}%; transform: translate(-50%, -50%);">
                    </div>
                  ` : ''}
                </div>
                
                <!-- Thumbnail gallery -->
                ${this.isLoading(`productDetail-${this.selectedProduct.id}`) && !this.selectedProduct.options ? html`
                  <!-- Skeleton thumbnails while loading -->
                  <div class="sr:grid sr:grid-cols-4 sr:gap-2">
                    ${[1, 2, 3, 4].map(() => html`
                      <div class="sr:relative sr:aspect-square sr:rounded-lg sr:overflow-hidden">
                        <div class="sr-skeleton sr:absolute sr:inset-0"></div>
                      </div>
                    `)}
                  </div>
                ` : this.selectedProduct.media?.length > 1 ? html`
                  <div class="sr:grid sr:grid-cols-4 sr:gap-2">
                    ${this.selectedProduct.media.map((media: any, index: number) => html`
                      <button
                        class="sr:relative sr:aspect-square sr:rounded-lg sr:overflow-hidden sr:border-2 ${index === this.selectedMediaIndex ? 'sr:border-black' : 'sr:border-transparent'} sr:p-0 sr:cursor-pointer"
                        @click="${() => { this.selectedMediaIndex = index; this.zoomActive = false; }}"
                      >
                        <!-- Skeleton for thumbnail -->
                        <div class="sr-skeleton sr:absolute sr:inset-0"></div>
                        <img 
                          src="${this.getMediaUrl(media, 'w=150,h=150,fit=cover')}" 
                          alt="${this.selectedProduct!.name} ${index + 1}"
                          class="sr:relative sr:w-full sr:h-full sr:object-cover sr:opacity-0 sr:transition-opacity sr:duration-200"
                          @load="${(e: Event) => {
                            const img = e.target as HTMLImageElement;
                            img.classList.remove('sr:opacity-0');
                            img.classList.add('sr:opacity-100');
                          }}"
                          @error="${(e: Event) => this.handleImageError(e)}"
                        >
                      </button>
                    `)}
                  </div>
                ` : ''}
              </div>
            </div>
            
            <!-- Product Info - Right side on desktop -->
            <div>
              <h1 class="sr:text-3xl sr:font-bold sr:mb-4 sr:m-0">${this.selectedProduct.name}</h1>
              
              <div class="sr:text-3xl sr:font-bold sr:mb-6 sr:text-gray-900">${this.formatPrice({ amount: this.getSelectedPrice() })}</div>
              
              ${this.selectedProduct.summary ? html`
                <p class="sr:text-gray-600 sr:mb-6 sr:text-base sr:leading-relaxed">${this.selectedProduct.summary}</p>
              ` : ''}
              
              <!-- Variant Options -->
              ${this.isLoading(`productDetail-${this.selectedProduct.id}`) && !this.selectedProduct.options ? html`
                <!-- Skeleton loader for variants -->
                <div class="sr:space-y-6">
                  <div>
                    <div class="sr-skeleton sr:h-4 sr:w-20 sr:rounded sr:mb-3"></div>
                    <div class="sr:flex sr:flex-wrap sr:gap-3">
                      <div class="sr-skeleton sr:h-12 sr:w-20 sr:rounded"></div>
                      <div class="sr-skeleton sr:h-12 sr:w-20 sr:rounded"></div>
                      <div class="sr-skeleton sr:h-12 sr:w-20 sr:rounded"></div>
                    </div>
                  </div>
                </div>
              ` : this.selectedProduct!.options && this.selectedProduct!.options.length > 0 ? html`
                <div class="sr:space-y-6">
                  ${this.selectedProduct!.options!.map((option: any) => html`
                    <div>
                      <label class="sr:block sr:font-medium sr:text-gray-900 sr:mb-3 sr:text-sm sr:uppercase sr:tracking-wide">${option.name}</label>
                      <div class="sr:flex sr:flex-wrap sr:gap-3">
                        ${option.values.map((value: any) => html`
                          <button 
                            class="${this.selectedOptions[option.id] === value.id ? 'sr:bg-black sr:text-white sr:border-black' : 'sr:bg-white sr:text-gray-900 sr:border-gray-300 sr:hover:border-gray-400'} sr:px-3 sr:py-1 sr:rounded sr:border sr:cursor-pointer sr:font-medium sr:transition-colors sr:duration-200 sr:text-sm"
                            @click="${() => this.selectOption(option.id, value.id)}"
                          >
                            ${value.value}
                          </button>
                        `)}
                      </div>
                    </div>
                  `)}
                </div>
              ` : ''}
              
              <!-- Add to Cart Section -->
              <div class="sr:mt-8 sr:space-y-4">
                <button 
                  class="${this.addedToCartProducts.has(this.selectedProduct!.id) ? 'sr:bg-green-600 sr:hover:bg-green-700' : this.canAddToCart() && !this.isLoading(`addToCart-${this.selectedProduct.id}`) ? 'sr:bg-black sr:hover:bg-gray-800' : 'sr:bg-gray-300 sr:cursor-not-allowed'} sr:text-white sr:border-none sr:py-4 sr:px-8 sr:rounded-lg sr:cursor-pointer sr:w-full sr:text-base sr:font-semibold sr:transition-colors sr:duration-200 sr:flex sr:items-center sr:justify-center sr:gap-3 ${this.isLoading(`addToCart-${this.selectedProduct.id}`) ? 'sr:opacity-75' : ''}"
                  @click="${() => this.handleAddToCart()}"
                  ?disabled="${!this.canAddToCart() || this.isLoading(`addToCart-${this.selectedProduct.id}`) || this.addedToCartProducts.has(this.selectedProduct!.id)}"
                >
                  ${this.addedToCartProducts.has(this.selectedProduct!.id) ? html`
                    <svg class="sr:w-5 sr:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
                    </svg>
                    Added to Cart
                  ` : this.isLoading(`addToCart-${this.selectedProduct.id}`) ? 'Adding to Cart...' : this.canAddToCart() ? 'Add to Cart' : 'Select All Options'}
                </button>
                
                <!-- Product Description -->
                ${this.isLoading(`productDetail-${this.selectedProduct.id}`) && !this.selectedProduct.description ? html`
                  <!-- Skeleton loader for description -->
                  <div class="sr:mt-8 sr:pt-8 sr:border-t sr:border-gray-200">
                    <h3 class="sr:text-lg sr:font-semibold sr:mb-4 sr:m-0">Description</h3>
                    <div class="sr:space-y-2">
                      <div class="sr-skeleton sr:h-4 sr:w-full sr:rounded"></div>
                      <div class="sr-skeleton sr:h-4 sr:w-full sr:rounded"></div>
                      <div class="sr-skeleton sr:h-4 sr:w-full sr:rounded"></div>
                      <div class="sr-skeleton sr:h-4 sr:w-3/4 sr:rounded"></div>
                    </div>
                  </div>
                ` : this.selectedProduct.description ? html`
                  <div class="sr:mt-8 sr:pt-8 sr:border-t sr:border-gray-200">
                    <h3 class="sr:text-lg sr:font-semibold sr:mb-4 sr:m-0">Description</h3>
                    <div class="sr:text-gray-600 sr:leading-relaxed sr:text-base sr:[&_p]:mb-4 sr:[&_p:last-child]:mb-0 sr:[&_ul]:list-disc sr:[&_ul]:pl-6 sr:[&_ul]:mb-4 sr:[&_ol]:list-decimal sr:[&_ol]:pl-6 sr:[&_ol]:mb-4 sr:[&_li]:mb-1">
                      ${unsafeHTML(this.selectedProduct.description)}
                    </div>
                  </div>
                ` : ''}
                
                <!-- Additional product info -->
                <div class="sr:text-sm sr:text-gray-500 sr:text-center sr:mt-6">
                  Free shipping on orders over $50
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}