import { html, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { ShoprocketElement, EVENTS } from '../core/base-component';
import type { Product, ProductVariant, ProductOption, BundleSelection, Review, ReviewStats } from '@shoprocket/core';
import { loadingSpinner } from './loading-spinner';
import { formatProductPrice, getMediaSizes, formatNumber } from '../utils/formatters';
import { isAllStockInCart } from '../utils/cart-utils';
import { TIMEOUTS, STOCK_THRESHOLDS, IMAGE_SIZES, WIDGET_EVENTS } from '../constants';
import './tooltip'; // Register tooltip component
import { t } from '../utils/i18n';
import { renderStarRating } from '../utils/stars';

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
    this.requestUpdate(); // Re-render to update stock-based button states
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

  @state()
  private quantity: number = 1;

  @state()
  private bundleSelections: BundleSelection[] = [];

  @state()
  private bundleValid: boolean = false;

  // Reviews state
  @state()
  private reviews: Review[] = [];

  @state()
  private reviewStats: ReviewStats | null = null;

  @state()
  private reviewsPage: number = 1;

  @state()
  private reviewsTotalPages: number = 1;

  @state()
  private reviewsLoading: boolean = false;

  private bundleConfiguratorLoaded: boolean = false;

  private zoomTimeout?: number;

  /** True when bundleConfig is fully loaded and ready */
  private get isBundle(): boolean {
    return this.product?.productType === 'bundle' && !!this.product.bundleConfig;
  }

  /** True as soon as we know it's a bundle (even before config loads) */
  private get isBundleProduct(): boolean {
    return this.product?.productType === 'bundle';
  }

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
        this.quantity = 1;
        this.bundleSelections = [];
        this.bundleValid = false;
        // Reset loaded image tracking so cached images still trigger display
        this.loadedImages = new Set();
        // Reset reviews state
        this.reviews = [];
        this.reviewStats = null;
        this.reviewsPage = 1;
        this.reviewsTotalPages = 1;

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

      // Lazy-load bundle configurator when bundleConfig becomes available
      // (may arrive after initial product load, since list data doesn't include it)
      if (this.product.productType === 'bundle' && this.product.bundleConfig && !this.bundleConfiguratorLoaded) {
        this.loadBundleConfigurator();
      }
    }
  }

  protected override render(): TemplateResult {
    // Render full structure immediately, with data-loading for skeleton state

    return html`
      <div class="sr-product-detail" data-shoprocket="product-detail" ?data-loading="${!this.product}">
        <!-- Back Button -->
        ${this.renderBackButton()}
        
        <!-- Product Details -->
        <div class="sr-product-detail-content">
          <div class="sr-product-detail-grid" ?data-no-media="${!this.hasFeature('media')}">
            <!-- Product Images - Left side -->
            ${this.hasFeature('media') ? html`
              <div class="sr-product-detail-media">
                <div class="sr-product-detail-media-sticky">
                  <!-- Main image with zoom -->
                  ${this.renderMediaContainer(
                    this.getSelectedMedia(),
                    IMAGE_SIZES.MAIN,
                    this.product?.name || t('product.image', 'Product image'),
                    'sr-product-detail-image-main',
                    !this.product
                  )}

                  <!-- Thumbnail gallery -->
                  ${this.hasFeature('gallery') ? this.renderThumbnails(this.product) : ''}
                </div>
              </div>
            ` : ''}

            <!-- Product Info - Right side -->
            <div class="sr-product-detail-info">
              ${this.hasFeature('title') ? html`
                <h1 class="sr-product-detail-title">
                  ${this.product?.name || ''}
                </h1>
              ` : ''}

              ${this.hasFeature('price') ? html`
                <div class="sr-product-detail-price">
                  ${this.product ? this.formatProductPrice(this.product) : ''}
                </div>
              ` : ''}

              ${this.product?.reviewCount && this.product?.averageRating ? html`
                <a class="sr-product-detail-rating" href="#sr-reviews" @click="${(e: Event) => {
                  e.preventDefault();
                  const reviewsEl = this.querySelector('.sr-reviews-section');
                  if (reviewsEl) reviewsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}">
                  ${renderStarRating(this.product.averageRating, this.product.reviewCount)}
                </a>
              ` : ''}

              ${this.renderStockStatus(this.product)}

              ${this.hasFeature('summary') ? html`
                <p class="sr-product-detail-summary">
                  ${this.product?.summary || ''}
                </p>
              ` : ''}

              <!-- Variant Options / Bundle Configurator -->
              ${this.isBundleProduct ? this.renderBundleConfigurator() : this.renderProductOptions(this.product)}

              <!-- Quantity Selector (hidden for bundles) -->
              ${!this.isBundleProduct && this.hasFeature('quantity') ? this.renderQuantitySelector() : ''}

              <!-- Add to Cart Section -->
              ${this.hasFeature('add-to-cart') ? html`
                <div class="sr-product-detail-actions">
                  <div class="sr-product-detail-buttons">
                    ${this.renderAddToCartButton()}
                    ${this.renderViewCartButton()}
                  </div>
                </div>
              ` : ''}

              <!-- Product Description -->
              ${this.hasFeature('description') ? this.renderDescription(this.product) : ''}

              <!-- Reviews Section -->
              ${this.hasFeature('reviews') ? this.renderReviewsSection() : ''}

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
    // Show skeleton if product is loading but we know it has required options
    if (!product?.options) {
      // Check if we have metadata indicating variants exist (from catalog listing)
      const hasVariants = product?.hasRequiredOptions || product?.quickAddEligible === false;

      if (hasVariants) {
        // Render conservative skeleton: 1 row with 4 button placeholders
        return html`
          <div class="sr-product-options" data-loading>
            <div class="sr-product-option">
              <label class="sr-product-option-label"></label>
              <div class="sr-product-option-values">
                ${Array.from({ length: 4 }, () => html`
                  <button class="sr-variant-option" disabled></button>
                `)}
              </div>
            </div>
          </div>
        `;
      }

      return html``;
    }

    if (product.options.length === 0) {
      return html``;
    }

    return html`
        <div class="sr-product-options">
          ${product.options.map((option: ProductOption) => html`
            <div class="sr-product-option">
              <label class="sr-product-option-label">
                ${option.name}${this.selectedOptions[option.id]
                  ? html` — <span class="sr-product-option-selected">${option.values?.find((v: any) => v.id === this.selectedOptions[option.id])?.value || ''}</span>`
                  : ''}
              </label>
              <div class="sr-product-option-values">
                ${option.values?.map((value: any) => {
                  const isDisabled = this.isOptionValueOutOfStock(option.id, value.id, product);
                  const isSelected = this.selectedOptions[option.id] === value.id;
                  const button = value.color
                    ? html`
                      <button
                        class="sr-variant-swatch ${isSelected ? 'selected' : ''}"
                        style="background-color: ${value.color}"
                        @click="${() => !isDisabled && this.selectOption(option.id, value.id)}"
                        ?disabled="${isDisabled}"
                        aria-label="${value.value}"
                      ></button>
                    `
                    : html`
                      <button
                        class="sr-variant-option ${isSelected ? 'selected' : ''}"
                        @click="${() => !isDisabled && this.selectOption(option.id, value.id)}"
                        ?disabled="${isDisabled}"
                      >
                        ${value.value}
                      </button>
                    `;

                  // Wrap disabled buttons in tooltip
                  return isDisabled ? html`
                    <sr-tooltip text="${t('product.out_of_stock', 'Out of Stock')}" position="top">
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

  private renderQuantitySelector = (): TemplateResult => {
    if (!this.product) {
      return html``;
    }

    // Get max quantity based on stock
    const variantId = this.selectedVariant?.id || this.product.defaultVariantId;
    const totalInventory = this.selectedVariant ?
      this.selectedVariant.inventoryCount :
      this.product.inventoryCount;

    // Check how many are already in cart
    const stockStatus = isAllStockInCart(this.product.id, variantId, totalInventory);
    // Calculate available quantity (total - what's in cart)
    // If no inventory tracking, default to 999 max
    const maxQuantity = totalInventory
      ? Math.max(0, totalInventory - stockStatus.quantityInCart)
      : 999;

    const allStockInCart = maxQuantity === 0;
    const canDecrease = this.quantity > 1 && !allStockInCart;
    const canIncrease = this.quantity < maxQuantity && !allStockInCart;

    // Tooltip messages
    const decreaseTooltip = allStockInCart
      ? t('product.all_stock_in_cart', 'All available stock ({count}) is in your cart', { count: totalInventory })
      : '';
    const increaseTooltip = allStockInCart
      ? t('product.all_stock_in_cart', 'All available stock ({count}) is in your cart', { count: totalInventory })
      : t('product.max_available', 'Maximum available ({count})', { count: maxQuantity });

    const decreaseButton = html`
      <button
        class="sr-quantity-button"
        @click="${() => canDecrease && this.quantity--}"
        ?disabled="${!canDecrease}"
        aria-label="Decrease quantity"
      >
        −
      </button>
    `;

    const increaseButton = html`
      <button
        class="sr-quantity-button"
        @click="${() => canIncrease && this.quantity++}"
        ?disabled="${!canIncrease}"
        aria-label="Increase quantity"
      >
        +
      </button>
    `;

    return html`
      <div class="sr-quantity-selector">
        <label class="sr-quantity-label">Quantity</label>
        <div class="sr-quantity-controls">
          ${allStockInCart ? html`
            <sr-tooltip text="${decreaseTooltip}" position="top">
              ${decreaseButton}
            </sr-tooltip>
          ` : decreaseButton}
          <input
            type="number"
            class="sr-quantity-input"
            .value="${this.quantity}"
            @input="${(e: Event) => this.handleQuantityInput(e)}"
            min="1"
            max="${maxQuantity || 1}"
            ?disabled="${allStockInCart}"
            aria-label="Quantity"
          />
          ${!canIncrease ? html`
            <sr-tooltip text="${increaseTooltip}" position="top">
              ${increaseButton}
            </sr-tooltip>
          ` : increaseButton}
        </div>
      </div>
    `;
  }

  private handleQuantityInput(e: Event): void {
    const input = e.target as HTMLInputElement;
    const value = parseInt(input.value, 10);

    if (isNaN(value) || value < 1) {
      this.quantity = 1;
      input.value = '1';
      return;
    }

    // Get max quantity
    const variantId = this.selectedVariant?.id || this.product?.defaultVariantId;
    const totalInventory = this.selectedVariant ?
      this.selectedVariant.inventoryCount :
      this.product?.inventoryCount;
    const stockStatus = isAllStockInCart(this.product?.id || '', variantId, totalInventory);
    // Calculate available quantity (total - what's in cart)
    // If no inventory tracking, default to 999 max
    const maxQuantity = totalInventory
      ? Math.max(0, totalInventory - stockStatus.quantityInCart)
      : 999;

    if (value > maxQuantity) {
      this.quantity = maxQuantity;
      input.value = String(maxQuantity);
      return;
    }

    this.quantity = value;
  }

  private getButtonText(product: Product, canAdd: boolean): string {
    // Bundle-specific text
    if (this.isBundleProduct) {
      if (!this.product?.bundleConfig) return t('bundle.loading', 'Loading bundle options...');
      return canAdd
        ? t('cart.add_to_cart', 'Add to Cart')
        : t('bundle.complete_selection', 'Complete Your Selection');
    }

    // If we can add, always show "Add to Cart"
    if (canAdd) return t('cart.add_to_cart', 'Add to Cart');

    // If out of stock
    if (product.inStock === false) return t('product.out_of_stock', 'Out of Stock');

    // During loading, determine text based on catalog data
    const hasRequiredOptions = product.hasRequiredOptions === true;
    const hasVariants = product.hasVariants === true ||
                       (product.variantCount && product.variantCount > 1);

    // If loading full product and has options/variants, check if we have full data
    if ((hasRequiredOptions || hasVariants) && !this.product) {
      // Still loading, but we can make educated guess
      if (product.quickAddEligible === true) {
        return t('cart.add_to_cart', 'Add to Cart');
      }
      return hasRequiredOptions ? t('product.select_options', 'Select Options') : t('cart.add_to_cart', 'Add to Cart');
    }

    // If product has no required options or variants, or is quick add eligible
    if (!hasRequiredOptions || product.quickAddEligible === true) {
      return 'Add to Cart';
    }

    // Has required options that need selection
    return t('product.select_options', 'Select Options');
  }
  
  private renderAddToCartButton = (): TemplateResult => {
    const buttonClasses = `sr-button sr-add-to-cart-button`;

    if (!this.product) {
      return html`<button class="${buttonClasses}" disabled></button>`;
    }

    const loadingKey = `addToCart-${this.product.id}`;
    const isLoading = this.isLoading(loadingKey);
    const canAdd = this.canAddToCart();

    // Bundles don't use variant-level stock checks (component stock validated server-side)
    let stockAllInCart = false;
    let totalInventory = 0;
    if (!this.isBundleProduct) {
      const variantId = this.selectedVariant?.id || this.product.defaultVariantId;
      totalInventory = this.selectedVariant ?
        (this.selectedVariant.inventoryCount ?? 0) :
        (this.product.inventoryCount ?? 0);
      const stockStatus = isAllStockInCart(this.product.id, variantId, totalInventory);
      stockAllInCart = stockStatus.allInCart;
    }

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
            this.product.inStock === false ? 'Out of Stock' :
            stockAllInCart ? `Max (${totalInventory}) in cart` :
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
        <h2 class="sr-product-description-title">Description</h2>
        <div class="sr-product-description-content">
          ${unsafeHTML(product.description)}
        </div>
      </div>
    `;
  }

  // =========================================================================
  // Reviews
  // =========================================================================

  private renderReviewsSection(): TemplateResult {
    if (!this.product) return html``;

    // Lazy-load reviews on first render
    if (!this.reviewStats && !this.reviewsLoading && this.reviews.length === 0) {
      this.loadReviews();
    }

    const hasReviews = this.reviewStats && this.reviewStats.reviewCount > 0;

    return html`
      <div class="sr-reviews-section">
        <h2 class="sr-reviews-title">${t('reviews.title', 'Customer Reviews')}</h2>

        ${this.reviewsLoading && !hasReviews ? html`
          <div class="sr-reviews-loading">${loadingSpinner('md')}</div>
        ` : ''}

        ${hasReviews ? this.renderReviewsSummary() : ''}

        ${!this.reviewsLoading && !hasReviews ? html`
          <p class="sr-reviews-empty">${t('reviews.no_reviews', 'No reviews yet.')}</p>
        ` : ''}

        ${hasReviews ? this.renderReviewList() : ''}
      </div>
    `;
  }

  private renderReviewsSummary(): TemplateResult {
    if (!this.reviewStats) return html``;

    const { avgRating, reviewCount, ratingDistribution } = this.reviewStats;
    const maxCount = Math.max(...Object.values(ratingDistribution), 1);

    return html`
      <div class="sr-reviews-summary">
        <div class="sr-reviews-summary-score">
          <span class="sr-reviews-avg-rating">${avgRating.toFixed(1)}</span>
          ${renderStarRating(avgRating)}
          <span class="sr-reviews-count">
            ${t('reviews.based_on', 'Based on {count} review(s)', { count: reviewCount })}
          </span>
        </div>
        <div class="sr-rating-bars">
          ${[5, 4, 3, 2, 1].map(star => {
            const count = ratingDistribution[star] || 0;
            const pct = reviewCount > 0 ? (count / maxCount) * 100 : 0;
            return html`
              <div class="sr-rating-bar-row">
                <span class="sr-rating-bar-label">${star}</span>
                <svg class="sr-star sr-star-filled sr-rating-bar-star" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                </svg>
                <div class="sr-rating-bar-track">
                  <div class="sr-rating-bar-fill" style="width: ${pct}%"></div>
                </div>
                <span class="sr-rating-bar-count">${count}</span>
              </div>
            `;
          })}
        </div>
      </div>
    `;
  }

  private renderReviewList(): TemplateResult {
    return html`
      <div class="sr-review-list">
        ${this.reviews.map(review => html`
          <div class="sr-review-card">
            <div class="sr-review-header">
              ${renderStarRating(review.rating)}
              <span class="sr-review-date">${this.formatReviewDate(review.createdAt)}</span>
            </div>
            ${review.title ? html`<h4 class="sr-review-title">${review.title}</h4>` : ''}
            <p class="sr-review-content">${review.content}</p>
            <div class="sr-review-footer">
              <span class="sr-review-author">${review.authorName}</span>
              ${review.isVerifiedPurchase ? html`
                <span class="sr-verified-badge">
                  <svg class="sr-verified-icon" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                  </svg>
                  ${t('reviews.verified', 'Verified Purchase')}
                </span>
              ` : ''}
            </div>
          </div>
        `)}

        ${this.reviewsPage < this.reviewsTotalPages ? html`
          <button
            class="sr-button sr-reviews-load-more"
            @click="${() => this.loadMoreReviews()}"
            ?disabled="${this.reviewsLoading}"
          >
            ${this.reviewsLoading ? loadingSpinner('sm') : t('reviews.load_more', 'Load More Reviews')}
          </button>
        ` : ''}
      </div>
    `;
  }


  private async loadReviews(): Promise<void> {
    if (!this.product || !this.sdk) return;
    this.reviewsLoading = true;
    try {
      const response = await this.sdk.reviews.list(this.product.id, 1);
      this.reviews = response.data || [];
      const meta = response.meta;
      if (meta) {
        this.reviewStats = {
          avgRating: meta.avgRating,
          reviewCount: meta.reviewCount,
          ratingDistribution: meta.ratingDistribution
        };
        this.reviewsTotalPages = Math.ceil((meta.total || 0) / (meta.perPage || 10));
      }
      this.reviewsPage = 1;
    } catch {
      // Silently fail — reviews are non-critical
    } finally {
      this.reviewsLoading = false;
    }
  }

  private async loadMoreReviews(): Promise<void> {
    if (!this.product || !this.sdk || this.reviewsLoading) return;
    this.reviewsLoading = true;
    try {
      const nextPage = this.reviewsPage + 1;
      const response = await this.sdk.reviews.list(this.product.id, nextPage);
      this.reviews = [...this.reviews, ...(response.data || [])];
      this.reviewsPage = nextPage;
      if (response.meta) {
        this.reviewsTotalPages = Math.ceil((response.meta.total || 0) / (response.meta.perPage || 10));
      }
    } catch {
      // Silently fail
    } finally {
      this.reviewsLoading = false;
    }
  }


  private formatReviewDate(dateStr: string): string {
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  }

  private async handleAddToCart(): Promise<void> {
    if (!this.product || !this.canAddToCart()) return;

    // Bundle add-to-cart flow
    if (this.isBundle) {
      const variantId = this.product.defaultVariantId || this.product.variants?.[0]?.id;
      if (!variantId) return;

      // Build human-readable bundle selections for optimistic cart display
      const bundleSelectionsForCart = this.bundleSelections.map(sel => {
        // Find the component/variant info from bundleConfig
        let productName = '';
        let variantName: string | undefined;
        let media: any;
        for (const comp of this.product!.bundleConfig!.components) {
          const variant = comp.variants.find(v => v.id === sel.variantId);
          if (variant) {
            productName = comp.product.name;
            variantName = variant.name || undefined;
            media = comp.product.media?.[0];
            break;
          }
        }
        return { productName, variantName, quantity: sel.quantity, media };
      });

      const cartItemData = {
        productId: this.product.id,
        productName: this.product.name,
        variantId,
        quantity: this.quantity || 1,
        price: this.product.price,
        media: this.getSelectedMedia() ? [this.getSelectedMedia()] : undefined,
        sourceUrl: window.location.href,
        productType: 'bundle',
        bundleSelections: bundleSelectionsForCart
      };

      window.dispatchEvent(new CustomEvent(WIDGET_EVENTS.CART_ADD_ITEM, {
        detail: {
          item: cartItemData,
          stockInfo: { trackInventory: false },
          bundleSelections: this.bundleSelections
        }
      }));
      return;
    }

    const variantId = this.selectedVariant?.id || this.product.defaultVariantId;
    if (!variantId) {
      this.showError(t('error.select_options_required', 'Please select all options before adding to cart.'));
      return;
    }

    // Get the full Money object for the selected variant or product
    const selectedPrice = this.selectedVariant?.price || this.product.price;

    // Prepare cart item data for optimistic update
    const cartItemData = {
      productId: this.product.id,
      productName: this.product.name,
      variantId: variantId,
      variantName: this.getSelectedVariantText() || undefined,
      quantity: this.quantity,
      price: selectedPrice, // Pass the full Money object from API
      media: this.getSelectedMedia() ? [this.getSelectedMedia()] : undefined,
      sourceUrl: window.location.href
    };

    // Include stock info for validation
    const stockInfo = {
      trackInventory: this.product.trackInventory,
      availableQuantity: this.selectedVariant ?
        this.selectedVariant.inventoryCount :
        this.product.inventoryCount
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
      const variantOptionValues = variant.optionValues || variant.optionValueIds || [];

      // Check if variant has exactly the selected values (no more, no less)
      return variantOptionValues.length === selectedOptionValues.length &&
             selectedOptionValues.every(valueId => variantOptionValues.includes(valueId));
    });

    // If variant has specific media, find its index and select it
    if (this.selectedVariant?.mediaId && this.product.media) {
      const mediaIndex = this.product.media.findIndex((m: any) => m.id === this.selectedVariant!.mediaId);
      if (mediaIndex !== -1) {
        this.selectedMediaIndex = mediaIndex;
      }
    }

    // Auto-adjust quantity if it exceeds available stock for this variant
    if (this.selectedVariant) {
      const variantId = this.selectedVariant.id;
      const totalInventory = this.selectedVariant.inventoryCount;
      const stockStatus = isAllStockInCart(this.product.id, variantId, totalInventory);
      const maxQuantity = totalInventory
        ? Math.max(0, totalInventory - stockStatus.quantityInCart)
        : 999;

      // Cap quantity to max available
      if (this.quantity > maxQuantity) {
        this.quantity = Math.max(1, maxQuantity);
      }
    }
  }

  private canAddToCart(): boolean {
    if (!this.product) return false;

    // Check if out of stock
    if (this.product.inStock === false) return false;

    // For bundles, check bundle validity
    if (this.isBundle) return this.bundleValid;

    // Check if all stock is already in cart
    const variantId = this.selectedVariant?.id || this.product.defaultVariantId;
    const totalInventory = this.selectedVariant ?
      this.selectedVariant.inventoryCount :
      this.product.inventoryCount;

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
    if (!product.trackInventory || !product.variants) return false;

    // Find all variants that have this specific option value
    const variantsWithThisOption = product.variants.filter(variant => {
      const variantValues = variant.optionValues || variant.optionValueIds || [];
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
      return variantsWithThisOption.every(v => (v.inventoryCount ?? 0) === 0);
    }

    // Find variants that match this option value AND all other current selections
    const fullyMatchingVariants = variantsWithThisOption.filter(variant => {
      const variantValues = variant.optionValues || variant.optionValueIds || [];
      return otherSelections.every(valId => variantValues.includes(valId));
    });

    // If no fully matching variants or all have 0 inventory, it's out of stock
    if (fullyMatchingVariants.length === 0) return false; // Don't disable if no exact match yet
    return fullyMatchingVariants.every(v => (v.inventoryCount ?? 0) === 0);
  }
  
  private renderStockStatus(product: Product | undefined): TemplateResult | string {
    if (!this.hasFeature('stock')) {
      return '';
    }

    if (!product || !product.trackInventory) {
      return '';
    }

    // Simple low stock threshold (future: from theme/config)
    const lowStockThreshold = STOCK_THRESHOLDS.LOW;

    // Determine stock based on selected variant or product total
    let stockQuantity: number;
    let inStock: boolean;

    if (this.selectedVariant) {
      // Use variant stock when variant is selected
      stockQuantity = this.selectedVariant.inventoryCount ?? 0;
      inStock = stockQuantity > 0;
    } else {
      // Use product stock data from API
      stockQuantity = product.inventoryCount ?? 0;
      inStock = product.inStock ?? (stockQuantity > 0);
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
          <sr-tooltip text="${t('product.limited_availability', 'Limited availability - order soon to avoid disappointment')}">
            ${t('product.stock_count_low', 'Only {count} left in stock', { count: formatNumber(stockQuantity) })}
          </sr-tooltip>
        ` : t('product.stock_count', '{count} in stock', { count: formatNumber(stockQuantity) })}
      </div>
    `;
  }



  private getSelectedMedia(): any {
    const product = this.product;
    return product?.media?.[this.selectedMediaIndex] || product?.media?.[0];
  }

  private renderMediaContainer(media: any, size: string, alt: string, className: string = '', showSkeleton: boolean = false): TemplateResult {
    if (showSkeleton) {
      // Empty container - CSS will handle skeleton
      return html`
        <div class="sr-media-container ${className}"></div>
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
    const isThumbnail = className.includes('thumbnail');

    // All images use responsive srcset for optimal loading
    if (isThumbnail) {
      return html`
        <div
          class="sr-media-container ${className}"
          data-loaded="${isLoaded}"
        >
          ${!isLoaded ? html`<div class="sr-media-loading"></div>` : ''}
          <img
            src="${url}"
            srcset="${this.getMediaSrcSet(media)}"
            sizes="150px"
            alt="${alt}"
            width="150"
            height="200"
            class="sr-media-image"
            loading="lazy"
            @load="${() => this.handleImageLoad(url)}"
            @error="${(e: Event) => this.handleImageError(e)}"
          >
        </div>
      `;
    }

    const hasZoom = this.hasFeature('zoom');

    return html`
      <div
        class="sr-media-container ${className}"
        data-loaded="${isLoaded}"
        data-zoom-enabled="${isMainImage && hasZoom}"
        data-zoom-active="${isMainImage && hasZoom ? this.zoomActive : false}"
        @mouseenter="${isMainImage && hasZoom ? () => this.handleMouseEnterZoom() : null}"
        @mouseleave="${isMainImage && hasZoom ? () => this.handleMouseLeaveZoom() : null}"
        @mousemove="${isMainImage && hasZoom ? (e: MouseEvent) => this.handleMouseMoveZoom(e) : null}"
      >
        ${!isLoaded ? html`<div class="sr-media-loading"></div>` : ''}
        <img
          src="${url}"
          srcset="${this.getMediaSrcSet(media)}"
          sizes="${getMediaSizes({ sm: 1, md: 2, lg: 2 })}"
          alt="${alt}"
          width="600"
          height="800"
          class="sr-media-image"
          loading="${size.includes('1600') ? 'lazy' : 'eager'}"
          fetchpriority="${isMainImage ? 'high' : 'auto'}"
          @load="${() => this.handleImageLoad(url)}"
          @error="${(e: Event) => this.handleImageError(e)}"
        >

        ${isMainImage && hasZoom && this.zoomActive ? html`
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
      this.isInCart = cart.items.some((item: any) => item.productId === product.id);
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

  private async loadBundleConfigurator(): Promise<void> {
    if (this.bundleConfiguratorLoaded) return;
    const { BundleConfigurator } = await import('./bundle-configurator');
    if (!customElements.get('shoprocket-bundle-configurator')) {
      customElements.define('shoprocket-bundle-configurator', BundleConfigurator);
    }
    this.bundleConfiguratorLoaded = true;
  }

  private handleBundleSelectionsChanged = (e: CustomEvent): void => {
    this.bundleSelections = e.detail.selections;
    this.bundleValid = e.detail.isValid;
  }

  private renderBundleConfigurator(): TemplateResult {
    if (!this.product?.bundleConfig) {
      return html`
        <div class="sr-bundle-loading">
          ${loadingSpinner('md')}
          <span>${t('bundle.loading', 'Loading bundle options...')}</span>
        </div>
      `;
    }

    return html`
      <shoprocket-bundle-configurator
        .bundleConfig="${this.product.bundleConfig}"
        .productId="${this.product.id}"
        .productName="${this.product.name}"
        .sdk="${this.sdk}"
        @bundle-selections-changed="${this.handleBundleSelectionsChanged}"
      ></shoprocket-bundle-configurator>
    `;
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
    // Back button hidden via CSS when inside categories widget (it provides its own navigation)
    const showPrevNext = this.prevProduct || this.nextProduct;

    return html`
      <div class="sr-product-navigation">
        <!-- Back button (hidden via CSS when inside categories widget) -->
        <button
          class="sr-back-button"
          @click="${() => this.dispatchEvent(new CustomEvent(WIDGET_EVENTS.BACK_TO_LIST, { bubbles: true }))}"
        >
          ←
          Back
        </button>

        ${showPrevNext ? html`
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
        ` : ''}
      </div>
    `;
  }

}