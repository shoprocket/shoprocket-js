import { html, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { ShoprocketElement } from '../core/base-component';
import type { Product, ProductVariant, ProductOption } from '../types/api';
import { renderErrorNotification, renderSuccessNotification } from './error-notification';
import { loadingSpinner } from './loading-spinner';

/**
 * Product Detail Component
 */
@customElement('shoprocket-product-detail')
export class ProductDetail extends ShoprocketElement {
  @property({ type: Object })
  product?: Product;

  @state()
  private fullProduct?: Product;

  @state()
  private selectedOptions: { [optionId: string]: string } = {};

  @state()
  private selectedVariant?: ProductVariant;

  @state()
  private selectedMediaIndex: number = 0;

  @state()
  private zoomActive: boolean = false;

  @state()
  private zoomPosition: { x: number; y: number } = { x: 0, y: 0 };

  @state()
  private addedToCart: boolean = false;

  protected override async updated(changedProperties: Map<string, any>): Promise<void> {
    super.updated(changedProperties);
    
    // Load details whenever product changes (including first time)
    if (changedProperties.has('product') && this.product) {
      // Reset state when product changes
      this.selectedOptions = {};
      this.selectedVariant = undefined;
      this.selectedMediaIndex = 0;
      this.zoomActive = false;
      this.addedToCart = false;
      await this.loadFullDetails();
    }
  }

  private async loadFullDetails(): Promise<void> {
    if (!this.product) return;
    
    await this.withLoading(`productDetail-${this.product.id}`, async () => {
      try {
        // Load full product details with variants and options
        const response = await this.sdk.products.get(this.product!.id);
        
        this.fullProduct = response;
        
        // If single variant, pre-select it
        if (response.variants?.length === 1) {
          this.selectedVariant = response.variants[0];
        }
      } catch (error) {
        console.error('Failed to load product details:', error);
        this.showError('Failed to load product details. Please try again.');
      }
    });
  }

  protected override render(): TemplateResult {
    const displayProduct = this.fullProduct || this.product;
    
    // Show skeleton if no product data yet
    if (!displayProduct) {
      return this.renderSkeleton();
    }

    const isLoading = this.isLoading(`productDetail-${displayProduct.id}`);

    return html`
      ${renderErrorNotification(this.errorMessage)}
      ${renderSuccessNotification(this.successMessage)}
      <div class="sr" data-sr-product-detail>
        <!-- Back Button -->
        <button 
          class="sr:mb-6 sr:text-blue-600 sr:hover:text-blue-800 sr:bg-transparent sr:border-none sr:cursor-pointer sr:text-base sr:font-medium" 
          @click="${() => this.dispatchEvent(new CustomEvent('back-to-list', { bubbles: true }))}"
        >
          ← Back to Products
        </button>
        
        <!-- Product Details -->
        <div class="sr:w-full">
          <div class="sr:grid sr:grid-cols-1 sr:lg:grid-cols-2 sr:gap-4 sr:lg:gap-8">
            <!-- Product Images - Left side -->
            <div>
              <div class="sr:sticky sr:top-6">
                <!-- Main image with skeleton and zoom -->
                <div class="sr:relative sr:w-full sr:aspect-square sr:rounded-lg sr:mb-4 sr:overflow-hidden sr:cursor-zoom-in"
                     @mouseenter="${() => this.handleMouseEnterZoom()}"
                     @mouseleave="${() => this.handleMouseLeaveZoom()}"
                     @mousemove="${(e: MouseEvent) => this.handleMouseMoveZoom(e)}">
                  <!-- Skeleton loader -->
                  <div class="sr-skeleton sr:absolute sr:inset-0 sr:w-full sr:h-full"></div>
                  
                  <!-- Regular display image -->
                  <img 
                    src="${this.getMediaUrl(this.getSelectedMedia(), 'w=800,h=800,fit=cover')}" 
                    alt="${displayProduct.name}"
                    class="sr:absolute sr:inset-0 sr:w-full sr:h-full sr:object-cover ${this.zoomActive ? 'sr:opacity-0' : 'sr:opacity-100'} sr:bg-white"
                    @error="${(e: Event) => this.handleImageError(e)}"
                  >
                  <!-- High-res image for zoom -->
                  <img 
                    src="${this.getMediaUrl(this.getSelectedMedia(), 'w=1600,h=1600,fit=cover')}" 
                    alt="${displayProduct.name}"
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
                ${this.renderThumbnails(displayProduct, isLoading)}
              </div>
            </div>
            
            <!-- Product Info - Right side -->
            <div>
              <h1 class="sr:text-3xl sr:font-bold sr:mb-4 sr:m-0">${displayProduct.name}</h1>
              
              <div class="sr:text-3xl sr:font-bold sr:mb-6 sr:text-gray-900">
                ${this.formatPrice({ amount: this.getSelectedPrice() })}
              </div>
              
              ${displayProduct.summary ? html`
                <p class="sr:text-gray-600 sr:mb-6 sr:text-base sr:leading-relaxed">${displayProduct.summary}</p>
              ` : ''}
              
              <!-- Variant Options -->
              ${this.renderProductOptions(displayProduct, isLoading)}
              
              <!-- Add to Cart Section -->
              <div class="sr:mt-8 sr:space-y-4">
                ${this.renderAddToCartButton()}
                
                <!-- Product Description -->
                ${this.renderDescription(displayProduct, isLoading)}
                
                <!-- Additional info -->
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

  private renderThumbnails = (product: Product, isLoading: boolean): TemplateResult => {
    if (isLoading && !this.fullProduct?.options) {
      return html`
        <div class="sr:grid sr:grid-cols-4 sr:gap-2">
          ${[1, 2, 3, 4].map(() => html`
            <div class="sr:relative sr:aspect-square sr:rounded-lg sr:overflow-hidden">
              <div class="sr-skeleton sr:absolute sr:inset-0"></div>
            </div>
          `)}
        </div>
      `;
    }

    if (!product.media || product.media.length <= 1) return html``;

    return html`
      <div class="sr:grid sr:grid-cols-4 sr:gap-2">
        ${product.media.map((media: any, index: number) => html`
          <button
            class="sr:relative sr:aspect-square sr:rounded-lg sr:overflow-hidden sr:border-2 ${index === this.selectedMediaIndex ? 'sr:border-black' : 'sr:border-transparent'} sr:p-0 sr:cursor-pointer"
            @click="${() => { this.selectedMediaIndex = index; this.zoomActive = false; }}"
          >
            <div class="sr-skeleton sr:absolute sr:inset-0"></div>
            <img 
              src="${this.getMediaUrl(media, 'w=150,h=150,fit=cover')}" 
              alt="${product.name} ${index + 1}"
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
    `;
  }

  private renderProductOptions = (product: Product, isLoading: boolean): TemplateResult => {
    if (isLoading && !this.fullProduct?.options) {
      return html`
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
      `;
    }

    const displayProduct = this.fullProduct || product;
    if (!displayProduct.options || displayProduct.options.length === 0) return html``;

    return html`
      <div class="sr:space-y-6">
        ${displayProduct.options.map((option: ProductOption) => html`
          <div>
            <label class="sr:block sr:font-medium sr:text-gray-900 sr:mb-3 sr:text-sm sr:capitalize sr:tracking-wide">
              ${option.name}
            </label>
            <div class="sr:flex sr:flex-wrap sr:gap-3">
              ${option.values?.map((value: any) => html`
                <button 
                  class="${this.selectedOptions[option.id] === value.id ? 'sr:bg-black sr:text-white sr:border-black' : 'sr:bg-white sr:text-gray-900 sr:border-gray-300 sr:hover:border-gray-400'} sr:px-3 sr:py-1 sr:rounded sr:border sr:cursor-pointer sr:font-medium sr:transition-colors sr:duration-200 sr:text-sm"
                  @click="${() => this.selectOption(option.id, value.id)}"
                >
                  ${value.value}
                </button>
              `) || ''}
            </div>
          </div>
        `)}
      </div>
    `;
  }

  private renderAddToCartButton = (): TemplateResult => {
    const product = this.fullProduct || this.product;
    if (!product) return html``;

    const loadingKey = `addToCart-${product.id}`;
    const isLoading = this.isLoading(loadingKey);
    const canAdd = this.canAddToCart();

    return html`
      <button 
        class="${this.addedToCart ? 'sr:bg-green-600 sr:hover:bg-green-700' : canAdd && !isLoading ? 'sr:bg-black sr:hover:bg-gray-800' : 'sr:bg-gray-300 sr:cursor-not-allowed'} sr:text-white sr:border-none sr:py-4 sr:px-8 sr:rounded-lg sr:cursor-pointer sr:w-full sr:text-base sr:font-semibold sr:transition-colors sr:duration-200 sr:flex sr:items-center sr:justify-center sr:gap-3 ${isLoading ? 'sr:opacity-75' : ''}"
        @click="${() => this.handleAddToCart()}"
        ?disabled="${!canAdd || isLoading || this.addedToCart}"
      >
        ${this.addedToCart ? html`
          <svg class="sr:w-5 sr:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
          </svg>
          Added to Cart
        ` : isLoading ? loadingSpinner('sm') : canAdd ? 'Add to Cart' : 'Select All Options'}
      </button>
    `;
  }

  private renderDescription = (product: Product, isLoading: boolean): TemplateResult => {
    if (isLoading && !this.fullProduct?.description) {
      return html`
        <div class="sr:mt-8 sr:pt-8 sr:border-t sr:border-gray-200">
          <h3 class="sr:text-lg sr:font-semibold sr:mb-4 sr:m-0">Description</h3>
          <div class="sr:space-y-2">
            <div class="sr-skeleton sr:h-4 sr:w-full sr:rounded"></div>
            <div class="sr-skeleton sr:h-4 sr:w-full sr:rounded"></div>
            <div class="sr-skeleton sr:h-4 sr:w-full sr:rounded"></div>
            <div class="sr-skeleton sr:h-4 sr:w-3/4 sr:rounded"></div>
          </div>
        </div>
      `;
    }

    const displayProduct = this.fullProduct || product;
    if (!displayProduct.description) return html``;

    return html`
      <div class="sr:mt-8 sr:pt-8 sr:border-t sr:border-gray-200">
        <h3 class="sr:text-lg sr:font-semibold sr:mb-4 sr:m-0">Description</h3>
        <div class="sr:text-gray-600 sr:leading-relaxed sr:text-base sr:[&_p]:mb-4 sr:[&_p:last-child]:mb-0 sr:[&_ul]:list-disc sr:[&_ul]:pl-6 sr:[&_ul]:mb-4 sr:[&_ol]:list-decimal sr:[&_ol]:pl-6 sr:[&_ol]:mb-4 sr:[&_li]:mb-1">
          ${unsafeHTML(displayProduct.description)}
        </div>
      </div>
    `;
  }

  private async handleAddToCart(): Promise<void> {
    const product = this.fullProduct || this.product;
    if (!product || !this.canAddToCart()) return;

    const variantId = this.selectedVariant?.id || product.default_variant_id;
    if (!variantId) {
      this.showError('Please select all options before adding to cart.');
      return;
    }

    const loadingKey = `addToCart-${product.id}`;
    await this.withLoading(loadingKey, async () => {
      try {
        await this.sdk.cart.addItem({
          product_id: product.id,
          variant_id: variantId,
          quantity: 1
        });
        
        // Dispatch events
        this.dispatchEvent(new CustomEvent('shoprocket:cart:updated', {
          bubbles: true,
          composed: true,
          detail: { productId: product.id, variantId }
        }));

        window.dispatchEvent(new CustomEvent('shoprocket:product:added', {
          detail: { 
            product: {
              id: product.id,
              name: product.name,
              price: this.getSelectedPrice(),
              media: this.getSelectedMedia(),
              variantText: this.getSelectedVariantText()
            }
          }
        }));
        
        // Show success state
        this.addedToCart = true;
        setTimeout(() => {
          this.addedToCart = false;
        }, 2000);
      } catch (error) {
        console.error('Failed to add to cart:', error);
        this.showError('Failed to add item to cart. Please try again.');
      }
    });
  }

  private selectOption(optionId: string, valueId: string): void {
    this.selectedOptions = { ...this.selectedOptions, [optionId]: valueId };
    this.updateSelectedVariant();
  }

  private updateSelectedVariant(): void {
    const product = this.fullProduct || this.product;
    if (!product?.variants) return;

    const selectedOptionValues = Object.values(this.selectedOptions);
    
    this.selectedVariant = product.variants.find((variant: ProductVariant) => {
      const variantOptionValues = variant.option_values || variant.option_value_ids || [];
      return selectedOptionValues.every(valueId => variantOptionValues.includes(valueId));
    });
    
    // If variant has specific media, find its index and select it
    if (this.selectedVariant?.media_id && product.media) {
      const mediaIndex = product.media.findIndex((m: any) => m.id === this.selectedVariant!.media_id);
      if (mediaIndex !== -1) {
        this.selectedMediaIndex = mediaIndex;
      }
    }
  }

  private canAddToCart(): boolean {
    const product = this.fullProduct || this.product;
    if (!product) return false;
    
    // For single variant products, always can add
    if (product.variants?.length === 1) return true;
    
    // For multi-variant, need all options selected
    if (!product.options) return false;
    
    return product.options.every((option: ProductOption) => 
      this.selectedOptions[option.id]
    );
  }

  private getSelectedPrice(): number {
    const product = this.fullProduct || this.product;
    if (!product) return 0;
    return this.selectedVariant?.price?.amount || product.price?.amount || 0;
  }

  private getSelectedMedia(): any {
    const product = this.fullProduct || this.product;
    return product?.media?.[this.selectedMediaIndex] || product?.media?.[0];
  }

  private getSelectedVariantText(): string | null {
    const product = this.fullProduct || this.product;
    if (!product?.options || !this.selectedOptions) return null;
    
    const variantParts: string[] = [];
    
    product.options.forEach((option: ProductOption) => {
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
    
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    this.zoomPosition = { x, y };
  }

  private renderSkeleton(): TemplateResult {
    return html`
      <div class="sr" data-sr-product-detail>
        <!-- Back Button -->
        <button 
          class="sr:mb-6 sr:text-blue-600 sr:hover:text-blue-800 sr:bg-transparent sr:border-none sr:cursor-pointer sr:text-base sr:font-medium" 
          @click="${() => this.dispatchEvent(new CustomEvent('back-to-list', { bubbles: true }))}"
        >
          ← Back to Products
        </button>
        
        <!-- Product Details Skeleton -->
        <div class="sr:w-full">
          <div class="sr:grid sr:grid-cols-1 sr:lg:grid-cols-2 sr:gap-4 sr:lg:gap-8">
            <!-- Product Images Skeleton - Left side -->
            <div>
              <div class="sr:sticky sr:top-6">
                <!-- Main image skeleton -->
                <div class="sr:relative sr:w-full sr:aspect-square sr:rounded-lg sr:mb-4 sr:overflow-hidden">
                  <div class="sr-skeleton sr:absolute sr:inset-0 sr:w-full sr:h-full"></div>
                </div>
                
                <!-- Thumbnail gallery skeleton -->
                <div class="sr:grid sr:grid-cols-4 sr:gap-2">
                  ${[1, 2, 3, 4].map(() => html`
                    <div class="sr:relative sr:aspect-square sr:rounded-lg sr:overflow-hidden">
                      <div class="sr-skeleton sr:absolute sr:inset-0"></div>
                    </div>
                  `)}
                </div>
              </div>
            </div>
            
            <!-- Product Info Skeleton - Right side -->
            <div>
              <!-- Title -->
              <div class="sr-skeleton sr:h-8 sr:w-3/4 sr:rounded sr:mb-4"></div>
              
              <!-- Price -->
              <div class="sr-skeleton sr:h-8 sr:w-32 sr:rounded sr:mb-6"></div>
              
              <!-- Summary -->
              <div class="sr:space-y-2 sr:mb-6">
                <div class="sr-skeleton sr:h-4 sr:w-full sr:rounded"></div>
                <div class="sr-skeleton sr:h-4 sr:w-full sr:rounded"></div>
                <div class="sr-skeleton sr:h-4 sr:w-3/4 sr:rounded"></div>
              </div>
              
              <!-- Options -->
              <div class="sr:space-y-6 sr:mb-8">
                <div>
                  <div class="sr-skeleton sr:h-4 sr:w-20 sr:rounded sr:mb-3"></div>
                  <div class="sr:flex sr:flex-wrap sr:gap-3">
                    <div class="sr-skeleton sr:h-12 sr:w-20 sr:rounded"></div>
                    <div class="sr-skeleton sr:h-12 sr:w-20 sr:rounded"></div>
                    <div class="sr-skeleton sr:h-12 sr:w-20 sr:rounded"></div>
                  </div>
                </div>
              </div>
              
              <!-- Add to Cart Button -->
              <div class="sr-skeleton sr:h-14 sr:w-full sr:rounded-lg"></div>
              
              <!-- Description -->
              <div class="sr:mt-8 sr:pt-8 sr:border-t sr:border-gray-200">
                <div class="sr-skeleton sr:h-6 sr:w-32 sr:rounded sr:mb-4"></div>
                <div class="sr:space-y-2">
                  <div class="sr-skeleton sr:h-4 sr:w-full sr:rounded"></div>
                  <div class="sr-skeleton sr:h-4 sr:w-full sr:rounded"></div>
                  <div class="sr-skeleton sr:h-4 sr:w-full sr:rounded"></div>
                  <div class="sr-skeleton sr:h-4 sr:w-3/4 sr:rounded"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}