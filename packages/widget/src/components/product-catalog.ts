import { html, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { ShoprocketElement, EVENTS } from '../core/base-component';
import type { Product, ApiResponse } from '@shoprocket/core';
import type { Category } from '@shoprocket/core';
import { HashRouter, type HashState } from '../core/hash-router';
import { ProductListTemplates } from './product-list';
import { LIMITS, TIMEOUTS, WIDGET_EVENTS } from '../constants';
import { injectProductSchema, removeProductSchema } from '../utils/structured-data';
import './catalog-filters'; // Register filter component

/**
 * Product Catalog Component - Displays a grid of products with pagination
 * 
 * @element shoprocket-catalog
 * @fires navigate-product - When a product is selected for viewing
 * @fires back-to-list - When returning from product detail view
 * 
 * @attr {string} data-shoprocket - Must be "catalog" to initialize this component
 * @attr {string} [data-store-id] - Store ID for loading products (if not using global config)
 *
 * Configuration properties (passed via embed config):
 * @property {string} [filterMode='all'] - Display mode: 'all' | 'categories' | 'products'
 * @property {string} [categories=''] - Category slug(s) or ID(s) - comma-separated (used with filterMode='categories')
 * @property {string} [products=''] - Product slug(s) or ID(s) - comma-separated (used with filterMode='products')
 * @property {number} [limit=12] - Number of products per page
 * @property {boolean} [routable=false] - Enable URL hash synchronization for this catalog
 * @property {string[]} [features] - Array of features to enable
 * 
 * @example
 * <!-- Basic product catalog (via embed ID - shows all products) -->
 * <div data-shoprocket-embed="embed_catalog_abc123"></div>
 *
 * @example
 * Configuration structure (set in dashboard):
 * {
 *   filterMode: 'all',        // Show all products
 *   categories: '',            // Not used in 'all' mode
 *   products: '',              // Not used in 'all' mode
 *   limit: 12,
 *   columns: 4,
 *   features: ['media', 'title', 'price', 'add-to-cart', 'filters']
 * }
 *
 * @example
 * Configuration for category mode:
 * {
 *   filterMode: 'categories',
 *   categories: 't-shirts,shoes',  // Comma-separated slugs or IDs
 *   limit: 8
 * }
 *
 * @example
 * Configuration for products mode (curated list):
 * {
 *   filterMode: 'products',
 *   products: 'prod_123,prod_456,prod_789',  // Comma-separated slugs or IDs
 *   limit: 12
 * }
 */
export class ProductCatalog extends ShoprocketElement {
  // Use Light DOM when embedded in other widgets to avoid nested shadow DOM
  protected override createRenderRoot(): HTMLElement | ShadowRoot {
    if (this.useLightDom) {
      return this; // Light DOM
    }
    return super.createRenderRoot(); // Shadow DOM (default)
  }

  // Only the first catalog (primary) handles URL routing
  private static primaryInstance: ProductCatalog | null = null;
  private isPrimary = false;

  // We still need to read attributes to pass to children
  @property({ type: String, attribute: 'store-id' })
  storeId?: string;

  @property({ type: String, attribute: 'filter-mode' })
  filterMode?: 'all' | 'categories' | 'products';

  @property({ type: String })
  categories?: string;

  @property({ type: String })
  products?: string;

  @property({ type: Number, attribute: 'data-limit' })
  limit?: number;

  @property({ type: Boolean, attribute: 'data-routable' })
  routable = false;

  @property({ type: String, attribute: 'data-embed-id' })
  embedId?: string;

  @property({ type: Boolean, attribute: 'data-use-light-dom' })
  useLightDom = false;

  @property({ type: String, attribute: 'data-filter-position' })
  filterPosition: 'top' | 'left' = 'top';

  // Grid columns for different breakpoints
  private _columns?: number;
  private _columnsMd?: number;
  private _columnsSm?: number;

  @property({ type: Number })
  set columns(value: number | undefined) {
    this._columns = value;
    if (value) {
      this.style.setProperty('--cols', String(value));
    }
  }
  get columns(): number | undefined {
    return this._columns;
  }

  @property({ type: Number })
  set columnsMd(value: number | undefined) {
    this._columnsMd = value;
    if (value) {
      this.style.setProperty('--cols-md', String(value));
    }
  }
  get columnsMd(): number | undefined {
    return this._columnsMd;
  }

  @property({ type: Number })
  set columnsSm(value: number | undefined) {
    this._columnsSm = value;
    if (value) {
      this.style.setProperty('--cols-sm', String(value));
    }
  }
  get columnsSm(): number | undefined {
    return this._columnsSm;
  }

  @state()
  private currentView: 'list' | 'product' = 'list';

  // Filter state
  @state()
  private searchQuery = '';

  @state()
  private sortBy = '';

  @state()
  private selectedCategory = '';

  @state()
  private allCategories: Category[] = [];

  @state()
  private minPrice?: number;

  @state()
  private maxPrice?: number;

  @state()
  private inStockOnly = false;

  @state()
  private priceRangeMin = 0;

  @state()
  private priceRangeMax = 500; // Reasonable default for most stores

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
  private actualPageSize = 0; // Actual page size used by API (for consistent index calculations)

  @state()
  private perPage = LIMITS.DEFAULT_PER_PAGE; // User-selectable products per page

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

  // Track products with injected schemas for cleanup
  private productsWithSchemas: Set<string> = new Set();

  private handleHashStateChange = async (event: Event): Promise<void> => {
    const customEvent = event as CustomEvent<HashState>;
    const state = customEvent.detail;

    // Filtering is now done in updateViewFromState (handles both initial load and hash changes)
    await this.updateViewFromState(state);
  };

  private async updateViewFromState(state: HashState): Promise<void> {
    // Only primary catalog responds to hash changes
    // Secondary catalogs ignore URL routing and work with local state only
    if (!this.isPrimary) {
      return;
    }

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
        // Don't auto-scroll on hash changes - only scroll when user clicks pagination
        // this prevents unwanted scrolling when multiple catalogs are on the page
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
          item_list_name: this.categories || 'All Products',
          item_list_id: `page_${this.currentPage}`
        });
        this.currentTrackedPage = this.currentPage;
      }
    }

    // Note: view_item tracking is handled by the product-detail component itself
  }

  /**
   * Public method to reload the catalog with fresh data
   * Clears all cached pages and reloads from page 1
   */
  public async reload(): Promise<void> {
    // Clean up all schemas before reloading
    this.productsWithSchemas.forEach(productId => {
      removeProductSchema(productId);
    });
    this.productsWithSchemas.clear();

    this.loadedPages.clear();
    this.loadingPages.clear();
    this.allProducts.clear();
    this.individualProducts.clear();
    this.currentPage = 1;
    this.actualPageSize = 0; // Reset page size so it's recalculated from API
    await this.loadProducts(1);
  }

  /**
   * Clean up schemas from a specific page
   */
  private cleanupOldPageSchemas(page: number): void {
    const pageSize = this.actualPageSize || this.perPage;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;

    // Find products on the old page
    for (let i = startIndex; i < endIndex; i++) {
      const product = this.allProducts.get(i);
      if (product && this.productsWithSchemas.has(product.id)) {
        removeProductSchema(product.id);
        this.productsWithSchemas.delete(product.id);
      }
    }
  }

  /**
   * Calculate price range from loaded products
   */
  private updatePriceRange(): void {
    if (this.allProducts.size === 0) {
      this.priceRangeMin = 0;
      this.priceRangeMax = 100;
      return;
    }

    let min = Infinity;
    let max = 0;

    for (const product of this.allProducts.values()) {
      // Get price value - API returns prices in cents
      let priceInCents: number;
      if (typeof product.price === 'number') {
        priceInCents = product.price;
      } else if (product.price && typeof product.price === 'object' && 'amount' in product.price) {
        // API returns amount in cents (e.g., 9800 = £98.00)
        priceInCents = product.price.amount;
      } else {
        continue; // Skip products without valid price
      }

      if (priceInCents < min) min = priceInCents;
      if (priceInCents > max) max = priceInCents;
    }

    // Convert cents to main currency units (pounds/dollars)
    const minPrice = min / 100;
    const maxPrice = max / 100;

    // Round to nice numbers
    this.priceRangeMin = Math.floor(minPrice);

    // Pad the max by 20% to account for products not yet loaded, with min increment of 50
    const paddedMax = Math.ceil(maxPrice * 1.2);
    this.priceRangeMax = Math.max(paddedMax, this.priceRangeMin + 50);

    // Round max to nearest nice number for better UX
    if (this.priceRangeMax > 100) {
      this.priceRangeMax = Math.ceil(this.priceRangeMax / 50) * 50; // Round to nearest 50
    } else if (this.priceRangeMax > 20) {
      this.priceRangeMax = Math.ceil(this.priceRangeMax / 10) * 10; // Round to nearest 10
    }
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
        // Build category parameter
        let categoryParam: string | string[] | undefined;
        let productsParam: string | string[] | undefined;

        // Handle filterMode-based filtering
        if (this.filterMode === 'products' && this.products) {
          // Mode: products - filter to specific product IDs/slugs
          const productIds = this.products.split(',').map(p => p.trim()).filter(p => p);
          productsParam = productIds.length === 1 ? productIds[0] : productIds;

          // Also apply category filter if user selected one from dropdown
          if (this.selectedCategory) {
            categoryParam = this.selectedCategory;
          }
        } else if (this.filterMode === 'categories' && this.categories) {
          // Mode: categories - filter to specific categories
          if (this.selectedCategory) {
            // User selected a specific category from the filter dropdown
            categoryParam = this.selectedCategory;
          } else {
            // Use categories from config
            const slugs = this.categories.split(',').map(c => c.trim()).filter(c => c);
            if (slugs.length > 0) {
              categoryParam = slugs.length === 1 ? slugs[0] : slugs;
            }
          }
        } else if (this.selectedCategory) {
          // Legacy: no filterMode but user selected category from dropdown
          categoryParam = this.selectedCategory;
        }
        // If filterMode='all' or no filterMode → undefined (all products)

        const response = await this.sdk.products.list({
          page,
          perPage: this.perPage,
          category: categoryParam,
          products: productsParam,
          search: this.searchQuery || undefined,
          sort: this.sortBy || undefined,
          minPrice: this.minPrice,
          maxPrice: this.maxPrice,
          inStock: this.inStockOnly || undefined,
          include: this.filterMode === 'products' ? 'categories' : undefined,
        }) as ApiResponse<Product[]>;

        const products = response.data || [];
        const pageSize = this.perPage;

        // Store products by their absolute position in the full list
        products.forEach((product, index) => {
          const absoluteIndex = (page - 1) * pageSize + index;
          this.allProducts.set(absoluteIndex, product);
        });

        // For products mode, derive categories from loaded products (only on initial load, not when filtered)
        if (this.filterMode === 'products' && page === 1 && !this.selectedCategory && this.allCategories.length === 0) {
          await this.deriveCategoriesFromProducts();
        }

        // Only calculate price range on first load to get a reasonable estimate
        // Don't update it afterward as it would only reflect loaded pages
        if (page === 1 && this.priceRangeMax === 500) {
          this.updatePriceRange();
        }

        // Mark this page as loaded
        this.loadedPages.add(page);

        // Update page BEFORE injecting schemas
        const previousPage = this.currentPage;
        this.currentPage = page;

        // Clean up schemas from previous page if changing pages
        if (previousPage !== page && previousPage > 0) {
          this.cleanupOldPageSchemas(previousPage);
        }

        // Inject JSON-LD structured data for current page products
        products.forEach(product => {
          injectProductSchema(product, this.sdk, this.sdk.store);
          this.productsWithSchemas.add(product.id);
        });
        
        // Update pagination info from API response
        if (response.meta) {
          const meta = response.meta as any;
          if (meta.total && meta.perPage) {
            this.totalPages = Math.ceil(meta.total / meta.perPage);
            this.totalProducts = meta.total;
            this.actualPageSize = meta.perPage; // Store actual page size for consistent index calculations
          } else if (response.meta?.pagination) {
            this.totalPages = response.meta.pagination.totalPages;
            this.totalProducts = response.meta.pagination.total || 0;
            // Fallback: calculate page size from total and pages
            this.actualPageSize = this.totalPages > 0 ? Math.ceil(this.totalProducts / this.totalPages) : this.perPage;
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

  /**
   * Load categories for filter dropdown
   */
  private async loadCategories(): Promise<void> {
    try {
      if (this.filterMode === 'products') {
        // For products mode, categories will be derived from loaded products
        // This happens in loadProducts() after products are fetched
        this.allCategories = [];
      } else if (this.filterMode === 'categories' && this.categories) {
        // Load specific categories from config
        const categoryValues = this.categories.split(',').map(c => c.trim()).filter(c => c);
        if (categoryValues.length > 0) {
          // Detect if we have IDs (start with cat_) or slugs
          const isId = categoryValues[0].startsWith('cat_');
          const response = await this.sdk.categories.list({
            filter: isId ? { id: categoryValues } : { slug: categoryValues },
          });
          this.allCategories = response.data || [];
        }
      } else {
        // Load all root categories if filterMode='all' or no filterMode
        const response = await this.sdk.categories.list({
          filter: { isRoot: true },
        });
        this.allCategories = response.data || [];
      }
    } catch (error) {
      console.warn('Failed to load categories:', error);
      this.allCategories = [];
    }
  }

  /**
   * Derive categories from loaded products (for products mode)
   */
  private async deriveCategoriesFromProducts(): Promise<void> {
    try {
      // Extract unique category IDs from all loaded products
      const categoryIds = new Set<string>();
      const categoryMap = new Map<string, { id: string; slug: string; name: string }>();

      this.allProducts.forEach(product => {
        if (product.categories && Array.isArray(product.categories)) {
          product.categories.forEach(category => {
            categoryIds.add(category.id);
            categoryMap.set(category.id, category);
          });
        }
      });

      if (categoryIds.size === 0) {
        this.allCategories = [];
        return;
      }

      // We already have the category data from the API response, just convert to Category[] format
      this.allCategories = Array.from(categoryMap.values()).map(cat => ({
        id: cat.id,
        slug: cat.slug,
        name: cat.name,
        description: null,
        status: 'published',
        parentId: null,
        level: 0,
        sortOrder: 0,
        productsCount: 0,
        imageUrl: null,
        metaTitle: null,
        metaDescription: null,
        createdAt: '',
        updatedAt: ''
      }));
    } catch (error) {
      console.warn('Failed to derive categories from products:', error);
      this.allCategories = [];
    }
  }

  private perPageInitialized = false;

  override willUpdate(changedProperties: Map<string, any>): void {
    // Initialize perPage when limit property changes or on first update
    // This ensures skeletons show the correct count immediately
    if (!this.perPageInitialized || changedProperties.has('limit')) {
      const storedPerPage = localStorage.getItem('shoprocket_per_page');
      if (storedPerPage) {
        const parsed = parseInt(storedPerPage, 10);
        if (parsed > 0) {
          this.perPage = parsed;
        }
      } else if (this.limit && this.limit > 0) {
        // If merchant set data-limit and no localStorage, use that as the default
        this.perPage = this.limit;
      }
      this.perPageInitialized = true;
    }
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

    // Determine if this is the primary catalog (handles URL routing)
    // Check data-is-primary attribute set by widget manager (ensures DOM order)
    if (!this.useLightDom) {
      const isPrimaryAttr = this.getAttribute('data-is-primary');
      if (isPrimaryAttr === 'true') {
        ProductCatalog.primaryInstance = this;
        this.isPrimary = true;
      }
    }
    
    // Load categories for filter (if filters feature enabled)
    // Skip if using light DOM - parent widget manages categories
    if (this.hasFeature('filters') && !this.useLightDom) {
      await this.loadCategories();
    }

    // Initialize hash router for URL management (primary catalog only)
    if (this.isPrimary) {
      // Get HashRouter singleton
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
    } else {
      // Secondary catalogs: just load first page
      await this.loadProducts(this.currentPage);
    }
  }
  
  override disconnectedCallback(): void {
    super.disconnectedCallback();

    // Cancel any in-flight product loading
    if (this.productLoadAbortController) {
      this.productLoadAbortController.abort();
    }

    // Clean up JSON-LD schemas
    this.productsWithSchemas.forEach(productId => {
      removeProductSchema(productId);
    });
    this.productsWithSchemas.clear();

    window.removeEventListener(WIDGET_EVENTS.PRODUCT_ADDED, this.handleProductAdded as EventListener);
    window.removeEventListener(WIDGET_EVENTS.CART_LOADED, this.handleCartUpdate as EventListener);
    window.removeEventListener(WIDGET_EVENTS.CART_UPDATED, this.handleCartUpdate as EventListener);

    // Clean up hash router listener (primary catalog only)
    if (this.hashRouter) {
      this.hashRouter.removeEventListener('state-change', this.handleHashStateChange);
    }

    // Clean up primary instance reference if this was primary
    if (this.isPrimary && ProductCatalog.primaryInstance === this) {
      ProductCatalog.primaryInstance = null;
    }
  }

  protected override render(): TemplateResult {
    // Clear reserved min-height immediately on first render (prevents CLS)
    // Don't wait for data to load - clear the space reservation right away
    if (!this.hasAttribute('data-loaded')) {
      this.style.minHeight = ''; // Clear inline style from loader
      this.setAttribute('data-loaded', 'true');
    }

    const pageProducts = this.getPageProducts();
    // Only use sidebar layout if filters are enabled AND position is left
    const layoutMode = this.hasFeature('filters') && this.filterPosition === 'left' ? 'sidebar' : 'horizontal';

    return html`
      <div class="sr-catalog-list-view ${this.currentView === 'list' ? 'visible' : 'hidden'}"
           data-layout="${layoutMode}">
        ${this.hasFeature('filters') ? html`
          <shoprocket-catalog-filters
            .search="${this.searchQuery}"
            .sort="${this.sortBy}"
            .category="${this.selectedCategory}"
            .categories="${this.allCategories}"
            .filterPosition="${this.filterPosition}"
            .totalProducts="${this.totalProducts}"
            .minPrice="${this.minPrice}"
            .maxPrice="${this.maxPrice}"
            .priceRangeMin="${this.priceRangeMin}"
            .priceRangeMax="${this.priceRangeMax}"
            .inStockOnly="${this.inStockOnly}"
            .perPage="${this.perPage}"
            .perPageOptions="${this.getPerPageOptions()}"
            @filter-change="${this.handleFilterChange}"
          ></shoprocket-catalog-filters>
        ` : ''}
        <div class="sr-catalog-content">
          ${ProductListTemplates.renderProductList(
            pageProducts,
            this.loadedPages.size === 0 || this.isLoading('products'),
            this.perPage,
            this.errorMessage,
            this.successMessage,
            this.addedToCartProducts,
            this.getFeatures(),
            this.hasFeature('product-detail'),
            {
              handleProductClick: (product) => this.handleProductClick(product),
              handleAddToCart: (product) => this.handleAddToCart(product),
              formatPrice: (price) => this.formatPrice(price),
              getMediaUrl: (media) => this.getMediaUrl(media),
              getMediaSrcSet: (media) => this.getMediaSrcSet(media),
              handleImageError: (e) => this.handleImageError(e),
              isLoadingItem: (key) => this.isLoading(key),
              sdk: this.sdk
            }
          )}
          ${this.currentView === 'list' && this.totalPages > 1 ? this.renderPagination() : ''}
        </div>
      </div>
      ${this.currentView === 'product' ? html`
        <shoprocket-product
          .sdk="${this.sdk}"
          .product="${this.getCurrentProduct()}"
          .prevProduct="${this.getPrevProduct()}"
          .nextProduct="${this.getNextProduct()}"
          product-slug="${this.currentProductSlug || ''}"
          data-features="${this.getDetailFeatures().join(',')}"
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
      category: this.categories
    });

    // Find the product index for prev/next calculation
    const targetIndex = this.findProductIndex(product.slug || product.id);
    if (targetIndex === -1) {
      console.error('Product not found in loaded products');
      return;
    }

    // If using Light DOM (embedded in another widget), dispatch event
    // so parent can handle everything (URL routing + product display)
    if (this.useLightDom) {
      // Calculate prev/next products for parent widget to use
      const prevProduct = targetIndex > 0 ? this.allProducts.get(targetIndex - 1) || null : null;
      const nextProduct = targetIndex < this.totalProducts - 1 ? this.allProducts.get(targetIndex + 1) || null : null;

      // Convert Map to array for caching in parent widget
      const allProducts = Array.from(this.allProducts.values());

      this.dispatchEvent(new CustomEvent('product-click', {
        detail: { product, prevProduct, nextProduct, allProducts },
        bubbles: true,
        composed: true,
      }));
      return; // Parent handles product display
    }

    // All Shadow DOM instances handle their own product display
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

  private handleFilterChange = async (event: CustomEvent): Promise<void> => {
    const { filterType, value } = event.detail;

    // Update filter state
    switch (filterType) {
      case 'search':
        this.searchQuery = value;
        break;
      case 'sort':
        this.sortBy = value;
        break;
      case 'category':
        this.selectedCategory = value;
        break;
      case 'priceRange': {
        // Handle combined price range update (avoids race conditions from separate min/max events)
        const priceRange = JSON.parse(value);
        this.minPrice = priceRange.min ? parseFloat(priceRange.min) : undefined;
        this.maxPrice = priceRange.max ? parseFloat(priceRange.max) : undefined;
        break;
      }
      case 'minPrice':
        this.minPrice = value ? parseFloat(value) : undefined;
        break;
      case 'maxPrice':
        this.maxPrice = value ? parseFloat(value) : undefined;
        break;
      case 'inStockOnly':
        this.inStockOnly = value === 'true';
        break;
      case 'perPage': {
        const newPerPage = parseInt(value, 10);
        if (newPerPage !== this.perPage) {
          this.perPage = newPerPage;
          // Save to localStorage for future visits
          localStorage.setItem('shoprocket_per_page', newPerPage.toString());
        }
        break;
      }
    }

    // Reload products with new filters
    await this.reload();
  }

  private handleCartUpdate = (): void => {
    // Just trigger a re-render when cart updates
    // The product list will check cart state during render
    this.requestUpdate();
  }
  
  private async handleAddToCart(product: Product): Promise<void> {
    // Check if product needs options selected
    if (!product.quickAddEligible || !product.defaultVariantId) {
      // Show product detail view
      this.handleProductClick(product);
      return;
    }

    // Prepare cart item data for optimistic update
    const cartItemData = {
      productId: product.id,
      productName: product.name,
      variantId: product.defaultVariantId,
      variantName: undefined, // No variant text for default variant
      quantity: 1,
      price: product.price, // Already in correct format from API
      media: product.media?.[0] ? [product.media[0]] : undefined,
      source_url: window.location.href
    };

    // Include stock info for validation
    const stockInfo = {
      track_inventory: product.trackInventory ?? true, // Default to true if not specified
      available_quantity: product.inventoryCount ?? 0
    };

    // Dispatch event to cart component - it will handle everything
    window.dispatchEvent(new CustomEvent(WIDGET_EVENTS.CART_ADD_ITEM, {
      detail: { item: cartItemData, stockInfo }
    }));
  }
  
  /**
   * Extract detail: prefixed features for product detail view
   * Strips the 'detail:' prefix and returns clean feature names
   */
  private getDetailFeatures(): string[] {
    const allFeatures = this.getFeatures();
    return allFeatures
      .filter(f => f.startsWith('detail:'))
      .map(f => f.replace('detail:', ''));
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
  
  // Get available per-page options, including custom limit if set
  private getPerPageOptions(): readonly number[] {
    const options = [...LIMITS.PER_PAGE_OPTIONS];

    // If merchant set a custom data-limit, always include it as an option
    if (this.limit && !options.includes(this.limit)) {
      options.push(this.limit);
    }

    // If current perPage is not in the options (from localStorage), add it too
    if (!options.includes(this.perPage)) {
      options.push(this.perPage);
    }

    // Sort numerically
    options.sort((a, b) => a - b);

    return options;
  }

  // Get products for the current page view
  private getPageProducts(): Product[] {
    // Use actualPageSize if set (from API response), otherwise fall back to perPage
    const pageSize = this.actualPageSize || this.perPage;
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
    const pageSize = this.actualPageSize || this.perPage;
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
    const pageSize = this.actualPageSize || this.perPage;
    const targetPage = Math.floor(targetIndex / pageSize) + 1;

    // Navigate to product
    if (this.isPrimary) {
      // Primary catalog: Update URL (hash change will trigger product load)
      this.hashRouter.navigateToProduct(product.slug || product.id, false, { page: targetPage });
      // Scroll to top of this catalog immediately
      this.scrollToTop();
    } else if (this.useLightDom) {
      // Light DOM catalog (embedded in parent widget): Dispatch event for parent to handle
      const prevProduct = targetIndex > 0 ? this.allProducts.get(targetIndex - 1) || null : null;
      const nextProduct = targetIndex < this.totalProducts - 1 ? this.allProducts.get(targetIndex + 1) || null : null;
      const allProducts = Array.from(this.allProducts.values());

      this.dispatchEvent(new CustomEvent('product-click', {
        detail: { product, prevProduct, nextProduct, allProducts },
        bubbles: true,
        composed: true,
      }));
      return; // Parent handles navigation
    } else {
      // Secondary Shadow DOM catalog: Navigate locally without URL updates
      await this.showProductBySlug(product.slug || product.id);
      // Scroll to top of this catalog
      this.scrollToTop();
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

    const isDisabled = (page: number) => {
      return this.isLoading('products') || page === this.currentPage;
    };

    return html`
      <div class="sr-pagination">
        <a
          href="#?page=${this.currentPage - 1}"
          class="sr-pagination-button sr-pagination-prev ${this.currentPage === 1 || this.isLoading('products') ? 'disabled' : ''}"
          aria-disabled="${this.currentPage === 1 || this.isLoading('products')}"
          @click="${(e: MouseEvent) => {
            e.preventDefault();
            if (this.currentPage > 1 && !this.isLoading('products')) {
              this.goToPage(this.currentPage - 1);
            }
          }}"
        >
          ← Previous
        </a>

        <div class="sr-pagination-pages">
          ${startPage > 1 ? html`
            <a
              href="#?page=1"
              class="sr-pagination-button sr-pagination-page"
              @click="${(e: MouseEvent) => {
                e.preventDefault();
                this.goToPage(1);
              }}"
            >1</a>
            ${startPage > 2 ? html`<span class="sr-pagination-ellipsis">...</span>` : ''}
          ` : ''}

          ${Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i).map(page => html`
            <a
              href="#?page=${page}"
              class="sr-pagination-button sr-pagination-page ${page === this.currentPage ? 'active' : ''} ${isDisabled(page) ? 'disabled' : ''}"
              aria-disabled="${isDisabled(page)}"
              aria-current="${page === this.currentPage ? 'page' : 'false'}"
              @click="${(e: MouseEvent) => {
                e.preventDefault();
                if (page !== this.currentPage && !this.isLoading('products')) {
                  this.goToPage(page);
                }
              }}"
            >${page}</a>
          `)}

          ${endPage < this.totalPages ? html`
            ${endPage < this.totalPages - 1 ? html`<span class="sr-pagination-ellipsis">...</span>` : ''}
            <a
              href="#?page=${this.totalPages}"
              class="sr-pagination-button sr-pagination-page"
              @click="${(e: MouseEvent) => {
                e.preventDefault();
                this.goToPage(this.totalPages);
              }}"
            >${this.totalPages}</a>
          ` : ''}
        </div>

        <a
          href="#?page=${this.currentPage + 1}"
          class="sr-pagination-button sr-pagination-next ${this.currentPage === this.totalPages || this.isLoading('products') ? 'disabled' : ''}"
          aria-disabled="${this.currentPage === this.totalPages || this.isLoading('products')}"
          @click="${(e: MouseEvent) => {
            e.preventDefault();
            if (this.currentPage < this.totalPages && !this.isLoading('products')) {
              this.goToPage(this.currentPage + 1);
            }
          }}"
        >
          Next →
        </a>
      </div>
    `;
  }
  
  private async goToPage(page: number): Promise<void> {
    if (page < 1 || page > this.totalPages || page === this.currentPage) return;

    // Update URL (primary catalog only)
    if (this.isPrimary) {
      // DON'T update currentPage here, let updateViewFromState handle it
      this.hashRouter.updateCatalogState({ page });
      // Scroll to top of this catalog immediately (don't wait for hash change)
      this.scrollToTop();
    } else {
      // Secondary catalogs: load directly without URL updates
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
      try {
        const { ProductDetail } = await import('./product-detail');
        customElements.define('shoprocket-product', ProductDetail);
      } catch (err) {
        // Element may have been defined by another component in a race condition
        if (!(err instanceof DOMException && err.name === 'NotSupportedError')) {
          throw err;
        }
      }
    }

    // Wait for element to be fully defined before rendering
    await customElements.whenDefined('shoprocket-product');

    // Calculate which page this product is on
    const pageSize = this.actualPageSize || this.perPage;
    const targetPage = Math.floor(this.currentProductIndex / pageSize) + 1;

    // Update URL (primary catalog only)
    if (this.isPrimary) {
      this.hashRouter.navigateToProduct(productSlug, false, { page: targetPage });
      // Scroll to top of this catalog immediately
      this.scrollToTop();
    } else {
      // Secondary catalogs: local state only, no URL updates
      this.currentView = 'product';
      this.savedScrollPosition = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
      await this.loadFullProduct(productSlug);
      // Scroll to top of this catalog
      this.scrollToTop();
    }

    // Ensure adjacent products are loaded
    this.ensureProductLoaded(this.currentProductIndex);
  }

  private async showProductBySlug(productSlug: string): Promise<void> {
    // Save current scroll position
    this.savedScrollPosition = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;

    // Lazy load ProductDetail component if not already registered
    if (!customElements.get('shoprocket-product')) {
      try {
        const { ProductDetail } = await import('./product-detail');
        customElements.define('shoprocket-product', ProductDetail);
      } catch (err) {
        // Element may have been defined by another component in a race condition
        if (!(err instanceof DOMException && err.name === 'NotSupportedError')) {
          throw err;
        }
      }
    }

    // Wait for element to be fully defined before rendering
    await customElements.whenDefined('shoprocket-product');

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
      const pageSize = this.actualPageSize || this.perPage;
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
    // Update URL (primary catalog only)
    if (this.isPrimary) {
      this.hashRouter.navigateToList(true);
      // Scroll to top of this catalog
      this.scrollToTop();
    } else {
      // Secondary catalogs: just update local state
      await this.showList();
      // Scroll to top of this catalog
      this.scrollToTop();
    }
  }
  
  private scrollToTop(): void {
    requestAnimationFrame(() => {
      this.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

}