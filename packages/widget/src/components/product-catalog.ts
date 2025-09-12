import { html, type TemplateResult, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { ShoprocketElement } from '../core/base-component';
import type { Product, ApiResponse } from '../types/api';
import { HashRouter, type HashState } from '../core/hash-router';
import { ProductListTemplates } from './product-list';
import './product-detail';

/**
 * Product Catalog Component - Orchestrates between list and detail views
 * Uses Shadow DOM for proper isolation in client-side embeds
 */
@customElement('shoprocket-product-catalog')
export class ProductCatalog extends ShoprocketElement {
  // Track primary instance for routing
  private static primaryInstance: ProductCatalog | null = null;
  private isPrimary = false;
  
  // We still need to read attributes to pass to children
  @property({ type: String, attribute: 'store-id' })
  storeId?: string;

  @property({ type: String })
  category?: string;

  @property({ type: Number })
  limit?: number;
  
  @property({ type: Boolean, attribute: 'data-routable' })
  routable = false;

  @state()
  private selectedProduct?: Product;

  @state()
  private currentView: 'list' | 'product' = 'list';
  
  @state()
  private products: Product[] = [];
  
  @state()
  private addedToCartProducts: Set<string> = new Set();

  @state()
  private productSlugToLoad?: string;

  private savedScrollPosition = 0;
  private hashRouter!: HashRouter;

  private handleHashStateChange = async (event: Event): Promise<void> => {
    const customEvent = event as CustomEvent<HashState>;
    await this.updateViewFromState(customEvent.detail);
  };

  private async updateViewFromState(state: HashState): Promise<void> {
    if (state.view === 'product' && state.productSlug) {
      // Show product view
      await this.showProductBySlug(state.productSlug);
    } else {
      // Show list view
      this.showList();
    }
  };

  protected override async firstUpdated(_changedProperties: PropertyValues): Promise<void> {
    super.firstUpdated(_changedProperties);
    await this.loadProducts();
  }
  
  private async loadProducts(): Promise<void> {
    await this.withLoading('products', async () => {
      try {
        const response = await this.sdk.products.list({
          per_page: this.limit || 12,
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

  override async connectedCallback(): Promise<void> {
    super.connectedCallback();
    
    // Determine if this instance should be primary
    if (this.routable && !ProductCatalog.primaryInstance) {
      // Explicit routable attribute takes precedence
      ProductCatalog.primaryInstance = this;
      this.isPrimary = true;
    } else if (!this.routable && !ProductCatalog.primaryInstance) {
      // First instance becomes primary by default
      ProductCatalog.primaryInstance = this;
      this.isPrimary = true;
    }
    
    // Only primary instance handles routing
    if (this.isPrimary) {
      // Get HashRouter singleton and listen for state changes
      this.hashRouter = HashRouter.getInstance();
      this.handleHashStateChange = this.handleHashStateChange.bind(this);
      this.hashRouter.addEventListener('state-change', this.handleHashStateChange);
      
      // Set initial view based on current hash state
      const initialState = this.hashRouter.getCurrentState();
      await this.updateViewFromState(initialState);
    }
  }
  
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    
    // Clean up primary instance reference if this was primary
    if (this.isPrimary && ProductCatalog.primaryInstance === this) {
      ProductCatalog.primaryInstance = null;
      this.hashRouter?.removeEventListener('state-change', this.handleHashStateChange);
    }
  }

  protected override render(): TemplateResult {
    return html`
      <div class="sr-catalog-list-view ${this.currentView === 'list' ? 'visible' : 'hidden'}">
        ${ProductListTemplates.renderProductList(
          this.products,
          this.isLoading('products'),
          this.limit || 12,
          this.errorMessage,
          this.successMessage,
          this.addedToCartProducts,
          {
            handleProductClick: (product) => this.handleProductClick(product),
            handleAddToCart: (product) => this.handleAddToCart(product),
            formatPrice: (price) => this.formatPrice(price),
            getMediaUrl: (media) => this.getMediaUrl(media),
            handleImageError: (e) => this.handleImageError(e),
            isLoadingItem: (key) => this.isLoading(key)
          }
        )}
      </div>
      ${this.currentView === 'product' ? html`
        <shoprocket-product-detail
          .sdk="${this.sdk}"
          .product="${this.selectedProduct}"
          product-slug="${this.productSlugToLoad || ''}"
          @back-to-list="${() => this.backToList()}"
        ></shoprocket-product-detail>
      ` : ''}
    `;
  }

  private handleProductClick(product: Product): void {
    this.showProductDetail(product);
  }
  
  private async handleAddToCart(product: Product): Promise<void> {
    // Check if product needs options selected
    if (!product.quick_add_eligible || !product.default_variant_id) {
      // Show product detail view
      this.handleProductClick(product);
      return;
    }
    
    // Prepare cart item data for optimistic update
    const cartItemData = {
      product_id: product.id,
      product_name: product.name,
      variant_id: product.default_variant_id,
      variant_name: undefined, // No variant text for default variant
      quantity: 1,
      price: product.price, // Already in correct format from API
      media: product.media?.[0] ? [product.media[0]] : undefined
    };
    
    // Dispatch event with full cart item data for optimistic update
    window.dispatchEvent(new CustomEvent('shoprocket:cart:add-item', {
      detail: { item: cartItemData }
    }));
    
    // Show success state immediately
    this.addedToCartProducts.add(product.id);
    this.requestUpdate(); // Force re-render to show success state
    setTimeout(() => {
      this.addedToCartProducts.delete(product.id);
      this.requestUpdate();
    }, 2000);
    
    // Fire and forget API call
    this.sdk.cart.addItem({
      product_id: product.id,
      variant_id: product.default_variant_id,
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
          price: product.price,
          media: product.media?.[0],
          variantText: null
        }
      }
    }));
  }
  
  private showProductDetail(product: Product): void {
    const productSlug = product.slug || product.id;
    
    // Store the basic product data to pass along
    this.selectedProduct = product;
    this.productSlugToLoad = productSlug;
    
    if (this.isPrimary) {
      // Primary instance updates URL
      this.hashRouter.navigateToProduct(productSlug);
    } else {
      // Non-primary instances just update local state
      this.currentView = 'product';
      this.savedScrollPosition = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
    }
  }

  private async showProductBySlug(productSlug: string): Promise<void> {
    
    // Save current scroll position
    this.savedScrollPosition = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
    
    // Check if we have the product in our list to show immediately
    if (this.products.length > 0) {
      const productInList = this.products.find((p: Product) => p.slug === productSlug || p.id === productSlug);
      if (productInList) {
        this.selectedProduct = productInList;
      }
    }
    
    // Always set the slug so product-detail can load full details
    this.productSlugToLoad = productSlug;
    this.currentView = 'product';
    
    // Scroll to catalog widget immediately when showing product view
    // requestAnimationFrame(() => {
    //   this.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // });
  }

  private showList(): void {
    this.currentView = 'list';
    this.selectedProduct = undefined;
    this.productSlugToLoad = undefined;
    
    // Restore scroll position after DOM updates
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({
          top: this.savedScrollPosition,
          left: 0,
          behavior: 'instant'
        });
      });
    });
  }


  private backToList(): void {
    if (this.isPrimary) {
      // Primary instance updates URL
      this.hashRouter.navigateToList();
    } else {
      // Non-primary instances just update local state
      this.showList();
    }
  }

}