import { html, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { ShoprocketElement, EVENTS } from '../core/base-component';
import type { Product, ProductVariant, ProductOption } from '../types/api';
import { loadingSpinner } from './loading-spinner';
import { formatProductPrice } from '../utils/formatters';
import { isAllStockInCart } from '../utils/cart-utils';
import { skeleton, skeletonLines, skeletonGroup } from '../utils/skeleton';
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
    window.addEventListener('shoprocket:cart:updated', this.handleCartUpdate);
    window.addEventListener('shoprocket:cart:loaded', this.handleCartUpdate);
    
    // Listen for successful add to cart
    this.handleProductAdded = this.handleProductAdded.bind(this);
    window.addEventListener('shoprocket:product:added', this.handleProductAdded as EventListener);
  }
  
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('shoprocket:cart:updated', this.handleCartUpdate);
    window.removeEventListener('shoprocket:cart:loaded', this.handleCartUpdate);
    window.removeEventListener('shoprocket:product:added', this.handleProductAdded as EventListener);
    // Clean up zoom timeout if any
    if (this.zoomTimeout) {
      clearTimeout(this.zoomTimeout);
    }
    // Cancel any in-flight requests
    this.activeRequests.forEach(controller => controller.abort());
    this.activeRequests.clear();
  }
  
  private handleCartUpdate = async (): Promise<void> => {
    await this.checkIfInCart();
  }
  
  private handleProductAdded = (event: CustomEvent): void => {
    const { product } = event.detail;
    const currentProduct = this.fullProduct || this.product;
    
    // Only show success if this was our product
    if (currentProduct && product.id === currentProduct.id) {
      this.addedToCart = true;
      this.isInCart = true;
      setTimeout(() => {
        this.addedToCart = false;
      }, 2000);
    }
  }

  @property({ type: Object })
  product?: Product;

  @property({ type: Object })
  prevProduct?: Product | null;
  
  @property({ type: Object })
  nextProduct?: Product | null;

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
  private activeRequests = new Map<string, AbortController>();
  private currentProductId?: string;
  private loadingOptionsFor?: string;

  protected override async updated(changedProperties: Map<string, any>): Promise<void> {
    super.updated(changedProperties);
    
    // Handle navigation via product prop (from next/prev)
    if (changedProperties.has('product') && this.product) {
      // Check if it's actually a different product
      const isDifferentProduct = !this.currentProductId || 
                                this.currentProductId !== this.product.id;
      
      if (isDifferentProduct) {
        // Update current product ID immediately
        this.currentProductId = this.product.id;
        
        // Reset state for new product
        this.selectedOptions = {};
        this.selectedVariant = undefined;
        this.selectedMediaIndex = 0;
        this.zoomActive = false;
        this.addedToCart = false;
        this.isInCart = false;
        // Reset loaded image tracking so cached images still trigger display
        this.loadedImages = new Set();
        
        // Clear full product to show basic data while loading
        this.fullProduct = undefined;
        
        // Mark that we're loading options for this product
        const hasOptions = this.product.has_required_options === true;
        const hasVariants = this.product.has_variants === true || 
                           (this.product.variant_count && this.product.variant_count > 1);
        this.loadingOptionsFor = (hasOptions || hasVariants) ? this.product.id : undefined;
        
        this.requestUpdate();
        
        // Load full details in background
        this.loadProductById(this.product.id);
      }
    }
    
    // Handle direct loading via productId or slug (only if no product prop)
    if (!this.product) {
      const identifier = this.productId || this.productSlug;
      const needsLoad = (changedProperties.has('productId') || changedProperties.has('productSlug')) && 
                       identifier &&
                       (!this.fullProduct || (this.fullProduct.id !== identifier && this.fullProduct.slug !== identifier));
      
      if (needsLoad) {
        // Update current product ID immediately
        this.currentProductId = identifier;
        
        // Reset state when loading new product
        this.selectedOptions = {};
        this.selectedVariant = undefined;
        this.selectedMediaIndex = 0;
        this.zoomActive = false;
        this.addedToCart = false;
        this.isInCart = false;
        this.loadedImages = new Set();
        
        // For URL loads, we don't know if it has variants yet
        // so always show skeleton initially
        this.loadingOptionsFor = identifier;
        
        this.requestUpdate();
        
        await this.loadProductById(identifier);
      }
    }
  }

  private async loadProductById(identifier: string): Promise<void> {
    // Cancel ALL previous requests
    this.activeRequests.forEach((controller, id) => {
      console.log('Aborting request for:', id);
      controller.abort();
    });
    this.activeRequests.clear();
    
    // Create new controller for this request
    const abortController = new AbortController();
    this.activeRequests.set(identifier, abortController);
    const signal = abortController.signal;
    console.log('Starting request for:', identifier);
    
    await this.withLoading('product', async () => {
      try {
        const productData = await this.sdk.products.get(identifier, [], { signal });
        
        // Check if this is still the current product before updating
        if (this.currentProductId !== identifier && this.currentProductId !== productData.id) {
          return; // User has navigated away
        }
        
        this.fullProduct = productData;
        
        // Clear loading options flag now that we have full data
        if (this.loadingOptionsFor === identifier || this.loadingOptionsFor === productData.id) {
          this.loadingOptionsFor = undefined;
        }
        
        // If single variant, pre-select it
        if (productData.variants?.length === 1) {
          this.selectedVariant = productData.variants[0];
        }
        
        // Track product view
        if (this.fullProduct) {
          this.track(EVENTS.VIEW_ITEM, this.fullProduct);
        }
        
        this.clearError();
        
        // Only scroll if enabled and appropriate
        const hasUrlSlug = window.location.hash.includes('/');
        const scrollEnabled = this.hasFeature('scroll');
        
        if (scrollEnabled && hasUrlSlug && (this.currentProductId === identifier || this.currentProductId === productData.id)) {
          // Scroll to top after full product loads to avoid layout shift
          requestAnimationFrame(() => {
            this.scrollIntoView({ behavior: 'smooth', block: 'start' });
          });
        }
      } catch (err: any) {
        // Ignore abort errors - user navigated away
        if (err.name === 'AbortError') {
          console.log('Request aborted for:', identifier);
          return;
        }
        
        // Check if this is still the current product before showing error
        if (this.currentProductId !== identifier) {
          return; // User has navigated away
        }
        
        console.error('Failed to load product:', err);
        // Check if it's a 404 error
        if (err.response?.status === 404 || err.status === 404) {
          this.showError('Product not found. This product may no longer be available.', 0); // Don't auto-hide
        } else {
          this.showError('Unable to load product details. Please try again later.');
        }
      } finally {
        // Remove this request from active requests
        this.activeRequests.delete(identifier);
      }
    });
    
    // Check if in cart after loading (only if still current product)
    if (this.currentProductId === identifier || (this.fullProduct && this.currentProductId === this.fullProduct.id)) {
      await this.checkIfInCart();
    }
  }


  protected override render(): TemplateResult {
    // Show error state if there's an error
    if (this.errorMessage) {
      return html`
        <div class="sr-product-detail" data-shoprocket="product-detail">
          ${this.renderBackButton()}
          <div class="sr-empty-state">
            <h3 class="sr-empty-state-title">Product not found</h3>
            <p class="sr-empty-state-message">
              ${this.errorMessage}
            </p>
          </div>
        </div>
      `;
    }
    
    // Use full product if available, otherwise use basic product data
    const displayProduct = this.fullProduct || this.product;
    
    // Show skeleton if no product data yet
    if (!displayProduct) {
      return this.renderSkeleton();
    }

    // We're loading if we don't have full product yet but we need it (for variants/options)
    // OR if we have a fullProduct but it's for a different product than what we're displaying
    const isLoadingFull: boolean = this.isLoading('product') || 
                                  (!!displayProduct && !!this.fullProduct && this.fullProduct.id !== displayProduct.id);

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
                  'w=800,h=800,fit=cover',
                  displayProduct.name,
                  'sr-product-detail-image-main'
                )}
                
                <!-- Thumbnail gallery -->
                ${this.renderThumbnails(displayProduct)}
              </div>
            </div>
            
            <!-- Product Info - Right side -->
            <div class="sr-product-detail-info">
              <h1 class="sr-product-detail-title">${displayProduct.name}</h1>
              
              <div class="sr-product-detail-price">
                ${this.formatProductPrice(displayProduct)}
              </div>
              
              ${this.shouldShowStockSkeleton(displayProduct)
                ? this.renderStockStatusSkeleton()
                : this.renderStockStatus(displayProduct)}
              
              ${displayProduct.summary ? html`
                <p class="sr-product-detail-summary">${displayProduct.summary}</p>
              ` : ''}
              
              <!-- Variant Options -->
              ${this.renderProductOptions(displayProduct)}
              
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

  private renderThumbnails = (product: Product): TemplateResult => {
    // Don't show thumbnails if no media or only one image
    if (!product.media || product.media.length <= 1) return html``;

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
              'w=150,h=150,fit=cover',
              `${product.name} thumbnail ${index + 1}`,
              'sr-product-thumbnail-image'
            )}
          </button>
        `)}
      </div>
    `;
  }

  private renderProductOptions = (product: Product): TemplateResult => {
    // Get the current product ID we're displaying
    const currentId = this.product?.id || this.currentProductId || product.id;
    
    // If we're explicitly loading options for this product, show skeleton
    // Check both the loading ID and the product ID to handle race conditions
    if (this.loadingOptionsFor && 
        (this.loadingOptionsFor === currentId || 
         this.loadingOptionsFor === product.id || 
         this.loadingOptionsFor === product.slug)) {
      return html`
        <div class="sr-product-options-skeleton">
          ${skeletonGroup('option-label', 3)}
        </div>
      `;
    }
    
    // Always check if the passed-in product has actual options data first
    if (product.options && product.options.length > 0) {
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
    
    // No options to display
    return html``;
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
    if ((hasRequiredOptions || hasVariants) && !this.fullProduct && this.loadingOptionsFor) {
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
    const product = this.fullProduct || this.product;
    if (!product) return html``;

    const loadingKey = `addToCart-${product.id}`;
    const isLoading = this.isLoading(loadingKey);
    const canAdd = this.canAddToCart();
    
    // Check stock status for button text
    const variantId = this.selectedVariant?.id || product.default_variant_id;
    const totalInventory = this.selectedVariant ? 
      this.selectedVariant.inventory_quantity : 
      product.total_inventory;
    const stockStatus = isAllStockInCart(product.id, variantId, totalInventory);

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
            product.in_stock === false ? 'Out of Stock' :
            stockStatus.allInCart ? `Max (${totalInventory}) in cart` :
            this.getButtonText(product, canAdd)}
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
    // Show skeleton if loading and either no full product or different product
    const needsDescriptionSkeleton = isLoading && 
      (!this.fullProduct || this.fullProduct.id !== product.id);
      
    if (needsDescriptionSkeleton) {
      return html`
        <div class="sr-product-description">
          <h3 class="sr-product-description-title">Description</h3>
          <div class="sr-skeleton-lines">
            ${skeletonLines(4)}
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
      media: this.getSelectedMedia() ? [this.getSelectedMedia()] : undefined,
      source_url: window.location.href
    };
    
    // Include stock info for validation
    const stockInfo = {
      track_inventory: product.track_inventory,
      available_quantity: this.selectedVariant ? 
        this.selectedVariant.inventory_quantity : 
        product.total_inventory
    };
    
    // Dispatch event with full cart item data for optimistic update
    window.dispatchEvent(new CustomEvent('shoprocket:cart:add-item', {
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
    const product = this.fullProduct || this.product;
    if (!product?.variants || !product?.options) return;
    
    // Only look for exact match if all options are selected
    if (Object.keys(this.selectedOptions).length !== product.options.length) {
      this.selectedVariant = undefined;
      return;
    }

    const selectedOptionValues = Object.values(this.selectedOptions);
    
    this.selectedVariant = product.variants.find((variant: ProductVariant) => {
      const variantOptionValues = variant.option_values || variant.option_value_ids || [];
      
      // Check if variant has exactly the selected values (no more, no less)
      return variantOptionValues.length === selectedOptionValues.length &&
             selectedOptionValues.every(valueId => variantOptionValues.includes(valueId));
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
    
    // Check if out of stock
    if (product.in_stock === false) return false;
    
    // Check if all stock is already in cart
    const variantId = this.selectedVariant?.id || product.default_variant_id;
    const totalInventory = this.selectedVariant ? 
      this.selectedVariant.inventory_quantity : 
      product.total_inventory;
    
    const stockStatus = isAllStockInCart(product.id, variantId, totalInventory);
    if (stockStatus.allInCart) return false;
    
    // For single variant products, can add if in stock
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
  
  private formatProductPrice(product: Product): string {
    const selectedPrice = this.selectedVariant ? { amount: this.getSelectedPrice() } : undefined;
    return formatProductPrice(product as any, selectedPrice);
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
      return variantsWithThisOption.every(v => (v.inventory_quantity ?? 0) === 0);
    }
    
    // Find variants that match this option value AND all other current selections
    const fullyMatchingVariants = variantsWithThisOption.filter(variant => {
      const variantValues = variant.option_values || variant.option_value_ids || [];
      return otherSelections.every(valId => variantValues.includes(valId));
    });
    
    // If no fully matching variants or all have 0 inventory, it's out of stock
    if (fullyMatchingVariants.length === 0) return false; // Don't disable if no exact match yet
    return fullyMatchingVariants.every(v => (v.inventory_quantity ?? 0) === 0);
  }
  
  private renderStockStatus(product: Product | undefined): TemplateResult | string {
    if (!product || !product.track_inventory || !this.hasFeature('stock')) {
      return '';
    }
    
    // Simple low stock threshold (future: from theme/config)
    const lowStockThreshold = 10;
    
    // Determine stock based on selected variant or product total
    let stockQuantity: number;
    let inStock: boolean;
    
    if (this.selectedVariant) {
      // Use variant stock when variant is selected
      stockQuantity = this.selectedVariant.inventory_quantity ?? 0;
      inStock = stockQuantity > 0;
    } else {
      // Use product stock data from API
      stockQuantity = product.total_inventory ?? 0;
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

  private renderStockStatusSkeleton(): TemplateResult {
    return html`
      <div class="sr-stock-status sr-stock-status-skeleton">
        ${skeleton('stock')}
      </div>
    `;
  }

  private shouldShowStockSkeleton(product: Product | undefined): boolean {
    if (!product || !this.hasFeature('stock')) return false;

    // Don't show skeleton if not tracking inventory
    if (!product.track_inventory) {
      return false;
    }

    // If we have stock data already, show the real stock status instead of skeleton
    const hasStockData = product.total_inventory !== undefined || product.in_stock !== undefined;
    return !hasStockData && this.isLoading('product');
  }

  private getSelectedMedia(): any {
    const product = this.fullProduct || this.product;
    return product?.media?.[this.selectedMediaIndex] || product?.media?.[0];
  }

  private renderMediaContainer(media: any, size: string, alt: string, className: string = ''): TemplateResult {
    if (!media) {
      // Show placeholder image when no media
      const placeholderUrl = this.getMediaUrl(null, size);
      return html`
        <div class="sr-media-container sr-media-placeholder ${className}">
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
              src="${this.getMediaUrl(media, 'w=1600,h=1600,fit=cover')}"
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

  private navigateToProduct(product: Product | null | undefined): void {
    if (!product) return;
    
    // Dispatch event to parent catalog to handle navigation
    this.dispatchEvent(new CustomEvent('navigate-product', {
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
          @click="${() => this.dispatchEvent(new CustomEvent('back-to-list', { bubbles: true }))}"
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

  private renderSkeleton(): TemplateResult {
    // Render the same structure as normal but with all skeleton content
    return html`
      <div class="sr-product-detail sr-skeleton-container" data-shoprocket="product-detail-skeleton">
        ${this.renderBackButton()}
        
        <div class="sr-product-detail-content">
          <div class="sr-product-detail-grid">
            <!-- Images -->
            <div class="sr-product-detail-media">
              <div class="sr-product-detail-media-sticky">
                <div class="sr-media-container sr-product-detail-image-main">
                  <div class="sr-media-skeleton"></div>
                </div>
              </div>
            </div>
            
            <!-- Info -->
            <div class="sr-product-detail-info">
              ${skeleton('title')}
              ${skeleton('price')}
              ${skeleton('stock')}
              
              <div class="sr-skeleton-lines mb-6">
                ${skeletonLines(3)}
              </div>
              
              <div class="mb-8">
                ${skeletonGroup('option-label', 3)}
              </div>
              
              <div class="sr-product-detail-actions">
                <div class="sr-product-detail-buttons">
                  ${skeleton('button')}
                </div>
                
                <div class="sr-product-description">
                  <h3 class="sr-product-description-title">Description</h3>
                  <div class="sr-skeleton-lines">
                    ${skeletonLines(4)}
                  </div>
                </div>
                
                <div class="sr-product-detail-info-text">
                  ${skeleton()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}
