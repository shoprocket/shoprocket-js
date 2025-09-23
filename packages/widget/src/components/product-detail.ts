import { html, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { ShoprocketElement, EVENTS } from '../core/base-component';
import type { Product, ProductVariant, ProductOption } from '../types/api';
import { loadingSpinner } from './loading-spinner';
import { formatProductPrice } from '../utils/formatters';
import { isAllStockInCart } from '../utils/cart-utils';
import { TIMEOUTS, STOCK_THRESHOLDS, IMAGE_SIZES, WIDGET_EVENTS } from '../constants';
import './tooltip'; // Register tooltip component

export class ProductDetail extends ShoprocketElement {
  // Render in light DOM so merchant CSS variables flow directly into content
  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // Listen for cart updates to refresh cart state
    this.handleCartUpdate = this.handleCartUpdate.bind(this);
    window.addEventListener(WIDGET_EVENTS.CART_UPDATED, this.handleCartUpdate);
    window.addEventListener(WIDGET_EVENTS.CART_LOADED, this.handleCartUpdate);
    
    // Listen for successful add to cart
    this.handleProductAdded = this.handleProductAdded.bind(this);
    window.addEventListener(WIDGET_EVENTS.PRODUCT_ADDED, this.handleProductAdded as EventListener);
  }
  
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener(WIDGET_EVENTS.CART_UPDATED, this.handleCartUpdate);
    window.removeEventListener(WIDGET_EVENTS.CART_LOADED, this.handleCartUpdate);
    window.removeEventListener(WIDGET_EVENTS.PRODUCT_ADDED, this.handleProductAdded as EventListener);
    // Clean up zoom timeout if any
    if (this.zoomTimeout) {
      clearTimeout(this.zoomTimeout);
    }
  }
  
  private handleCartUpdate = async (): Promise<void> => {
    await this.checkIfInCart();
  }
  
  private handleProductAdded = (event: CustomEvent): void => {
    const { product } = event.detail;
    const currentProduct = this.product;
    
    // Only show success if this was our product
    if (currentProduct && product.id === currentProduct.id) {
      this.addedToCart = true;
      this.isInCart = true;
      setTimeout(() => {
        this.addedToCart = false;
      }, TIMEOUTS.SUCCESS_MESSAGE);
    }
  }

  @property({ type: Object })
  product?: Product; // Optional to support skeleton state

  @property({ type: Object })
  prevProduct?: Product | null;
  
  @property({ type: Object })
  nextProduct?: Product | null;
  


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
    
    // When product changes, reset component state
    if (changedProperties.has('product') && this.product) {
      const oldProduct = changedProperties.get('product') as Product | undefined;
      
      // Only reset if it's actually a different product
      if (!oldProduct || oldProduct.id !== this.product.id) {
        
        // Reset state for new product
        this.selectedOptions = {};
        this.selectedVariant = undefined;
        this.selectedMediaIndex = 0;
        this.zoomActive = false;
        this.addedToCart = false;
        this.isInCart = false;
        // Reset loaded image tracking so cached images still trigger display
        this.loadedImages = new Set();
        
        
        // If single variant, pre-select it
        if (this.product.variants?.length === 1) {
          this.selectedVariant = this.product.variants[0];
        }
        
        // Track product view - sanitizer will format it properly
        this.track(EVENTS.VIEW_ITEM, this.product);
        
        // Check if in cart
        await this.checkIfInCart();
        
        // Scroll to top if enabled
        if (this.hasFeature('scroll') && window.location.hash.includes('/')) {
          requestAnimationFrame(() => {
            this.scrollIntoView({ behavior: 'smooth', block: 'start' });
          });
        }
      }
    }
  }

  protected override render(): TemplateResult {
    // Render full structure immediately, with skeletons for missing data

    return html`
      <div class="sr-product-detail" data-shoprocket="product-detail">
        <!-- Back Button -->
        ${this.renderBackButton()}
        
        <!-- Product Details -->
        <div class="sr-product-detail-content">
          <div class="sr-product-detail-grid">
            <!-- Product Images - Left side -->
            <div class="sr-product-detail-media">
              <div class="sr-product-detail-media-sticky">
                <!-- Main image with zoom -->
                ${this.renderMediaContainer(
                  this.getSelectedMedia(),
                  IMAGE_SIZES.MAIN,
                  this.product?.name || 'Product image',
                  'sr-product-detail-image-main',
                  !this.product
                )}
                
                <!-- Thumbnail gallery -->
                ${this.renderThumbnails(this.product)}
              </div>
            </div>
            
            <!-- Product Info - Right side -->
            <div class="sr-product-detail-info">
              <h1 class="sr-product-detail-title ${!this.product ? 'sr-skeleton' : ''}">
                ${this.product?.name || ''}
              </h1>
              
              <div class="sr-product-detail-price ${!this.product ? 'sr-skeleton' : ''}">
                ${this.product ? this.formatProductPrice(this.product) : ''}
              </div>
              
              ${this.renderStockStatus(this.product)}
              
              <p class="sr-product-detail-summary ${!this.product ? 'sr-skeleton' : ''}">
                ${this.product?.summary || ''}
              </p>
              
              <!-- Variant Options -->
              ${this.renderProductOptions(this.product)}
              
              <!-- Add to Cart Section -->
              <div class="sr-product-detail-actions">
                <div class="sr-product-detail-buttons">
                  ${this.renderAddToCartButton()}
                  ${this.renderViewCartButton()}
                </div>
                
                <!-- Product Description -->
                ${this.renderDescription(this.product)}
                
                <!-- Additional info -->
                <div class="sr-product-detail-info-text">
                  <sr-tooltip text="Free standard shipping (5-7 business days) on all orders over $50. Express shipping available at checkout." wrap>
                    Free shipping on orders over $50
                  </sr-tooltip>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private renderThumbnails = (product: Product | undefined): TemplateResult => {
    // Don't show thumbnails if no media or only one image
    if (!product?.media || product.media.length <= 1) return html``;

    return html`
      <div class="sr-product-thumbnails">
        ${product.media.map((media: any, index: number) => html`
          <button
            class="sr-product-thumbnail ${index === this.selectedMediaIndex ? 'active' : ''}"
            @click="${() => { this.selectedMediaIndex = index; this.zoomActive = false; }}"
            aria-label="View image ${index + 1} of ${product.media!.length}"
          >
            ${this.renderMediaContainer(
              media,
              IMAGE_SIZES.THUMBNAIL,
              `${product.name} thumbnail ${index + 1}`,
              'sr-product-thumbnail-image'
            )}
          </button>
        `)}
      </div>
    `;
  }

  private renderProductOptions = (product: Product | undefined): TemplateResult => {
    // For now, only show options when product is loaded
    // Future: could show skeleton options based on has_required_options flag
    if (!product?.options || product.options.length === 0) {
      return html``;
    }
    
    return html`
        <div class="sr-product-options">
          ${product.options.map((option: ProductOption) => html`
            <div class="sr-product-option">
              <label class="sr-product-option-label">
                ${option.name}
              </label>
              <div class="sr-product-option-values">
                ${option.values?.map((value: any) => {
                  const isDisabled = this.isOptionValueOutOfStock(option.id, value.id, product);
                  const button = html`
                    <button 
                      class="sr-variant-option ${this.selectedOptions[option.id] === value.id ? 'selected' : ''}"
                      @click="${() => !isDisabled && this.selectOption(option.id, value.id)}"
                      ?disabled="${isDisabled}"
                    >
                      ${value.value}
                    </button>
                  `;
                  
                  // Wrap disabled buttons in tooltip
                  return isDisabled ? html`
                    <sr-tooltip text="Out of stock" position="top">
                      ${button}
                    </sr-tooltip>
                  ` : button;
                }) || ''}
              </div>
            </div>
          `)}
        </div>
      `;
  }

  private getButtonText(product: Product, canAdd: boolean): string {
    // If we can add, always show "Add to Cart"
    if (canAdd) return 'Add to Cart';
    
    // If out of stock
    if (product.in_stock === false) return 'Out of Stock';
    
    // During loading, determine text based on catalog data
    const hasRequiredOptions = product.has_required_options === true;
    const hasVariants = product.has_variants === true || 
                       (product.variant_count && product.variant_count > 1);
    
    // If loading full product and has options/variants, check if we have full data
    if ((hasRequiredOptions || hasVariants) && !this.product) {
      // Still loading, but we can make educated guess
      if (product.quick_add_eligible === true) {
        return 'Add to Cart';
      }
      return hasRequiredOptions ? 'Select Options' : 'Add to Cart';
    }
    
    // If product has no required options or variants, or is quick add eligible
    if (!hasRequiredOptions || product.quick_add_eligible === true) {
      return 'Add to Cart';
    }
    
    // Has required options that need selection
    return 'Select Options';
  }
  
  private renderAddToCartButton = (): TemplateResult => {
    const buttonClasses = `sr-button sr-add-to-cart-button ${!this.product ? 'sr-skeleton' : ''}`;
    
    if (!this.product) {
      return html`<button class="${buttonClasses}" disabled></button>`;
    }

    const loadingKey = `addToCart-${this.product.id}`;
    const isLoading = this.isLoading(loadingKey);
    const canAdd = this.canAddToCart();
    
    // Check stock status for button text
    const variantId = this.selectedVariant?.id || this.product.default_variant_id;
    const totalInventory = this.selectedVariant ? 
      this.selectedVariant.inventory_count : 
      this.product.inventory_count;
    const stockStatus = isAllStockInCart(this.product.id, variantId, totalInventory);

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
        ` : isLoading ? html`<span class="sr-loading-spinner">${loadingSpinner('sm')}</span>` : 
            this.product.in_stock === false ? 'Out of Stock' :
            stockStatus.allInCart ? `Max (${totalInventory}) in cart` :
            this.getButtonText(this.product, canAdd)}
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
      window.dispatchEvent(new CustomEvent(WIDGET_EVENTS.OPEN_CART, { bubbles: true }));
    }, 0);
  }

  private renderDescription = (product: Product | undefined): TemplateResult => {
    if (!product?.description) return html``;

    return html`
      <div class="sr-product-description">
        <h3 class="sr-product-description-title">Description</h3>
        <div class="sr-product-description-content">
          ${unsafeHTML(product.description)}
        </div>
      </div>
    `;
  }

  private async handleAddToCart(): Promise<void> {
    if (!this.product || !this.canAddToCart()) return;

    const variantId = this.selectedVariant?.id || this.product.default_variant_id;
    if (!variantId) {
      this.showError('Please select all options before adding to cart.');
      return;
    }

    // Get the full Money object for the selected variant or product
    const selectedPrice = this.selectedVariant?.price || this.product.price;

    // Prepare cart item data for optimistic update
    const cartItemData = {
      product_id: this.product.id,
      product_name: this.product.name,
      variant_id: variantId,
      variant_name: this.getSelectedVariantText() || undefined,
      quantity: 1,
      price: selectedPrice, // Pass the full Money object from API
      media: this.getSelectedMedia() ? [this.getSelectedMedia()] : undefined,
      source_url: window.location.href
    };
    
    // Include stock info for validation
    const stockInfo = {
      track_inventory: this.product.track_inventory,
      available_quantity: this.selectedVariant ? 
        this.selectedVariant.inventory_count : 
        this.product.inventory_count
    };
    
    // Dispatch event with full cart item data for optimistic update
    window.dispatchEvent(new CustomEvent(WIDGET_EVENTS.CART_ADD_ITEM, {
      detail: { item: cartItemData, stockInfo }
    }));
    
    // DON'T show success immediately - wait for the cart to confirm
    // The cart will dispatch shoprocket:product:added if successful
    // or shoprocket:cart:error if it fails
  }

  private selectOption(optionId: string, valueId: string): void {
    this.selectedOptions = { ...this.selectedOptions, [optionId]: valueId };
    this.updateSelectedVariant();
  }

  private updateSelectedVariant(): void {
    if (!this.product?.variants || !this.product?.options) return;
    
    // Only look for exact match if all options are selected
    if (Object.keys(this.selectedOptions).length !== this.product.options.length) {
      this.selectedVariant = undefined;
      return;
    }

    const selectedOptionValues = Object.values(this.selectedOptions);
    
    this.selectedVariant = this.product.variants.find((variant: ProductVariant) => {
      const variantOptionValues = variant.option_values || variant.option_value_ids || [];
      
      // Check if variant has exactly the selected values (no more, no less)
      return variantOptionValues.length === selectedOptionValues.length &&
             selectedOptionValues.every(valueId => variantOptionValues.includes(valueId));
    });
    
    // If variant has specific media, find its index and select it
    if (this.selectedVariant?.media_id && this.product.media) {
      const mediaIndex = this.product.media.findIndex((m: any) => m.id === this.selectedVariant!.media_id);
      if (mediaIndex !== -1) {
        this.selectedMediaIndex = mediaIndex;
      }
    }
  }

  private canAddToCart(): boolean {
    if (!this.product) return false;
    
    // Check if out of stock
    if (this.product.in_stock === false) return false;
    
    // Check if all stock is already in cart
    const variantId = this.selectedVariant?.id || this.product.default_variant_id;
    const totalInventory = this.selectedVariant ? 
      this.selectedVariant.inventory_count : 
      this.product.inventory_count;
    
    const stockStatus = isAllStockInCart(this.product.id, variantId, totalInventory);
    if (stockStatus.allInCart) return false;
    
    // For single variant products, can add if in stock
    if (this.product.variants?.length === 1) return true;
    
    // For multi-variant, need all options selected
    if (!this.product.options) return false;
    
    return this.product.options.every((option: ProductOption) => 
      this.selectedOptions[option.id]
    );
  }

  private formatProductPrice(product: Product): string {
    // Use the full Money object from selectedVariant or product
    const selectedPrice = this.selectedVariant?.price;
    return formatProductPrice(product, selectedPrice);
  }
  
  private isOptionValueOutOfStock(optionId: string, valueId: string, product: Product): boolean {
    if (!product.track_inventory || !product.variants) return false;
    
    // Find all variants that have this specific option value
    const variantsWithThisOption = product.variants.filter(variant => {
      const variantValues = variant.option_values || variant.option_value_ids || [];
      return variantValues.includes(valueId);
    });
    
    // If no variants have this option value, it shouldn't exist
    if (variantsWithThisOption.length === 0) return true;
    
    // Check if there are any other selected options
    const otherSelections = Object.entries(this.selectedOptions)
      .filter(([optId]) => optId !== optionId)
      .map(([, valId]) => valId);
    
    if (otherSelections.length === 0) {
      // No other selections, just check if any variant with this option has stock
      return variantsWithThisOption.every(v => (v.inventory_count ?? 0) === 0);
    }
    
    // Find variants that match this option value AND all other current selections
    const fullyMatchingVariants = variantsWithThisOption.filter(variant => {
      const variantValues = variant.option_values || variant.option_value_ids || [];
      return otherSelections.every(valId => variantValues.includes(valId));
    });
    
    // If no fully matching variants or all have 0 inventory, it's out of stock
    if (fullyMatchingVariants.length === 0) return false; // Don't disable if no exact match yet
    return fullyMatchingVariants.every(v => (v.inventory_count ?? 0) === 0);
  }
  
  private renderStockStatus(product: Product | undefined): TemplateResult | string {
    if (!this.hasFeature('stock')) {
      return '';
    }
    
    if (!product || !product.track_inventory) {
      return '';
    }
    
    // Simple low stock threshold (future: from theme/config)
    const lowStockThreshold = STOCK_THRESHOLDS.LOW;
    
    // Determine stock based on selected variant or product total
    let stockQuantity: number;
    let inStock: boolean;
    
    if (this.selectedVariant) {
      // Use variant stock when variant is selected
      stockQuantity = this.selectedVariant.inventory_count ?? 0;
      inStock = stockQuantity > 0;
    } else {
      // Use product stock data from API
      stockQuantity = product.inventory_count ?? 0;
      inStock = product.in_stock ?? (stockQuantity > 0);
    }
    
    // Always show out of stock
    if (!inStock || stockQuantity === 0) {
      return html`
        <div class="sr-stock-status sr-out-of-stock">
          Out of Stock
        </div>
      `;
    }
    
    const isLowStock = stockQuantity <= lowStockThreshold;
    
    // Always show stock when feature is enabled
    return html`
      <div class="sr-stock-status ${isLowStock ? 'sr-low-stock' : 'sr-in-stock'}">
        ${isLowStock ? html`
          <sr-tooltip text="Limited availability - order soon to avoid disappointment">
            Only ${stockQuantity} left in stock
          </sr-tooltip>
        ` : `${stockQuantity} in stock`}
      </div>
    `;
  }



  private getSelectedMedia(): any {
    const product = this.product;
    return product?.media?.[this.selectedMediaIndex] || product?.media?.[0];
  }

  private renderMediaContainer(media: any, size: string, alt: string, className: string = '', showSkeleton: boolean = false): TemplateResult {
    if (showSkeleton) {
      // Pure skeleton - no image
      return html`
        <div class="sr-media-container ${className} sr-skeleton"></div>
      `;
    }
    
    if (!media) {
      // Show placeholder when no media but product is loaded
      const placeholderUrl = this.getMediaUrl(null, size);
      return html`
        <div class="sr-media-container ${className} sr-media-placeholder">
          <img 
            src="${placeholderUrl}"
            alt="${alt}"
            loading="lazy"
            @error="${this.handleImageError}"
          />
        </div>
      `;
    }
    
    const url = this.getMediaUrl(media, size);
    const isLoaded = this.loadedImages.has(url);
    const isMainImage = className.includes('sr-product-detail-image-main');
    
    return html`
      <div 
        class="sr-media-container ${className}" 
        data-loaded="${isLoaded}"
        data-zoom-active="${isMainImage ? this.zoomActive : false}"
        @mouseenter="${isMainImage ? () => this.handleMouseEnterZoom() : null}"
        @mouseleave="${isMainImage ? () => this.handleMouseLeaveZoom() : null}"
        @mousemove="${isMainImage ? (e: MouseEvent) => this.handleMouseMoveZoom(e) : null}"
      >
        ${!isLoaded ? html`<div class="sr-media-skeleton"></div>` : ''}
        <img 
          src="${url}"
          alt="${alt}"
          class="sr-media-image"
          loading="${size.includes('1600') ? 'lazy' : 'eager'}"
          @load="${() => this.handleImageLoad(url)}"
          @error="${(e: Event) => this.handleImageError(e)}"
        >
        
        ${isMainImage && this.zoomActive ? html`
          <div class="sr-product-detail-image-zoom"
               style="--zoom-x: ${this.zoomPosition.x}%; --zoom-y: ${this.zoomPosition.y}%;">
            <img 
              src="${this.getMediaUrl(media, IMAGE_SIZES.ZOOM)}"
              alt="${alt} (zoomed)"
              class="sr-media-image"
              loading="lazy"
            >
          </div>
          
          <!-- Zoom lens indicator -->
          <div class="sr-zoom-lens"
               style="--lens-x: ${this.zoomPosition.x}%; --lens-y: ${this.zoomPosition.y}%;">
          </div>
        ` : ''}
      </div>
    `;
  }

  private handleImageLoad(url: string): void {
    this.loadedImages.add(url);
    this.requestUpdate();
  }

  private getSelectedVariantText(): string | null {
    const product = this.product;
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
    const product = this.product;
    if (!product) return;
    
    // Use global cart data instead of making API call
    const cart = (window as any).Shoprocket?.cart?.get?.();
    if (cart && cart.items) {
      this.isInCart = cart.items.some((item: any) => item.product_id === product.id);
    }
  }
  
  private handleMouseEnterZoom(): void {
    // Delay zoom activation by 300ms to prevent accidental triggers
    this.zoomTimeout = window.setTimeout(() => {
      this.zoomActive = true;
    }, TIMEOUTS.ZOOM_DELAY);
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

  private navigateToProduct(product: Product | null | undefined): void {
    if (!product) return;
    
    // Dispatch event to parent catalog to handle navigation
    this.dispatchEvent(new CustomEvent(WIDGET_EVENTS.NAVIGATE_PRODUCT, {
      detail: { product },
      bubbles: true
    }));
  }

  private renderBackButton(): TemplateResult {
    // Check if navigation feature is enabled
    if (!this.hasFeature('navigation')) {
      return html``;
    }
    
    return html`
      <div class="sr-product-navigation">
        <button 
          class="sr-back-button" 
          @click="${() => this.dispatchEvent(new CustomEvent(WIDGET_EVENTS.BACK_TO_LIST, { bubbles: true }))}"
        >
          ←
          Back
        </button>
        
        <div class="sr-product-nav-buttons">
          <button 
            class="sr-nav-button sr-nav-prev ${!this.prevProduct ? 'disabled' : ''}"
            ?disabled="${!this.prevProduct}"
            @click="${() => this.navigateToProduct(this.prevProduct)}"
          >
            ← Previous
          </button>
          <button 
            class="sr-nav-button sr-nav-next ${!this.nextProduct ? 'disabled' : ''}"
            ?disabled="${!this.nextProduct}"
            @click="${() => this.navigateToProduct(this.nextProduct)}"
          >
            Next →
          </button>
        </div>
      </div>
    `;
  }

}