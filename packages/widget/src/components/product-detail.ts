import { html, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { ShoprocketElement } from '../core/base-component';
import type { Product, ProductVariant, ProductOption } from '../types/api';
import { renderErrorNotification, renderSuccessNotification } from './error-notification';
import { loadingSpinner } from './loading-spinner';

/**
 * Product Detail Component
 * Uses Light DOM to avoid nested Shadow DOM
 */
@customElement('shoprocket-product-detail')
export class ProductDetail extends ShoprocketElement {
  // Use Light DOM instead of Shadow DOM
  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // Listen for cart updates to refresh cart state
    this.handleCartUpdate = this.handleCartUpdate.bind(this);
    window.addEventListener('shoprocket:cart:updated', this.handleCartUpdate);
    window.addEventListener('shoprocket:cart:loaded', this.handleCartUpdate);
  }
  
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('shoprocket:cart:updated', this.handleCartUpdate);
    window.removeEventListener('shoprocket:cart:loaded', this.handleCartUpdate);
    // Clean up zoom timeout if any
    if (this.zoomTimeout) {
      clearTimeout(this.zoomTimeout);
    }
  }
  
  private handleCartUpdate = async (): Promise<void> => {
    await this.checkIfInCart();
  }

  @property({ type: Object })
  product?: Product;

  @property({ type: String, attribute: 'product-id' })
  productId?: string;

  @property({ type: String, attribute: 'product-slug' })
  productSlug?: string;

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
  
  @state()
  private isInCart: boolean = false;

  @state()
  private loadedImages: Set<string> = new Set();

  private zoomTimeout?: number;

  protected override async updated(changedProperties: Map<string, any>): Promise<void> {
    super.updated(changedProperties);
    
    
    // Only load if we don't already have the full product details
    const identifier = this.productId || this.productSlug;
    const needsLoad = (changedProperties.has('productId') || changedProperties.has('productSlug')) && 
                     identifier &&
                     (!this.fullProduct || (this.fullProduct.id !== identifier && this.fullProduct.slug !== identifier));
    
    if (needsLoad) {
      // Reset state when loading new product
      this.selectedOptions = {};
      this.selectedVariant = undefined;
      this.selectedMediaIndex = 0;
      this.zoomActive = false;
      this.addedToCart = false;
      this.isInCart = false;
      this.loadedImages.clear();
      
      await this.loadProductById(identifier);
    }
  }

  private async loadProductById(identifier: string): Promise<void> {
    await this.withLoading('product', async () => {
      try {
        const response = await this.sdk.products.get(identifier);
        const productData = response.data || response;
        this.fullProduct = productData;
        
        // If single variant, pre-select it
        if (productData.variants?.length === 1) {
          this.selectedVariant = productData.variants[0];
        }
        
        this.clearError();
        
        // Scroll to top after full product loads to avoid layout shift
        requestAnimationFrame(() => {
          this.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      } catch (err) {
        console.error('Failed to load product:', err);
        this.showError('Unable to load product details. Please try again later.');
      }
    });
    
    // Check if in cart after loading
    await this.checkIfInCart();
  }


  protected override render(): TemplateResult {
    // Use full product if available, otherwise use basic product data
    const displayProduct = this.fullProduct || this.product;
    
    // Show skeleton if no product data yet
    if (!displayProduct) {
      return this.renderSkeleton();
    }

    // We're loading if we don't have full product yet but we need it (for variants/options)
    const isLoadingFull = this.isLoading('product') && !this.fullProduct;

    return html`
      ${renderErrorNotification(this.errorMessage)}
      ${renderSuccessNotification(this.successMessage)}
      <div class="sr-product-detail" data-shoprocket="product-detail">
        <!-- Back Button -->
        ${this.renderBackButton()}
        
        <!-- Product Details -->
        <div class="sr-product-detail-content">
          <div class="sr-product-detail-grid">
            <!-- Product Images - Left side -->
            <div class="sr-product-detail-media">
              <div class="sr-product-detail-media-sticky">
                <!-- Main image with skeleton and zoom -->
                <div class="sr-product-detail-image-main"
                     @mouseenter="${() => this.handleMouseEnterZoom()}"
                     @mouseleave="${() => this.handleMouseLeaveZoom()}"
                     @mousemove="${(e: MouseEvent) => this.handleMouseMoveZoom(e)}">
                  <!-- Skeleton loader -->
                  ${!this.loadedImages.has(this.getMediaUrl(this.getSelectedMedia(), 'w=800,h=800,fit=cover')) ? html`
                    <div class="sr-skeleton sr-product-image-skeleton"></div>
                  ` : ''}
                  
                  <!-- Regular display image -->
                  <img 
                    src="${this.getMediaUrl(this.getSelectedMedia(), 'w=800,h=800,fit=cover')}" 
                    alt="${displayProduct.name}"
                    class="sr-product-detail-image ${this.zoomActive ? 'zoom-hidden' : 'zoom-visible'}"
                    @load="${(e: Event) => {
                      const img = e.target as HTMLImageElement;
                      this.loadedImages.add(img.src);
                      this.requestUpdate();
                    }}"
                    @error="${(e: Event) => this.handleImageError(e)}"
                  >
                  <!-- High-res image for zoom -->
                  <img 
                    src="${this.getMediaUrl(this.getSelectedMedia(), 'w=1600,h=1600,fit=cover')}" 
                    alt="${displayProduct.name}"
                    class="sr-product-detail-image-zoom ${this.zoomActive ? 'zoom-active' : 'zoom-inactive'}"
                    style="${this.zoomActive ? `transform: scale(2); transform-origin: ${this.zoomPosition.x}% ${this.zoomPosition.y}%;` : ''}"
                    loading="lazy"
                    @error="${(e: Event) => this.handleImageError(e)}"
                  >
                  <!-- Zoom lens indicator -->
                  ${this.zoomActive ? html`
                    <div class="sr-zoom-lens"
                         style="left: ${this.zoomPosition.x}%; top: ${this.zoomPosition.y}%; transform: translate(-50%, -50%);">
                    </div>
                  ` : ''}
                </div>
                
                <!-- Thumbnail gallery -->
                ${this.renderThumbnails(displayProduct)}
              </div>
            </div>
            
            <!-- Product Info - Right side -->
            <div class="sr-product-detail-info">
              <h1 class="sr-product-detail-title">${displayProduct.name}</h1>
              
              <div class="sr-product-detail-price">
                ${this.formatPrice({ amount: this.getSelectedPrice() })}
              </div>
              
              ${displayProduct.summary ? html`
                <p class="sr-product-detail-summary">${displayProduct.summary}</p>
              ` : ''}
              
              <!-- Variant Options -->
              ${this.renderProductOptions(displayProduct, isLoadingFull)}
              
              <!-- Add to Cart Section -->
              <div class="sr-product-detail-actions">
                <div class="sr-product-detail-buttons">
                  ${this.renderAddToCartButton()}
                  ${this.renderViewCartButton()}
                </div>
                
                <!-- Product Description -->
                ${this.renderDescription(displayProduct, isLoadingFull)}
                
                <!-- Additional info -->
                <div class="sr-product-detail-info-text">
                  Free shipping on orders over $50
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private renderThumbnails = (product: Product): TemplateResult => {
    // Don't show thumbnails if no media or only one image
    if (!product.media || product.media.length <= 1) return html``;

    return html`
      <div class="sr-product-thumbnails">
        ${product.media.map((media: any, index: number) => html`
          <button
            class="sr-product-thumbnail ${index === this.selectedMediaIndex ? 'active' : ''}"
            @click="${() => { this.selectedMediaIndex = index; this.zoomActive = false; }}"
          >
            ${!this.loadedImages.has(this.getMediaUrl(media, 'w=150,h=150,fit=cover')) ? html`
              <div class="sr-skeleton sr-thumbnail-skeleton"></div>
            ` : ''}
            <img 
              src="${this.getMediaUrl(media, 'w=150,h=150,fit=cover')}" 
              alt="${product.name} ${index + 1}"
              class="sr-product-thumbnail-image"
              @load="${(e: Event) => {
                const img = e.target as HTMLImageElement;
                img.classList.add('loaded');
                this.loadedImages.add(img.src);
                this.requestUpdate();
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
        <div class="sr-product-options-skeleton">
          <div>
            <div class="sr-skeleton sr-skeleton-option-label"></div>
            <div class="sr-product-option-values">
              <div class="sr-skeleton sr-skeleton-option"></div>
              <div class="sr-skeleton sr-skeleton-option"></div>
              <div class="sr-skeleton sr-skeleton-option"></div>
            </div>
          </div>
        </div>
      `;
    }

    const displayProduct = this.fullProduct || product;
    if (!displayProduct.options || displayProduct.options.length === 0) return html``;

    return html`
      <div class="sr-product-options">
        ${displayProduct.options.map((option: ProductOption) => html`
          <div class="sr-product-option">
            <label class="sr-product-option-label">
              ${option.name}
            </label>
            <div class="sr-product-option-values">
              ${option.values?.map((value: any) => html`
                <button 
                  class="sr-variant-option ${this.selectedOptions[option.id] === value.id ? 'selected' : ''}"
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
        class="sr-button sr-add-to-cart-button ${this.addedToCart ? 'success' : canAdd && !isLoading ? '' : 'disabled'}"
        @click="${() => this.handleAddToCart()}"
        ?disabled="${!canAdd || isLoading}"
      >
        ${this.addedToCart ? html`
          <span class="sr-button-content">
            <svg class="sr-button-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
            Added to Cart
          </span>
        ` : isLoading ? html`<span class="sr-loading-spinner">${loadingSpinner('sm')}</span>` : canAdd ? 'Add to Cart' : 'Select All Options'}
      </button>
    `;
  }
  
  private renderViewCartButton = (): TemplateResult => {
    if (!this.isInCart) return html``;
    
    return html`
      <button
        class="sr-button sr-view-cart-button"
        @click=${() => this.handleViewCart()}
      >
        View Cart
      </button>
    `;
  }
  
  private handleViewCart(): void {
    // setTimeout is required here due to web component event propagation timing.
    // Without it, the event may be dispatched before other components are ready to receive it.
    // This is a known pattern when communicating between independent web components.
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('open-cart', { bubbles: true }));
    }, 0);
  }

  private renderDescription = (product: Product, isLoading: boolean): TemplateResult => {
    if (isLoading && !this.fullProduct?.description) {
      return html`
        <div class="sr-product-description">
          <h3 class="sr-product-description-title">Description</h3>
          <div class="sr-description-skeleton">
            <div class="sr-skeleton"></div>
            <div class="sr-skeleton"></div>
            <div class="sr-skeleton"></div>
            <div class="sr-skeleton short"></div>
          </div>
        </div>
      `;
    }

    const displayProduct = this.fullProduct || product;
    if (!displayProduct.description) return html``;

    return html`
      <div class="sr-product-description">
        <h3 class="sr-product-description-title">Description</h3>
        <div class="sr-product-description-content">
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

    // Prepare cart item data for optimistic update
    const cartItemData = {
      product_id: product.id,
      product_name: product.name,
      variant_id: variantId,
      variant_name: this.getSelectedVariantText() || undefined,
      quantity: 1,
      price: { amount: this.getSelectedPrice() }, // Format as Money object
      media: this.getSelectedMedia() ? [this.getSelectedMedia()] : undefined
    };
    
    // Dispatch event with full cart item data for optimistic update
    window.dispatchEvent(new CustomEvent('shoprocket:cart:add-item', {
      detail: { item: cartItemData }
    }));
    
    // Show success state immediately
    this.addedToCart = true;
    this.isInCart = true;
    setTimeout(() => {
      this.addedToCart = false;
    }, 2000);
    
    // Fire and forget API call
    this.sdk.cart.addItem({
      product_id: product.id,
      variant_id: variantId,
      quantity: 1
    } as any).catch(error => {
      console.error('Failed to add to cart:', error);
      // Don't show error to user - keep optimistic state
    });
    
    // Also dispatch the product added event for notification
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

  private async checkIfInCart(): Promise<void> {
    const product = this.fullProduct || this.product;
    if (!product) return;
    
    // Use global cart data instead of making API call
    const cart = (window as any).ShoprocketWidget?.cart?.data;
    if (cart && cart.items) {
      this.isInCart = cart.items.some((item: any) => item.product_id === product.id);
    }
  }
  
  private handleMouseEnterZoom(): void {
    // Delay zoom activation by 300ms to prevent accidental triggers
    this.zoomTimeout = window.setTimeout(() => {
      this.zoomActive = true;
    }, 300);
  }
  
  private handleMouseLeaveZoom(): void {
    // Clear any pending zoom activation
    if (this.zoomTimeout) {
      clearTimeout(this.zoomTimeout);
      this.zoomTimeout = undefined;
    }
    this.zoomActive = false;
  }
  
  private handleMouseMoveZoom(e: MouseEvent): void {
    // Always track mouse position, even before zoom is active
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    this.zoomPosition = { x, y };
  }

  private renderBackButton(): TemplateResult {
    return html`
      <button 
        class="sr-back-button" 
        @click="${() => this.dispatchEvent(new CustomEvent('back-to-list', { bubbles: true }))}"
      >
        ←
        Back 
      </button>
    `;
  }

  private renderSkeleton(): TemplateResult {
    return html`
      <div class="sr-product-detail sr-skeleton-container" data-shoprocket="product-detail-skeleton">
        <!-- Back Button -->
        ${this.renderBackButton()}
        
        <!-- Product Details Skeleton -->
        <div class="sr-product-detail-content">
          <div class="sr-product-detail-grid">
            <!-- Product Images Skeleton - Left side -->
            <div>
              <div class="sr-product-detail-media-sticky">
                <!-- Main image skeleton -->
                <div class="sr-product-detail-image-main">
                  <div class="sr-skeleton w-full h-full rounded-lg"></div>
                </div>
                
                <!-- No thumbnail skeleton - will show real thumbnails when available -->
              </div>
            </div>
            
            <!-- Product Info Skeleton - Right side -->
            <div>
              <!-- Title -->
              <div class="sr-skeleton sr-skeleton-title"></div>
              
              <!-- Price -->
              <div class="sr-skeleton sr-skeleton-price"></div>
              
              <!-- Summary -->
              <div class="sr-skeleton-summary">
                <div class="sr-skeleton"></div>
                <div class="sr-skeleton"></div>
                <div class="sr-skeleton short"></div>
              </div>
              
              <!-- Options -->
              <div class="sr-skeleton-options">
                <div>
                  <div class="sr-skeleton sr-skeleton-option-label"></div>
                  <div class="sr-product-option-values">
                    <div class="sr-skeleton sr-skeleton-option"></div>
                    <div class="sr-skeleton sr-skeleton-option"></div>
                    <div class="sr-skeleton sr-skeleton-option"></div>
                  </div>
                </div>
              </div>
              
              <!-- Add to Cart Button -->
              <div class="sr-skeleton sr-skeleton-button"></div>
              
              <!-- Description -->
              <div class="sr-product-description">
                <div class="sr-skeleton sr-skeleton-description-title"></div>
                <div class="sr-description-skeleton">
                  <div class="sr-skeleton"></div>
                  <div class="sr-skeleton"></div>
                  <div class="sr-skeleton"></div>
                  <div class="sr-skeleton short"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}