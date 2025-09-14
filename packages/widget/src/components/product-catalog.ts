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
    
    // Listen for successful product additions
    this.handleProductAdded = this.handleProductAdded.bind(this);
    window.addEventListener('shoprocket:product:added', this.handleProductAdded as EventListener);
    
    // Listen for cart loaded/updated to update button states
    this.handleCartUpdate = this.handleCartUpdate.bind(this);
    window.addEventListener('shoprocket:cart:loaded', this.handleCartUpdate as EventListener);
    window.addEventListener('shoprocket:cart:updated', this.handleCartUpdate as EventListener);
    
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
    
    window.removeEventListener('shoprocket:product:added', this.handleProductAdded as EventListener);
    window.removeEventListener('shoprocket:cart:loaded', this.handleCartUpdate as EventListener);
    window.removeEventListener('shoprocket:cart:updated', this.handleCartUpdate as EventListener);
    
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
  
  private handleProductAdded = (event: CustomEvent): void => {
    const { product } = event.detail;
    
    // Show success state
    this.addedToCartProducts.add(product.id);
    this.requestUpdate();
    
    setTimeout(() => {
      this.addedToCartProducts.delete(product.id);
      this.requestUpdate();
    }, 2000);
  }
  
  private handleCartUpdate = (): void => {
    // Just trigger a re-render when cart updates
    // The product list will check cart state during render
    this.requestUpdate();
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
    
    // Include stock info for validation
    const stockInfo = {
      track_inventory: product.track_inventory ?? true, // Default to true if not specified
      available_quantity: product.total_inventory ?? 0
    };
    
    // Dispatch event to cart component - it will handle everything
    window.dispatchEvent(new CustomEvent('shoprocket:cart:add-item', {
      detail: { item: cartItemData, stockInfo }
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