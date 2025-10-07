import { html, css, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { ShoprocketElement, EVENTS } from '../core/base-component';
import type { Product, ApiResponse } from '../types/api';
import { HashRouter, type HashState } from '../core/hash-router';
import { ProductListTemplates } from './product-list';
import { LIMITS, TIMEOUTS, WIDGET_EVENTS } from '../constants';

/**
 * Product Catalog Component - Displays a grid of products with pagination
 * 
 * @element shoprocket-catalog
 * @fires navigate-product - When a product is selected for viewing
 * @fires back-to-list - When returning from product detail view
 * 
 * @attr {string} data-shoprocket - Must be "catalog" to initialize this component
 * @attr {string} [data-store-id] - Store ID for loading products (if not using global config)
 * @attr {string} [data-category] - Filter products by category slug
 * @attr {number} [data-limit=12] - Number of products per page
 * @attr {boolean} [data-routable=false] - Enable URL hash synchronization for this catalog
 * @attr {string} [data-show] - Comma-separated features to show (replaces defaults)
 * @attr {string} [data-hide] - Comma-separated features to hide (removes from defaults)
 * 
 * @example
 * <!-- Basic product catalog -->
 * <div data-shoprocket="catalog"></div>
 * 
 * @example
 * <!-- Filtered catalog with pagination -->
 * <div data-shoprocket="catalog" 
 *      data-category="t-shirts" 
 *      data-limit="8"></div>
 * 
 * @example
 * <!-- Catalog with URL routing enabled -->
 * <div data-shoprocket="catalog" 
 *      data-routable="true"
 *      data-limit="20"></div>
 * 
 * @example
 * <!-- Catalog with custom features -->
 * <div data-shoprocket="catalog"
 *      data-hide="quick-add"
 *      data-show="price,title,image"></div>
 */
export class ProductCatalog extends ShoprocketElement {
  static override styles = css`
    /* Skeleton animation and styles for shadow DOM */
    @keyframes skeleton-shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }

    /* Apply skeleton to empty elements when parent has data-loading */
    [data-loading] :where(h1, h2, h3, p, span):empty {
      display: block;
      background: linear-gradient(
        90deg,
        rgb(229, 231, 235) 25%,
        rgb(243, 244, 246) 50%,
        rgb(229, 231, 235) 75%
      );
      background-size: 200% 100%;
      animation: skeleton-shimmer 1.5s ease-in-out infinite;
      border-radius: 0.25rem;
    }

    /* Specific sizing */
    [data-loading] h3:empty { min-height: 1.25rem; width: 75%; }
    [data-loading] .sr-product-price:empty { min-height: 1rem; width: 5rem; display: inline-block; }
    [data-loading] button[disabled]:empty { min-height: 2.5rem; width: 100%; }

    /* Disabled buttons skeleton */
    [data-loading] .sr-button:disabled {
      color: transparent !important;
      position: relative;
      overflow: hidden;
    }
    
    [data-loading] .sr-button:disabled::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(
        90deg,
        rgb(229, 231, 235) 25%,
        rgb(243, 244, 246) 50%,
        rgb(229, 231, 235) 75%
      );
      background-size: 200% 100%;
      animation: skeleton-shimmer 1.5s ease-in-out infinite;
      border-radius: inherit;
    }

    /* Image containers */
    [data-loading] .sr-product-image-container::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(
        90deg,
        rgb(229, 231, 235) 25%,
        rgb(243, 244, 246) 50%,
        rgb(229, 231, 235) 75%
      );
      background-size: 200% 100%;
      animation: skeleton-shimmer 1.5s ease-in-out infinite;
      z-index: 1;
    }
  `;

  // Track primary instance for routing
  private static primaryInstance: ProductCatalog | null = null;
  private isPrimary = false;
  
  // We still need to read attributes to pass to children
  @property({ type: String, attribute: 'store-id' })
  storeId?: string;

  @property({ type: String, attribute: 'data-category' })
  category?: string;

  @property({ type: Number, attribute: 'data-limit' })
  limit?: number;
  
  @property({ type: Boolean, attribute: 'data-routable' })
  routable = false;

  @state()
  private currentView: 'list' | 'product' = 'list';
  
  // Virtual pagination: Store all loaded products by their absolute position
  @state()
  private allProducts: Map<number, Product> = new Map();
  
  @state()
  private currentProductIndex: number = 0; // Absolute position in the full list
  
  @state()
  private addedToCartProducts: Set<string> = new Set();
  
  @state()
  private currentPage = 1; // Keep for URL and API calls
  
  @state()
  private totalPages = 1;
  
  @state()
  private totalProducts = 0; // Total count of all products

  @state()
  private currentProductSlug?: string;
  
  // Keep track of which pages we've loaded
  private loadedPages: Set<number> = new Set();
  // Track in-flight requests to prevent duplicates
  private loadingPages: Map<number, Promise<void>> = new Map();
  // AbortController for cancelling product detail loading
  private productLoadAbortController?: AbortController;
  
  // Store individually loaded products separately to avoid conflicts
  private individualProducts: Map<string, Product> = new Map();
  
  // Analytics tracking
  private currentTrackedPage = 0;

  private savedScrollPosition = 0;
  private hashRouter!: HashRouter;

  private handleHashStateChange = async (event: Event): Promise<void> => {
    const customEvent = event as CustomEvent<HashState>;
    await this.updateViewFromState(customEvent.detail);
  };

  private async updateViewFromState(state: HashState): Promise<void> {
    if (state.view === 'product' && state.productSlug) {
      // Set view to product immediately to prevent list from showing
      this.currentView = 'product';
      this.currentProductSlug = state.productSlug;
      
      // If we have a page parameter, use it
      if (state.params['page']) {
        const targetPage = parseInt(state.params['page'], 10);
        this.currentPage = targetPage;
        
        // Ensure the page is loaded before showing the product
        if (!this.loadedPages.has(targetPage)) {
          await this.loadProducts(targetPage);
        }
      }
      // If no page parameter, we need to find which page the product is on
      // showProductBySlug will handle loading the product and finding its page
      
      // Now show the product
      await this.showProductBySlug(state.productSlug);
      
    } else if (this.currentView === 'product') {
      // Transitioning FROM product view to list
      const targetPage = state.params['page'] ? parseInt(state.params['page'], 10) : 1;
      this.currentPage = targetPage;
      await this.showList();
      
    } else if (state.view === 'list' && this.currentView === 'list') {
      // We're in list view - check if page changed
      const targetPage = state.params['page'] ? parseInt(state.params['page'], 10) : 1;
      if (targetPage !== this.currentPage) {
        this.currentPage = targetPage;
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
  
  protected override updated(_changedProperties: PropertyValues): void {
    super.updated(_changedProperties);
    
    // Track view_item_list when list view is shown for a new page
    if (this.currentView === 'list' && this.currentPage !== this.currentTrackedPage) {
      const pageProducts = this.getPageProducts();
      if (pageProducts.length > 0) {
        this.track(EVENTS.VIEW_ITEM_LIST, {
          items: pageProducts,
          item_list_name: this.category || 'All Products',
          item_list_id: `page_${this.currentPage}`
        });
        this.currentTrackedPage = this.currentPage;
      }
    }
    
    // Note: view_item tracking is handled by the product-detail component itself
  }
  
  private async loadProducts(page: number = 1): Promise<void> {
    // Skip if we've already loaded this page
    if (this.loadedPages.has(page)) {
      this.currentPage = page;
      return;
    }
    
    // Check if this page is already being loaded
    const existingRequest = this.loadingPages.get(page);
    if (existingRequest) {
      return existingRequest;
    }
    
    // Create and store the loading promise
    const loadingPromise = this.withLoading('products', async () => {
      try {
        const response = await this.sdk.products.list({
          page,
          per_page: this.limit || 12,
          category: this.category,
        }) as ApiResponse<Product[]>;

        const products = response.data || [];
        const pageSize = this.limit || 12;
        
        // Store products by their absolute position in the full list
        products.forEach((product, index) => {
          const absoluteIndex = (page - 1) * pageSize + index;
          this.allProducts.set(absoluteIndex, product);
        });
        
        // Mark this page as loaded
        this.loadedPages.add(page);
        this.currentPage = page;
        
        // Update pagination info from API response
        if (response.meta) {
          const meta = response.meta as any;
          if (meta.total && meta.per_page) {
            this.totalPages = Math.ceil(meta.total / meta.per_page);
            this.totalProducts = meta.total;
          } else if (response.meta?.pagination) {
            this.totalPages = response.meta.pagination.total_pages;
          }
        }
        
        this.clearError();
      } catch (err) {
        console.error('Failed to load products:', err);
        this.showError('Unable to load products. Please try again later.');
      } finally {
        // Clean up the loading promise
        this.loadingPages.delete(page);
      }
    });
    
    // Store the promise to prevent duplicate requests
    this.loadingPages.set(page, loadingPromise);
    return loadingPromise;
  }

  override async connectedCallback(): Promise<void> {
    super.connectedCallback();
    
    // Listen for successful product additions
    this.handleProductAdded = this.handleProductAdded.bind(this);
    window.addEventListener(WIDGET_EVENTS.PRODUCT_ADDED, this.handleProductAdded as EventListener);
    
    // Listen for cart loaded/updated to update button states
    this.handleCartUpdate = this.handleCartUpdate.bind(this);
    window.addEventListener(WIDGET_EVENTS.CART_LOADED, this.handleCartUpdate as EventListener);
    window.addEventListener(WIDGET_EVENTS.CART_UPDATED, this.handleCartUpdate as EventListener);
    
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
      
      // Always extract page from params, even if we're in product view
      // This ensures when going back to list, we're on the correct page
      if (initialState.params['page']) {
        this.currentPage = parseInt(initialState.params['page'], 10);
      }
      
      // Handle initial state - either product view or list with page
      if (initialState.view === 'list') {
        // Load products for the current page
        await this.loadProducts(this.currentPage);
      } else {
        // Product view will be handled by updateViewFromState
        await this.updateViewFromState(initialState);
      }
    }
  }
  
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    
    // Cancel any in-flight product loading
    if (this.productLoadAbortController) {
      this.productLoadAbortController.abort();
    }
    
    window.removeEventListener(WIDGET_EVENTS.PRODUCT_ADDED, this.handleProductAdded as EventListener);
    window.removeEventListener(WIDGET_EVENTS.CART_LOADED, this.handleCartUpdate as EventListener);
    window.removeEventListener(WIDGET_EVENTS.CART_UPDATED, this.handleCartUpdate as EventListener);
    
    // Clean up primary instance reference if this was primary
    if (this.isPrimary && ProductCatalog.primaryInstance === this) {
      ProductCatalog.primaryInstance = null;
      this.hashRouter?.removeEventListener('state-change', this.handleHashStateChange);
    }
  }

  protected override render(): TemplateResult {
    const pageProducts = this.getPageProducts();
    
    return html`
      <div class="sr-catalog-list-view ${this.currentView === 'list' ? 'visible' : 'hidden'}">
        ${ProductListTemplates.renderProductList(
          pageProducts,
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
        <shoprocket-product
          .sdk="${this.sdk}"
          .product="${this.getCurrentProduct()}"
          .prevProduct="${this.getPrevProduct()}"
          .nextProduct="${this.getNextProduct()}"
          product-slug="${this.currentProductSlug || ''}"
          @back-to-list="${() => this.backToList()}"
          @navigate-product="${(e: CustomEvent) => this.handleProductNavigation(e)}"
        ></shoprocket-product>
      ` : ''}
    `;
  }

  private async handleProductClick(product: Product): Promise<void> {
    // Track product selection
    this.track(EVENTS.SELECT_ITEM, { 
      ...product,
      category: this.category 
    });
    
    // Find the product's index
    const targetIndex = this.findProductIndex(product.slug || product.id);
    if (targetIndex === -1) {
      console.error('Product not found in loaded products');
      return;
    }
    
    this.currentProductIndex = targetIndex;
    await this.showProductDetail(product);
  }
  
  private handleProductAdded = (event: CustomEvent): void => {
    const { product } = event.detail;
    
    // Show success state
    this.addedToCartProducts.add(product.id);
    this.requestUpdate();
    
    setTimeout(() => {
      this.addedToCartProducts.delete(product.id);
      this.requestUpdate();
    }, TIMEOUTS.SUCCESS_MESSAGE);
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
      media: product.media?.[0] ? [product.media[0]] : undefined,
      source_url: window.location.href
    };
    
    // Include stock info for validation
    const stockInfo = {
      track_inventory: product.track_inventory ?? true, // Default to true if not specified
      available_quantity: product.inventory_count ?? 0
    };
    
    // Dispatch event to cart component - it will handle everything
    window.dispatchEvent(new CustomEvent(WIDGET_EVENTS.CART_ADD_ITEM, {
      detail: { item: cartItemData, stockInfo }
    }));
  }
  
  private getCurrentProduct(): Product | undefined {
    if (!this.currentProductSlug) return undefined;
    
    // First check individually loaded products
    const individualProduct = this.individualProducts.get(this.currentProductSlug);
    if (individualProduct) {
      return individualProduct;
    }
    
    // Then try to get the product at the current index
    const productAtIndex = this.allProducts.get(this.currentProductIndex);
    
    // Verify it's the correct product by checking the slug
    if (productAtIndex) {
      const productSlug = productAtIndex.slug || productAtIndex.id;
      if (productSlug === this.currentProductSlug) {
        return productAtIndex;
      }
    }
    
    // If not found at index, search all paginated products
    for (const [, product] of this.allProducts) {
      const productSlug = product.slug || product.id;
      if (productSlug === this.currentProductSlug) {
        return product;
      }
    }
    
    return undefined;
  }

  private getPrevProduct(): Product | null {
    if (this.currentProductIndex <= 0) return null;
    
    const prevIndex = this.currentProductIndex - 1;
    const prevProduct = this.allProducts.get(prevIndex);
    
    // If we don't have the previous product loaded, we need to load its page
    if (!prevProduct && prevIndex >= 0) {
      this.ensureProductLoaded(prevIndex);
    }
    
    return prevProduct || null;
  }

  private getNextProduct(): Product | null {
    if (this.currentProductIndex >= this.totalProducts - 1) return null;
    
    const nextIndex = this.currentProductIndex + 1;
    const nextProduct = this.allProducts.get(nextIndex);
    
    // If we don't have the next product loaded, we need to load its page
    if (!nextProduct && nextIndex < this.totalProducts) {
      this.ensureProductLoaded(nextIndex);
    }
    
    return nextProduct || null;
  }
  
  // Get products for the current page view
  private getPageProducts(): Product[] {
    const pageSize = this.limit || 12;
    const startIndex = (this.currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    
    const products: Product[] = [];
    for (let i = startIndex; i < endIndex && i < this.totalProducts; i++) {
      const product = this.allProducts.get(i);
      if (product) {
        products.push(product);
      }
    }
    
    return products;
  }
  
  // Ensure a product at a specific index is loaded
  private async ensureProductLoaded(index: number): Promise<void> {
    const pageSize = this.limit || 12;
    const pageNumber = Math.floor(index / pageSize) + 1;
    
    // Load the current page if needed
    if (!this.loadedPages.has(pageNumber)) {
      await this.loadProducts(pageNumber);
    }
    
    // Determine position within the page
    const positionInPage = index % pageSize;
    const isNearPageStart = positionInPage <= 1; // First two products
    const isNearPageEnd = positionInPage >= pageSize - 2; // Last two products
    
    // Only preload adjacent pages if we're near page boundaries
    if (isNearPageStart && pageNumber > 1 && !this.loadedPages.has(pageNumber - 1)) {
      this.loadProducts(pageNumber - 1); // Don't await - background load
    }
    if (isNearPageEnd && pageNumber < this.totalPages && !this.loadedPages.has(pageNumber + 1)) {
      this.loadProducts(pageNumber + 1); // Don't await - background load
    }
  }
  
  // Find product index by slug or ID
  private findProductIndex(identifier: string): number {
    for (const [index, product] of this.allProducts.entries()) {
      if (product.slug === identifier || product.id === identifier) {
        return index;
      }
    }
    return -1;
  }

  private async handleProductNavigation(event: CustomEvent): Promise<void> {
    const { product } = event.detail;
    if (!product) return;
    
    // Find the index of the target product
    const targetIndex = this.findProductIndex(product.slug || product.id);
    if (targetIndex === -1) {
      // Product not found in loaded products, try to load it
      await this.loadFullProduct(product.slug || product.id);
      return;
    }
    
    // Update our position
    this.currentProductIndex = targetIndex;
    
    // Calculate which page this product is on
    const pageSize = this.limit || 12;
    const targetPage = Math.floor(targetIndex / pageSize) + 1;
    
    // Update URL with product and page
    if (this.isPrimary) {
      // The hash change will trigger updateViewFromState -> showProductBySlug -> loadFullProduct
      this.hashRouter.navigateToProduct(product.slug || product.id, false, { page: targetPage });
    } else {
      // Non-primary instances need to load the product directly
      this.currentView = 'product';
      this.currentProductSlug = product.slug || product.id;
      await this.loadFullProduct(product.slug || product.id);
    }
    
    // Ensure adjacent products are loaded for smooth navigation
    await this.ensureProductLoaded(targetIndex);
  }

  private renderPagination(): TemplateResult {
    const maxVisible = LIMITS.MAX_PAGINATION_BUTTONS; // Max number of page buttons to show
    
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
    
    if (this.isPrimary) {
      // Update URL hash with page number - this will trigger updateViewFromState
      // DON'T update currentPage here, let updateViewFromState handle it
      this.hashRouter.updateCatalogState({ page });
      // The hash change will handle loading and scrolling
    } else {
      // Non-primary instances load directly
      this.currentPage = page;
      await this.loadProducts(page);
      this.scrollToTop();
    }
  }

  private async showProductDetail(product: Product): Promise<void> {
    const productSlug = product.slug || product.id;

    this.currentProductSlug = productSlug;

    // Lazy load ProductDetail component if not already registered
    if (!customElements.get('shoprocket-product')) {
      const { ProductDetail } = await import('./product-detail');
      customElements.define('shoprocket-product', ProductDetail);
    }

    // Calculate which page this product is on
    const pageSize = this.limit || 12;
    const targetPage = Math.floor(this.currentProductIndex / pageSize) + 1;

    if (this.isPrimary) {
      // Primary instance updates URL - this will trigger updateViewFromState -> showProductBySlug -> loadFullProduct
      this.hashRouter.navigateToProduct(productSlug, false, { page: targetPage });
    } else {
      // Non-primary instances need to load the product directly
      this.currentView = 'product';
      this.savedScrollPosition = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
      await this.loadFullProduct(productSlug);
    }

    // Ensure adjacent products are loaded
    this.ensureProductLoaded(this.currentProductIndex);
  }

  private async showProductBySlug(productSlug: string): Promise<void> {
    // Save current scroll position
    this.savedScrollPosition = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;

    // Lazy load ProductDetail component if not already registered
    if (!customElements.get('shoprocket-product')) {
      const { ProductDetail } = await import('./product-detail');
      customElements.define('shoprocket-product', ProductDetail);
    }

    // Only update if not already set (to avoid triggering re-renders)
    if (this.currentProductSlug !== productSlug) {
      this.currentProductSlug = productSlug;
    }
    if (this.currentView !== 'product') {
      this.currentView = 'product';
    }

    // Try to find the product in our loaded products
    let targetIndex = this.findProductIndex(productSlug);

    // Check if we already have the full product details
    const existingProduct = targetIndex !== -1 ? this.allProducts.get(targetIndex) : undefined;
    const hasFullDetails = existingProduct && existingProduct.description !== undefined;

    // Only load full product if we don't have it or it's missing details
    if (!hasFullDetails) {
      await this.loadFullProduct(productSlug);

      // If it wasn't in our list before, find its index now
      if (targetIndex === -1) {
        targetIndex = this.findProductIndex(productSlug);
      }
    }

    // If we still don't have an index, the product might be on a different page
    // In this case, we've already loaded the full product details, so just show it
    if (targetIndex !== -1) {
      this.currentProductIndex = targetIndex;
      
      // Calculate which page this product is on
      const pageSize = this.limit || 12;
      const productPage = Math.floor(targetIndex / pageSize) + 1;
      
      // Update current page if needed
      if (this.currentPage !== productPage) {
        this.currentPage = productPage;
      }
      
      // Ensure adjacent products are loaded
      await this.ensureProductLoaded(targetIndex);
    } else {
      // Product loaded but not in our paginated list
      // This happens when navigating directly to a product URL without page info
      // We have the full product loaded, so it will still display correctly
    }
  }
  
  private async loadFullProduct(identifier: string): Promise<void> {
    // Cancel any previous product loading
    if (this.productLoadAbortController) {
      this.productLoadAbortController.abort();
    }
    
    // Create new AbortController for this request
    this.productLoadAbortController = new AbortController();
    const signal = this.productLoadAbortController.signal;
    
    await this.withLoading('product', async () => {
      try {
        const fullProduct = await this.sdk.products.get(identifier, undefined, { signal });
        
        // Check if request was aborted
        if (signal.aborted) {
          return;
        }
        
        // Try to find which index this product should be at
        // This is tricky because we might not have the page loaded yet
        // For now, just add it to the map at a temporary position
        // and load the correct page
        
        // Find which page this product would be on based on its position in the catalog
        // This requires knowing its position, which we might not have...
        // For now, just ensure we can display it
        const productKey = fullProduct.slug || fullProduct.id;
        const existingIndex = this.findProductIndex(productKey);
        
        // Always store in individualProducts to avoid conflicts
        this.individualProducts.set(productKey, fullProduct);
        
        if (existingIndex === -1) {
          // Product not in our paginated set
          // Don't set a specific index - let getCurrentProduct find it
        } else {
          // Update the existing product with full details
          this.allProducts.set(existingIndex, fullProduct);
          this.currentProductIndex = existingIndex;
        }
        
      } catch (err: any) {
        // Don't show error if request was aborted
        if (err.name === 'AbortError') {
          return;
        }
        
        console.error('Failed to load product:', err);
        if (err.response?.status === 404 || err.status === 404) {
          this.showError('Product not found. This product may no longer be available.');
        } else {
          this.showError('Unable to load product details. Please try again later.');
        }
      }
    });
  }
  

  private async showList(): Promise<void> {
    // Cancel any in-flight product loading
    if (this.productLoadAbortController) {
      this.productLoadAbortController.abort();
    }
    
    this.currentView = 'list';
    this.currentProductSlug = undefined;
    
    // Ensure current page is loaded
    await this.loadProducts(this.currentPage);
    
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


  private async backToList(): Promise<void> {
    if (this.isPrimary) {
      // Primary instance updates URL
      this.hashRouter.navigateToList();
    } else {
      // Non-primary instances just update local state
      await this.showList();
    }
  }
  
  private scrollToTop(): void {
    requestAnimationFrame(() => {
      this.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

}