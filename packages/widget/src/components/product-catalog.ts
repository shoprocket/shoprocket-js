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
  private currentPage = 1;
  
  @state()
  private totalPages = 1;
  
  // @state()
  // private totalProducts = 0; // Reserved for showing total count

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
    } else if (this.currentView === 'product') {
      // Only call showList when actually transitioning FROM product view
      this.showList();
    } else if (state.view === 'list' && this.currentView === 'list') {
      // We're in list view - check if page changed
      const targetPage = state.page || 1; // Default to page 1 if no page specified
      if (targetPage !== this.currentPage) {
        await this.loadProducts(targetPage);
        this.scrollToTop();
      }
    }
  };

  protected override async firstUpdated(_changedProperties: PropertyValues): Promise<void> {
    super.firstUpdated(_changedProperties);
    // Don't load products here if we're the primary instance - connectedCallback handles it
    if (!this.isPrimary) {
      await this.loadProducts(this.currentPage);
    }
  }
  
  private async loadProducts(page: number = 1): Promise<void> {
    await this.withLoading('products', async () => {
      try {
        const response = await this.sdk.products.list({
          page,
          per_page: this.limit || 12,
          category: this.category,
        }) as ApiResponse<Product[]>;

        this.products = response.data || [];
        this.currentPage = page;
        
        // Update pagination info from API response
        // The API returns meta directly with total and per_page
        if (response.meta) {
          const meta = response.meta as any;
          if (meta.total && meta.per_page) {
            // Calculate total pages from total items and per_page
            this.totalPages = Math.ceil(meta.total / meta.per_page);
            // this.totalProducts = meta.total; // For future use
          } else if (response.meta?.pagination) {
            // Fallback to standard pagination structure if it exists
            this.totalPages = response.meta.pagination.total_pages;
          }
        }
        
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
      
      // Handle initial state - either product view or list with page
      if (initialState.view === 'list') {
        // Load products for the initial page (default 1 or from URL)
        const pageToLoad = initialState.page || 1;
        await this.loadProducts(pageToLoad);
      } else {
        // Product view will be handled by updateViewFromState
        await this.updateViewFromState(initialState);
      }
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
        ${this.currentView === 'list' && this.totalPages > 1 ? this.renderPagination() : ''}
      </div>
      ${this.currentView === 'product' ? html`
        <shoprocket-product-detail
          .sdk="${this.sdk}"
          .product="${this.selectedProduct}"
          .prevProduct="${this.getPrevProduct()}"
          .nextProduct="${this.getNextProduct()}"
          product-slug="${this.productSlugToLoad || ''}"
          @back-to-list="${() => this.backToList()}"
          @navigate-product="${(e: CustomEvent) => this.handleProductNavigation(e)}"
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
  
  private getPrevProduct(): Product | null {
    if (!this.products) return null;
    
    // Find current product by slug or ID (works even when loading directly via URL)
    const currentProduct = this.selectedProduct || 
      this.products.find(p => p.slug === this.productSlugToLoad || p.id === this.productSlugToLoad);
    
    if (!currentProduct) return null;
    
    const currentIndex = this.products.findIndex(p => p.id === currentProduct.id);
    return currentIndex > 0 ? this.products[currentIndex - 1] || null : null;
  }

  private getNextProduct(): Product | null {
    if (!this.products) return null;
    
    // Find current product by slug or ID (works even when loading directly via URL)
    const currentProduct = this.selectedProduct || 
      this.products.find(p => p.slug === this.productSlugToLoad || p.id === this.productSlugToLoad);
    
    if (!currentProduct) return null;
    
    const currentIndex = this.products.findIndex(p => p.id === currentProduct.id);
    return currentIndex < this.products.length - 1 ? this.products[currentIndex + 1] || null : null;
  }

  private handleProductNavigation(event: CustomEvent): void {
    const { product } = event.detail;
    if (product) {
      this.showProductDetail(product);
    }
  }

  private renderPagination(): TemplateResult {
    const maxVisible = 5; // Max number of page buttons to show
    
    // Calculate range of pages to show
    let startPage = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(this.totalPages, startPage + maxVisible - 1);
    
    // Adjust if we're near the end
    if (endPage - startPage < maxVisible - 1) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }
    
    return html`
      <div class="sr-pagination">
        <button 
          class="sr-pagination-button sr-pagination-prev"
          ?disabled="${this.currentPage === 1 || this.isLoading('products')}"
          @click="${() => this.goToPage(this.currentPage - 1)}"
        >
          ← Previous
        </button>
        
        <div class="sr-pagination-pages">
          ${startPage > 1 ? html`
            <button 
              class="sr-pagination-button sr-pagination-page"
              @click="${() => this.goToPage(1)}"
            >1</button>
            ${startPage > 2 ? html`<span class="sr-pagination-ellipsis">...</span>` : ''}
          ` : ''}
          
          ${Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i).map(page => html`
            <button 
              class="sr-pagination-button sr-pagination-page ${page === this.currentPage ? 'active' : ''}"
              ?disabled="${this.isLoading('products')}"
              @click="${() => page !== this.currentPage && this.goToPage(page)}"
            >${page}</button>
          `)}
          
          ${endPage < this.totalPages ? html`
            ${endPage < this.totalPages - 1 ? html`<span class="sr-pagination-ellipsis">...</span>` : ''}
            <button 
              class="sr-pagination-button sr-pagination-page"
              @click="${() => this.goToPage(this.totalPages)}"
            >${this.totalPages}</button>
          ` : ''}
        </div>
        
        <button 
          class="sr-pagination-button sr-pagination-next"
          ?disabled="${this.currentPage === this.totalPages || this.isLoading('products')}"
          @click="${() => this.goToPage(this.currentPage + 1)}"
        >
          Next →
        </button>
      </div>
    `;
  }
  
  private async goToPage(page: number): Promise<void> {
    if (page < 1 || page > this.totalPages || page === this.currentPage) return;
    
    // Clear products to show loading skeleton
    this.products = [];
    
    if (this.isPrimary) {
      // Update URL hash with page number - this will trigger updateViewFromState
      this.hashRouter.updateCatalogState({ page });
      // The hash change will handle loading and scrolling
    } else {
      // Non-primary instances load directly
      await this.loadProducts(page);
      this.scrollToTop();
    }
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
  
  private scrollToTop(): void {
    requestAnimationFrame(() => {
      this.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

}