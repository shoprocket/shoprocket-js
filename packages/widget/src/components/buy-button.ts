import { html } from 'lit';
import { property, state } from 'lit/decorators.js';
import { ShoprocketElement } from '../core/base-component';
import type { Product } from '../types/api';
import { formatProductPrice } from '../utils/formatters';
import { loadingSpinner } from './loading-spinner';
import { TIMEOUTS, WIDGET_EVENTS } from '../constants';
import { isAllStockInCart } from '../utils/cart-utils';
import { HashRouter } from '../core/hash-router';

/**
 * Buy Button Component - Quick add-to-cart button for products
 *
 * Automatically handles:
 * - Simple products: Direct add to cart (or modal if action="view")
 * - Products with variants: Opens modal for selection (unless variant specified)
 * - Specific variants: Direct add to cart when data-variant provided
 * - Out of stock: Disables button
 * - Success states: Shows confirmation
 *
 * @example
 * <!-- Basic buy button -->
 * <div data-shoprocket="buy-button" data-product="prod_123"></div>
 *
 * @example
 * <!-- Add specific variant to cart (bypasses modal) -->
 * <div data-shoprocket="buy-button"
 *      data-product="awesome-tshirt"
 *      data-variant="var_456"></div>
 *
 * @example
 * <!-- View product button (always opens modal) -->
 * <div data-shoprocket="buy-button"
 *      data-product="prod_123"
 *      data-action="view"></div>
 *
 * @example
 * <!-- With price display -->
 * <div data-shoprocket="buy-button"
 *      data-product="awesome-tshirt"
 *      data-show-price="true"></div>
 *
 * @example
 * <!-- Specific variant with name and price -->
 * <div data-shoprocket="buy-button"
 *      data-product="prod_123"
 *      data-variant="var_large_blue"
 *      data-show-name="true"
 *      data-show-price="true"></div>
 */
export class BuyButton extends ShoprocketElement {
  // Use Shadow DOM - this is a top-level widget component

  @property({ type: String, attribute: 'data-product' }) product?: string;
  @property({ type: String, attribute: 'data-variant' }) variant?: string;
  @property({ type: String, attribute: 'data-action' }) action: 'buy' | 'view' = 'buy';
  @property({ type: Boolean, attribute: 'data-show-price' }) showPrice = false;
  @property({ type: Boolean, attribute: 'data-show-name' }) showName = false;
  @property({ type: Number, attribute: 'data-quantity' }) quantity = 1;

  @state() private productData?: Product;
  @state() private loading = false;
  @state() private adding = false;
  @state() private success = false;
  @state() private showingModal = false;
  @state() private modalProduct?: Product;
  @state() private keepOverlay = false;

  private successTimeout?: number;
  private hashRouter!: HashRouter;
  private hashChangeHandler = () => this.handleHashChange();
  private isCartOpening = false;

  override async connectedCallback(): Promise<void> {
    super.connectedCallback();

    if (!this.product) {
      console.error('Buy button requires data-product attribute');
      return;
    }

    // Initialize hash router
    this.hashRouter = HashRouter.getInstance();

    // Listen for hash changes
    this.hashRouter.addEventListener('state-change', this.hashChangeHandler);

    // Listen to cart events for reactivity
    this.handleCartUpdate = this.handleCartUpdate.bind(this);
    window.addEventListener(WIDGET_EVENTS.CART_LOADED, this.handleCartUpdate as EventListener);
    window.addEventListener(WIDGET_EVENTS.CART_UPDATED, this.handleCartUpdate as EventListener);

    // Listen for cart open event to close modal
    this.handleCartOpen = this.handleCartOpen.bind(this);
    window.addEventListener(WIDGET_EVENTS.OPEN_CART, this.handleCartOpen as EventListener);

    // Always preload product for best UX
    await this.loadProduct();

    // Prefetch product-view component during idle time for instant modal opens
    this.prefetchProductView();

    // Check if we should open modal based on initial URL
    this.handleHashChange();
  }

  private prefetchProductView(): void {
    // Use requestIdleCallback if available, otherwise setTimeout
    const prefetch = () => {
      // Prefetch both product-view and product-detail for instant modal opens
      if (!customElements.get('shoprocket-product-view')) {
        import('./product-view').catch(() => {});
      }
      if (!customElements.get('shoprocket-product')) {
        import('./product-detail').catch(() => {});
      }
    };

    if ('requestIdleCallback' in window) {
      requestIdleCallback(prefetch);
    } else {
      setTimeout(prefetch, 1);
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();

    if (this.successTimeout) {
      clearTimeout(this.successTimeout);
    }

    // Remove hash change listener
    this.hashRouter.removeEventListener('state-change', this.hashChangeHandler);

    // Remove cart event listeners
    window.removeEventListener(WIDGET_EVENTS.CART_LOADED, this.handleCartUpdate as EventListener);
    window.removeEventListener(WIDGET_EVENTS.CART_UPDATED, this.handleCartUpdate as EventListener);
    window.removeEventListener(WIDGET_EVENTS.OPEN_CART, this.handleCartOpen as EventListener);
  }

  private handleCartUpdate = (): void => {
    // Trigger re-render when cart updates
    // The button will check cart state during render
    this.requestUpdate();
  }

  private handleCartOpen = (): void => {
    // Close modal when cart opens to prevent overlapping
    if (this.showingModal) {
      // Set flag to prevent hash change from closing modal immediately
      this.isCartOpening = true;

      // Clear product from URL
      const state = this.hashRouter.getCurrentState();
      if (state.view === 'product') {
        this.hashRouter.navigateToList(false);
      }

      // Hide modal content immediately but keep overlay briefly
      this.showingModal = false;
      this.modalProduct = undefined;
      this.keepOverlay = true;

      // Remove overlay after transition completes
      setTimeout(() => {
        this.keepOverlay = false;
        document.body.style.overflow = '';
        this.isCartOpening = false;
      }, 220);
    }
  }

  private async loadProduct(): Promise<void> {
    if (!this.product || !this.sdk) return;

    try {
      this.loading = true;
      this.productData = await this.sdk.products.get(this.product);

      // Validate specified variant if provided
      if (this.variant) {
        this.validateVariant();
      }

      this.clearError();
    } catch (err: any) {
      // Show user-friendly error message
      if (err.response?.status === 404 || err.status === 404) {
        // 404 is expected for invalid product IDs - don't log to console
        this.showError('Product not found', 0);
      } else {
        // Unexpected error - log for debugging
        console.error('Failed to load product for buy button:', err);
        this.showError('Failed to load product', 0);
      }
    } finally {
      this.loading = false;
    }
  }

  private validateVariant(): void {
    if (!this.productData || !this.variant) return;

    // Check if product has variants
    if (!this.productData.variants || this.productData.variants.length === 0) {
      console.warn(`Product ${this.product} has no variants, but data-variant="${this.variant}" was specified`);
      this.showError('Invalid variant', 0);
      return;
    }

    // Check if specified variant exists
    const variantExists = this.productData.variants.some(v => v.id === this.variant);
    if (!variantExists) {
      console.warn(`Variant ${this.variant} not found for product ${this.product}`);
      this.showError('Variant not found', 0);
      return;
    }
  }

  private async handleClick(): Promise<void> {
    if (!this.productData || this.adding || this.success) return;

    // If action is "view", always open modal
    if (this.action === 'view') {
      this.openProductModal();
      return;
    }

    // For "buy" action with specific variant: skip modal and add to cart directly
    if (this.variant) {
      this.addToCart();
      return;
    }

    // For "buy" action: check if product needs variant selection
    if (this.productData.has_variants || this.productData.has_required_options) {
      this.openProductModal();
    } else {
      this.addToCart();
    }
  }

  private addToCart(): void {
    if (!this.productData) return;

    // Use specified variant if provided, otherwise use default
    const variantId = this.variant || this.productData.default_variant_id;

    // Get variant details if a specific variant was selected
    let variantName: string | undefined = undefined;
    let variantPrice = this.productData.price;
    let variantInventory = this.productData.inventory_count ?? 0;
    if (this.variant && this.productData.variants) {
      const selectedVariant = this.productData.variants.find(v => v.id === this.variant);
      if (selectedVariant) {
        variantName = this.getVariantText(selectedVariant);
        variantPrice = selectedVariant.price;
        variantInventory = selectedVariant.inventory_count ?? 0;
      }
    }

    // Prepare cart item data for optimistic update (matching catalog pattern)
    const cartItemData = {
      productId: this.productData.id,
      productName: this.productData.name,
      variantId: variantId,
      variantName: variantName,
      quantity: this.quantity,
      price: variantPrice,
      media: this.productData.media?.[0] ? [this.productData.media[0]] : undefined,
      source_url: window.location.href
    };

    // Include stock info for validation
    const stockInfo = {
      track_inventory: this.productData.track_inventory ?? true,
      available_quantity: variantInventory
    };

    // Dispatch event to cart component - it will handle optimistic update and API call
    window.dispatchEvent(new CustomEvent(WIDGET_EVENTS.CART_ADD_ITEM, {
      detail: { item: cartItemData, stockInfo }
    }));

    // Show success state
    this.success = true;

    // Reset success state after timeout
    this.successTimeout = window.setTimeout(() => {
      this.success = false;
    }, TIMEOUTS.SUCCESS_MESSAGE);
  }

  private getVariantText(variant: any): string | undefined {
    // Try to use variant name if available
    if (variant.name) return variant.name;

    // Otherwise construct from option values
    if (!this.productData?.options || !variant.optionValues) return undefined;

    const variantParts: string[] = [];
    const variantOptionValues = variant.optionValues || variant.optionValueIds || [];

    this.productData.options.forEach((option: any) => {
      const matchingValue = option.values?.find((v: any) =>
        variantOptionValues.includes(v.id)
      );
      if (matchingValue) {
        variantParts.push(matchingValue.value);
      }
    });

    return variantParts.length > 0 ? variantParts.join(' / ') : undefined;
  }

  private handleHashChange(): void {
    if (!this.productData) return;

    const state = this.hashRouter.getCurrentState();
    const productSlug = this.productData.slug || this.productData.id;

    // Check if URL is showing this button's product
    const shouldShowModal = state.view === 'product' && state.productSlug === productSlug;

    if (shouldShowModal && !this.showingModal) {
      // Open modal without updating URL (already updated)
      this.openProductModalSilent();
    } else if (!shouldShowModal && this.showingModal && !this.isCartOpening) {
      // Close modal without navigating (already navigated away)
      // Unless cart is opening - in that case handleCartOpen will close it with delay
      this.closeModalSilent();
    }
  }

  private async openProductModal(): Promise<void> {
    if (!this.productData) return;

    const productSlug = this.productData.slug || this.productData.id;

    // Update URL to show this product
    this.hashRouter.navigateToProduct(productSlug, false);

    // Open modal (hash change will trigger this, but do it immediately for better UX)
    await this.openProductModalSilent();
  }

  private async openProductModalSilent(): Promise<void> {
    if (!this.productData) return;

    // Ensure product-view is registered
    if (!customElements.get('shoprocket-product-view')) {
      try {
        const { ProductView } = await import('./product-view');
        customElements.define('shoprocket-product-view', ProductView);
      } catch (err) {
        // Element may have been defined by another component in a race condition
        if (!(err instanceof DOMException && err.name === 'NotSupportedError')) {
          throw err;
        }
      }
    }

    // Lock body scroll
    document.body.style.overflow = 'hidden';

    // Set state to show modal
    this.showingModal = true;
    this.modalProduct = this.productData;
  }

  private closeModal(): void {
    // Navigate back to remove product from URL
    if (this.showingModal) {
      window.history.back();
    }

    // Close modal immediately (hash change will also trigger this)
    this.closeModalSilent();
  }

  private closeModalSilent(): void {
    // Unlock body scroll
    document.body.style.overflow = '';

    this.showingModal = false;
    this.modalProduct = undefined;
  }

  private canAddToCart(): boolean {
    if (!this.productData) return false;
    if (this.productData.in_stock === false) return false;
    if (this.adding || this.success) return false;
    return true;
  }

  protected override render() {
    // Remove min-height reservation once product loads
    if (this.productData && this.hasAttribute('data-sr-reserve')) {
      this.style.minHeight = '';
      this.removeAttribute('data-sr-reserve');
    }

    // Show error state
    if (this.errorMessage) {
      return html`
        <button class="sr-button sr-button-primary" disabled>
          ${this.errorMessage}
        </button>
      `;
    }

    // Show loading state
    if (this.loading || !this.productData) {
      return html`
        <button class="sr-button sr-button-primary" disabled>
          ${loadingSpinner('sm')}
        </button>
      `;
    }

    const isOutOfStock = !this.productData.in_stock;
    const needsOptions = this.productData.has_variants || this.productData.has_required_options;

    // Get the variant we'll be adding (specified or default)
    const targetVariantId = this.variant || this.productData.default_variant_id;

    // Get inventory count for the target variant
    let inventoryCount = this.productData.inventory_count;
    if (this.variant && this.productData.variants) {
      const targetVariant = this.productData.variants.find(v => v.id === this.variant);
      inventoryCount = targetVariant?.inventory_count;
    }

    // Check if all available stock is already in cart (same as product list)
    const stockStatus = isAllStockInCart(
      this.productData.id,
      targetVariantId,
      inventoryCount
    );
    const allStockInCart = stockStatus.allInCart;

    // Use same classes as product list for consistency
    const buttonClasses = [
      'sr-button',
      `sr-button-action-${this.action}`,
      this.success ? 'sr-button-success' : 'sr-button-primary'
    ].filter(Boolean).join(' ');

    return html`
      <button
        class="${buttonClasses}"
        @click=${this.handleClick}
        ?disabled=${isOutOfStock || allStockInCart || !this.canAddToCart()}
      >
        <div class="flex items-center justify-center gap-x-2 w-full px-2 min-w-0">
          ${this.showName && !this.adding && !this.success ? html`
            <span class="truncate min-w-0">${this.productData.name}</span>
          ` : ''}

          ${this.showPrice && !this.adding && !this.success ? html`
            <span class="shrink-0 whitespace-nowrap">
              ${formatProductPrice(this.productData)}
            </span>
          ` : ''}

          ${this.adding ? html`
            <span class="sr-button-content shrink-0">${loadingSpinner('sm')}</span>
          ` : this.success ? html`
            <span class="sr-button-content shrink-0">
              <svg class="sr-button-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
              </svg>
              Added
            </span>
          ` : isOutOfStock ? html`<span class="shrink-0">Out of Stock</span>` :
            allStockInCart ? html`<span class="shrink-0">Max (${inventoryCount}) in cart</span>` :
            this.action === 'view' ? html`<span class="shrink-0">View Product</span>` :
            needsOptions && !this.variant ? html`<span class="shrink-0">Select Options</span>` : html`<span class="shrink-0">Add to Cart</span>`}
        </div>
      </button>

      ${this.showingModal && this.modalProduct ? this.renderModal() : this.keepOverlay ? this.renderOverlayOnly() : ''}
    `;
  }

  private renderOverlayOnly() {
    return html`
      <div class="sr-modal-overlay transitioning"></div>
    `;
  }

  private renderModal() {
    return html`
      <div class="sr-modal-overlay" @click=${this.closeModal}>
        <div class="sr-modal-content" @click=${(e: Event) => e.stopPropagation()}>
          <button class="sr-modal-close" @click=${this.closeModal}>×</button>
          <shoprocket-product-view
            .sdk=${this.sdk}
            .productData=${this.modalProduct}
          ></shoprocket-product-view>
        </div>
      </div>
    `;
  }
}
