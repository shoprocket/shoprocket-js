import { html, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { ShoprocketElement } from '../core/base-component';
import type { Product } from '../types/api';
import { TIMEOUTS } from '../constants';
import { getMediaSizes } from '../utils/formatters';

// Import Category type from core
import type { Category } from '@shoprocket/core';

interface NavigationItem {
  type: 'root' | 'category';
  category?: Category;
}

/**
 * Categories Widget - Displays categories in a grid with drill-down navigation
 *
 * @element shoprocket-categories
 * @fires category-click - When a category is clicked
 *
 * @attr {string} [data-categories] - Comma-separated category IDs/slugs to display
 * @attr {number} [data-columns=3] - Number of columns in grid
 * @attr {boolean} [data-show-images=true] - Show category images
 * @attr {boolean} [data-show-counts=true] - Show product counts
 * @attr {boolean} [data-show-description=true] - Show category descriptions
 * @attr {number} [data-limit=12] - Products per page when showing products
 *
 * @example
 * <!-- Show all root categories -->
 * <div data-shoprocket="categories"></div>
 *
 * @example
 * <!-- Show specific categories -->
 * <div data-shoprocket="categories"
 *      data-categories="clothing,accessories">
 * </div>
 */
export class CategoriesWidget extends ShoprocketElement {
  // Track active widget for routing (only the active widget responds to hash changes)
  private static activeWidget: CategoriesWidget | null = null;

  // Configuration
  @property({ type: String, attribute: 'data-categories' }) categories?: string;
  @property({ type: Number, attribute: 'data-columns' }) columns = 3;
  @property({
    attribute: 'data-show-images',
    converter: (value) => value !== 'false'
  }) showImages = true;
  @property({
    attribute: 'data-show-counts',
    converter: (value) => value !== 'false'
  }) showCounts = true;
  @property({
    attribute: 'data-show-description',
    converter: (value) => value !== 'false'
  }) showDescription = true;
  @property({ type: Number, attribute: 'data-limit' }) limit = 12;

  // State
  @state() private currentView: 'categories' | 'products' | 'product-detail' = 'categories';
  @state() private currentCategories: Category[] = [];
  @state() private currentProduct?: Product;
  @state() private prevProduct?: Product | null;
  @state() private nextProduct?: Product | null;
  @state() private navigationStack: NavigationItem[] = [{ type: 'root' }];
  @state() private loading = false;
  @state() private loadingProduct = false;
  @state() private cachedProducts: Product[] = []; // Cache products list for navigation

  override connectedCallback(): void {
    super.connectedCallback();

    // Always enable routing - namespace filtering prevents conflicts
    window.addEventListener('hashchange', this.handleHashChange);

    // Sync with current URL on mount
    this.syncWithUrl();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('hashchange', this.handleHashChange);

    // Clear active widget reference if this widget is being removed
    if (CategoriesWidget.activeWidget === this) {
      CategoriesWidget.activeWidget = null;
    }
  }

  /**
   * Handle URL hash changes
   */
  private handleHashChange = () => {
    // Only sync if the hash is relevant to categories
    // This prevents conflicts with other widgets (like catalog) on the same page
    const hash = window.location.hash;

    // Only handle hashes that start with #!/categories/
    // Ignore everything else - it's for another widget (catalog, payment, etc.)
    if (!hash.startsWith('#!/categories/')) {
      return;
    }

    // Check if there's an active widget and if it's not us, ignore this change
    // This allows multiple category widgets on the same page to work independently
    const activeWidget = CategoriesWidget.activeWidget;

    if (activeWidget && activeWidget !== this) {
      // Another widget is active - ignore this hash change
      return;
    }

    // No active widget yet (page load) - become the active widget
    if (!activeWidget) {
      CategoriesWidget.activeWidget = this;
    }

    // We're the active widget, so sync with the URL
    this.syncWithUrl();
  };

  /**
   * Parse route from hash
   * Formats:
   * - #!/categories/cat_123
   * - #!/categories/cat_123/product/prod_slug
   */
  private parseRouteFromHash(): { categoryId: string | null; productSlug: string | null } {
    const hash = window.location.hash;

    // Check for product within category: #!/categories/{cat}/product/{slug}
    const productMatch = hash.match(/^#!\/categories\/([^/]+)\/product\/([^/]+)/);
    if (productMatch) {
      return {
        categoryId: productMatch[1] || null,
        productSlug: productMatch[2] || null
      };
    }

    // Check for category only: #!/categories/{id}
    const categoryMatch = hash.match(/^#!\/categories\/([^/]+)/);
    if (categoryMatch) {
      return {
        categoryId: categoryMatch[1] || null,
        productSlug: null
      };
    }

    return { categoryId: null, productSlug: null };
  }

  /**
   * Sync widget state with current URL
   */
  private async syncWithUrl() {
    const { categoryId, productSlug } = this.parseRouteFromHash();

    if (productSlug && categoryId) {
      // URL has category + product - load both
      await this.loadCategoryAndProduct(categoryId, productSlug);
    } else if (categoryId) {
      // URL has category only - load it
      await this.loadCategory(categoryId);
    } else {
      // No category in URL - load initial categories
      await this.loadInitialCategories();
    }
  }

  /**
   * Load initial categories based on configuration
   */
  private async loadInitialCategories() {
    this.loading = true;

    try {
      let response;

      if (this.categories) {
        // Load specific categories by slug (API supports filtering)
        const slugs = this.categories.split(',').map(c => c.trim());
        response = await this.sdk.categories.list({
          filter: { slug: slugs },
          include: 'children',
        });
      } else {
        // Load root categories
        response = await this.sdk.categories.list({
          filter: { is_root: true },
          include: 'children',
        });
      }

      this.currentCategories = response.data || [];
      this.currentView = 'categories';
      this.navigationStack = [{ type: 'root' }];
    } catch (error) {
      console.error('Failed to load categories:', error);
      this.showError('Failed to load categories');
    } finally {
      this.loading = false;
    }
  }

  /**
   * Load a specific category by ID or slug
   */
  private async loadCategory(idOrSlug: string) {
    // Check if we're already viewing this category - if so, skip loading
    const currentCategory = this.getCurrentCategory();
    if (currentCategory && (currentCategory.id === idOrSlug || currentCategory.slug === idOrSlug)) {
      // Already viewing this category - no need to reload
      return;
    }

    this.loading = true;

    try {
      const response = await this.sdk.categories.get(idOrSlug, {
        include: 'children,parent',
      });

      const category = response.data;

      // Build navigation stack from parent data
      this.buildNavigationStack(category);

      // Show either subcategories or products
      if (this.hasChildren(category)) {
        this.currentCategories = category.children || [];
        this.currentView = 'categories';
      } else {
        // Leaf category - show products (catalog component will load them)
        // Lazy load catalog component if not already registered
        if (!customElements.get('shoprocket-catalog')) {
          try {
            const { ProductCatalog } = await import('./product-catalog');
            customElements.define('shoprocket-catalog', ProductCatalog);
          } catch (err) {
            // Ignore if element was already defined by another component (race condition)
            if (!(err instanceof DOMException && err.name === 'NotSupportedError')) {
              throw err;
            }
          }
        }

        await customElements.whenDefined('shoprocket-catalog');

        this.currentCategories = [];
        this.currentView = 'products';
      }
    } catch (error) {
      console.error('Failed to load category:', error);
      this.showError('Category not found');
    } finally {
      this.loading = false;
    }
  }

  /**
   * Build navigation stack from category parent data
   */
  private buildNavigationStack(category: Category) {
    this.navigationStack = [{ type: 'root' }];

    if (category.parent) {
      this.navigationStack.push({
        type: 'category',
        category: category.parent as any, // Parent has limited fields
      });
    }

    this.navigationStack.push({
      type: 'category',
      category: category,
    });
  }

  /**
   * Check if category has children
   */
  private hasChildren(category: Category): boolean {
    return !!(category.children && category.children.length > 0);
  }

  /**
   * Load category and specific product within it
   */
  private async loadCategoryAndProduct(categoryId: string, productSlug: string) {
    // Check if we're already viewing this exact product with navigation data
    const currentCategory = this.getCurrentCategory();
    const alreadyViewingProduct = this.currentProduct &&
      ((this.currentProduct.slug && this.currentProduct.slug === productSlug) ||
       this.currentProduct.id === productSlug) &&
      this.prevProduct !== undefined &&
      this.nextProduct !== undefined &&
      this.currentView === 'product-detail';

    if (alreadyViewingProduct) {
      // We're already viewing this exact product with nav data - nothing to do
      return;
    }

    // Match by either ID or slug
    if (currentCategory && (currentCategory.id === categoryId || currentCategory.slug === categoryId)) {
      // Already in this category, load product and calculate prev/next
      await this.loadProductWithNavigation(productSlug, currentCategory.slug || currentCategory.id);
      return;
    }

    // Different category - need to load it first
    this.loading = true;

    try {
      // Load the category first to build navigation stack
      const response = await this.sdk.categories.get(categoryId, {
        include: 'children,parent',
      });

      const category = response.data;

      // Build navigation stack from parent data
      this.buildNavigationStack(category);

      // Lazy load catalog component (for when user goes back to product list)
      if (!customElements.get('shoprocket-catalog')) {
        try {
          const { ProductCatalog } = await import('./product-catalog');
          customElements.define('shoprocket-catalog', ProductCatalog);
        } catch (err) {
          // Ignore if element was already defined by another component (race condition)
          if (!(err instanceof DOMException && err.name === 'NotSupportedError')) {
            throw err;
          }
        }
      }

      await customElements.whenDefined('shoprocket-catalog');

      // Load the specific product with navigation context
      await this.loadProductWithNavigation(productSlug, categoryId);
    } catch (error) {
      console.error('Failed to load category and product:', error);
      this.showError('Failed to load content');
    } finally {
      this.loading = false;
    }
  }

  /**
   * Load a product with prev/next navigation context
   * Only fetches products list if we don't already have prev/next data from catalog
   */
  private async loadProductWithNavigation(productSlug: string, categoryIdOrSlug: string) {
    // Lazy load product-detail component FIRST (needed for both paths)
    if (!customElements.get('shoprocket-product')) {
      try {
        const { ProductDetail } = await import('./product-detail');
        customElements.define('shoprocket-product', ProductDetail);
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'NotSupportedError')) {
          throw err;
        }
      }
    }

    await customElements.whenDefined('shoprocket-product');

    // If we already have prev/next data (from catalog click), just load the product
    const alreadyHaveNavigation = this.currentProduct &&
      ((this.currentProduct.slug && this.currentProduct.slug === productSlug) ||
       this.currentProduct.id === productSlug) &&
      (this.prevProduct !== undefined && this.nextProduct !== undefined);

    if (alreadyHaveNavigation) {
      // We already have everything we need from the catalog
      // Just ensure we have full product details if needed
      const hasFullDetails = this.currentProduct.description !== undefined;
      if (!hasFullDetails) {
        // Load full details in background while showing the product
        this.loadingProduct = true;
        try {
          const fullProduct = await this.sdk.products.get(productSlug);
          this.currentProduct = fullProduct;
        } catch (error) {
          console.error('[Categories] Failed to load full product:', error);
        } finally {
          this.loadingProduct = false;
        }
      }
      this.currentView = 'product-detail';
      return;
    }

    // We don't have prev/next data, need to calculate them
    this.loadingProduct = true;

    try {
      // Check if we already have the product (from catalog click)
      const hasCurrentProduct = this.currentProduct &&
        ((this.currentProduct.slug && this.currentProduct.slug === productSlug) ||
         this.currentProduct.id === productSlug);

      const hasFullDetails = hasCurrentProduct && this.currentProduct.description !== undefined;

      // Use cached products if available, otherwise fetch them
      const productsPromise = this.cachedProducts.length > 0
        ? Promise.resolve({ data: this.cachedProducts })
        : this.sdk.products.list({
            category: categoryIdOrSlug,
            per_page: 1000, // Load enough products to find neighbors
          });

      // Only fetch product if we don't have full details
      const productPromise = hasFullDetails ?
        Promise.resolve(this.currentProduct) :
        this.sdk.products.get(productSlug);

      // Load the product (and products list if not cached) in parallel
      const [product, productsResponse] = await Promise.all([
        productPromise,
        productsPromise
      ]);

      // Find current product index in the list
      const products = productsResponse.data || [];
      const currentIndex = products.findIndex(
        p => (p.slug && p.slug === productSlug) || p.id === productSlug
      );

      // Calculate prev/next products
      if (currentIndex !== -1) {
        this.prevProduct = currentIndex > 0 ? products[currentIndex - 1] : null;
        this.nextProduct = currentIndex < products.length - 1 ? products[currentIndex + 1] : null;
      } else {
        // Product not found in list (shouldn't happen, but handle gracefully)
        this.prevProduct = null;
        this.nextProduct = null;
      }

      // Cache products list for future navigation (only if we fetched it)
      if (this.cachedProducts.length === 0) {
        this.cachedProducts = products;
      }

      this.currentProduct = product;
      this.currentView = 'product-detail';
    } catch (error) {
      console.error('[Categories] Failed to load product:', error);
      this.showError('Product not found');
    } finally {
      this.loadingProduct = false;
    }
  }

  /**
   * Load a specific product (without navigation context)
   * Used when we don't need prev/next buttons
   */
  private async loadProduct(productSlug: string) {
    this.loadingProduct = true;

    try {
      // Lazy load product-detail component if not already loaded
      // Note: We use 'shoprocket-product' (not 'shoprocket-product-detail') to match
      // the name used by catalog and product-view components
      if (!customElements.get('shoprocket-product')) {
        try {
          const { ProductDetail } = await import('./product-detail');
          customElements.define('shoprocket-product', ProductDetail);
        } catch (err) {
          // Ignore if element was already defined by another component (race condition)
          if (!(err instanceof DOMException && err.name === 'NotSupportedError')) {
            throw err;
          }
        }
      }

      // Wait for element to be fully defined before setting properties
      await customElements.whenDefined('shoprocket-product');

      const product = await this.sdk.products.get(productSlug);
      this.currentProduct = product;
      this.currentView = 'product-detail';
    } catch (error) {
      console.error('[Categories] Failed to load product:', error);
      this.showError('Product not found');
    } finally {
      this.loadingProduct = false;
    }
  }

  /**
   * Handle category click
   */
  private async handleCategoryClick(category: Category) {
    // Mark this widget as the active one (it initiated this navigation)
    CategoriesWidget.activeWidget = this;

    // Optimization: Since we already have the category data (we just clicked it),
    // navigate instantly without showing loading state or refetching data
    this.buildNavigationStack(category);

    // Show either subcategories or products
    if (this.hasChildren(category)) {
      this.currentCategories = category.children || [];
      this.currentView = 'categories';
    } else {
      // Leaf category - lazy load catalog component and show products
      if (!customElements.get('shoprocket-catalog')) {
        try {
          const { ProductCatalog } = await import('./product-catalog');
          customElements.define('shoprocket-catalog', ProductCatalog);
        } catch (err) {
          if (!(err instanceof DOMException && err.name === 'NotSupportedError')) {
            throw err;
          }
        }
      }

      await customElements.whenDefined('shoprocket-catalog');

      this.currentCategories = [];
      this.currentView = 'products';
    }

    // Update URL for bookmarking (don't trigger another load via hash change)
    const identifier = category.slug || category.id;
    window.location.hash = `#!/categories/${identifier}`;
  }

  /**
   * Handle back button click
   */
  private handleBack() {
    // Mark this widget as the active one (it initiated this navigation)
    CategoriesWidget.activeWidget = this;

    // If viewing product detail, go back to category products
    if (this.currentView === 'product-detail') {
      const currentCategory = this.getCurrentCategory();
      if (currentCategory) {
        // Directly transition to products view (don't wait for URL routing)
        this.currentCategories = [];
        this.currentView = 'products';

        // Update URL for bookmarking
        const identifier = currentCategory.slug || currentCategory.id;
        window.location.hash = `#!/categories/${identifier}`;
      }
      return;
    }

    // Otherwise, handle normal category navigation
    if (this.navigationStack.length <= 1) return;

    this.navigationStack.pop();
    const previous = this.navigationStack[this.navigationStack.length - 1];

    if (!previous) return;

    if (previous.type === 'root') {
      // Back to root - clear URL properly (without leaving trailing #)
      const cleanUrl = window.location.pathname + window.location.search;
      history.replaceState(null, '', cleanUrl);
      this.loadInitialCategories();
    } else if (previous.category) {
      // Back to parent category
      const identifier = previous.category.slug || previous.category.id;
      window.location.hash = `#!/categories/${identifier}`;
      this.currentCategories = previous.category.children || [];
      this.currentView = 'categories';
    }
  }

  /**
   * Get current category (if not at root)
   */
  private getCurrentCategory(): Category | null {
    const current = this.navigationStack[this.navigationStack.length - 1];
    return current && current.type === 'category' && current.category ? current.category : null;
  }

  /**
   * Render back button
   */
  private renderBackButton(): TemplateResult {
    // Show back button if viewing product or if not at root
    if (this.currentView !== 'product-detail' && this.navigationStack.length <= 1) {
      return html``;
    }

    let label: string;

    if (this.currentView === 'product-detail') {
      // Back from product to category products
      const currentCategory = this.getCurrentCategory();
      label = currentCategory?.name || 'Products';
    } else {
      // Back from category to parent
      const previous = this.navigationStack[this.navigationStack.length - 2];
      label = previous && previous.type === 'root' ? 'All Categories' : previous?.category?.name || 'Back';
    }

    return html`
      <button
        class="sr-category-back"
        @click="${this.handleBack}">
        ← Back to ${label}
      </button>
    `;
  }

  /**
   * Add image transformations to category image URL
   */
  private getCategoryImageUrl(url: string): string {
    // Input: https://shoprocketv3.test/media/UUID/filename.webp
    // Output: https://shoprocketv3.test/media/w=600,h=600,fit=cover/UUID/filename.webp
    const mediaMatch = url.match(/^(.*\/media\/)(.+)$/);
    if (mediaMatch) {
      const [, baseUrl, pathAfterMedia] = mediaMatch;
      return `${baseUrl}w=600,h=600,fit=cover/${pathAfterMedia}`;
    }
    return url;
  }

  /**
   * Render category card
   */
  private renderCategoryCard(category: Category): TemplateResult {
    return html`
      <div
        class="sr-category-card"
        @click="${() => this.handleCategoryClick(category)}">
        ${this.showImages && category.image_url ? html`
          <img
            class="sr-category-image"
            src="${this.getCategoryImageUrl(category.image_url)}"
            srcset="${this.getCategoryImageUrl(category.image_url)} 600w,
                    ${this.getCategoryImageUrl(category.image_url).replace('w=600', 'w=400')} 400w,
                    ${this.getCategoryImageUrl(category.image_url).replace('w=600', 'w=300')} 300w"
            sizes="${getMediaSizes({ sm: Math.min(this.columns, 2), md: Math.min(this.columns, 3), lg: this.columns })}"
            alt="${category.name}"
            width="600"
            height="600"
            loading="lazy">
        ` : ''}

        <h3 class="sr-category-name">${category.name}</h3>

        ${this.showDescription && category.description ? html`
          <p class="sr-category-description">${category.description}</p>
        ` : ''}

        ${this.showCounts ? html`
          <div class="sr-category-count">
            ${category.products_count} ${category.products_count === 1 ? 'product' : 'products'}
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Render empty state
   */
  private renderEmptyState(): TemplateResult {
    return html`
      <div class="sr-empty-state">
        <p>No categories available</p>
      </div>
    `;
  }

  /**
   * Render loading state
   */
  private renderLoadingState(): TemplateResult {
    // If showing products view, render product grid skeleton instead
    if (this.currentView === 'products') {
      const skeletonProducts = Array(this.limit || 12).fill(null);

      return html`
        <div class="sr-product-grid" data-loading="true">
          ${skeletonProducts.map(() => html`
            <article class="sr-product-card">
              <div class="sr-product-image-container sr-image-loading"></div>
              <div class="sr-card-content">
                <div class="sr-product-info">
                  <h3 class="sr-product-title"></h3>
                  <div><span class="sr-product-price"></span></div>
                </div>
                <div class="sr-product-actions">
                  <button class="sr-button sr-button-primary" disabled></button>
                </div>
              </div>
            </article>
          `)}
        </div>
      `;
    }

    // Otherwise show category grid skeleton
    const skeletonCount = this.columns * 2; // Show 2 rows

    return html`
      <div class="sr-category-grid" style="--sr-category-cols: ${this.columns}">
        ${Array.from({ length: skeletonCount }).map(() => html`
          <div class="sr-category-skeleton"></div>
        `)}
      </div>
    `;
  }

  /**
   * Handle product click from embedded catalog
   */
  private handleCatalogProductClick = (event: CustomEvent) => {
    const { product, prevProduct, nextProduct, allProducts } = event.detail;
    const currentCategory = this.getCurrentCategory();

    if (!currentCategory) {
      console.error('Cannot navigate to product: no current category');
      return;
    }

    // Mark this widget as the active one (it initiated this navigation)
    CategoriesWidget.activeWidget = this;

    // Cache the products list from catalog for navigation
    if (allProducts && allProducts.length > 0) {
      this.cachedProducts = allProducts;
    }

    // Show product immediately with data from list (instant display)
    this.currentProduct = product;
    this.prevProduct = prevProduct;
    this.nextProduct = nextProduct;
    this.currentView = 'product-detail';

    // Update URL using replaceState to avoid triggering hashchange
    // This prevents redundant API calls since we already have all the data we need
    const categoryIdentifier = currentCategory.slug || currentCategory.id;
    const productIdentifier = product.slug || product.id;
    const newHash = `#!/categories/${categoryIdentifier}/product/${productIdentifier}`;
    history.replaceState(null, '', newHash);

    // Check if we have full product details (description, variants, etc.)
    // Products from list API only have basic data
    const hasFullDetails = product.description !== undefined;

    if (!hasFullDetails) {
      // Load full details in background while showing the product
      this.loadingProduct = true;
      this.sdk.products.get(productIdentifier).then(fullProduct => {
        this.currentProduct = fullProduct;
        // Update cache with full product details
        const cacheIndex = this.cachedProducts.findIndex(
          p => (p.slug && p.slug === product.slug) || p.id === product.id
        );
        if (cacheIndex !== -1) {
          this.cachedProducts[cacheIndex] = fullProduct;
        }
      }).catch(error => {
        console.error('[Categories] Failed to load full product:', error);
      }).finally(() => {
        this.loadingProduct = false;
      });
    }
  };

  /**
   * Render products grid using catalog component in Light DOM mode
   */
  private renderProducts(): TemplateResult {
    const currentCategory = this.getCurrentCategory();

    if (!currentCategory) {
      return html`
        <div class="sr-empty-state">
          <p>No category selected</p>
        </div>
      `;
    }

    return html`
      <shoprocket-catalog
        .sdk="${this.sdk}"
        data-categories="${currentCategory.slug}"
        data-limit="${this.limit}"
        data-routable="false"
        data-use-light-dom="true"
        @product-click="${this.handleCatalogProductClick}"
      ></shoprocket-catalog>
    `;
  }

  /**
   * Handle product navigation (prev/next) from product detail view
   * Use cached products list for instant navigation
   */
  private handleProductNavigation = async (event: CustomEvent) => {
    const { product } = event.detail;
    if (!product) return;

    const currentCategory = this.getCurrentCategory();
    if (!currentCategory) return;

    // Mark this widget as active
    CategoriesWidget.activeWidget = this;

    // If we have cached products, use them for instant navigation
    if (this.cachedProducts.length > 0) {
      const currentIndex = this.cachedProducts.findIndex(
        p => (p.slug && p.slug === product.slug) || p.id === product.id
      );

      if (currentIndex !== -1) {
        // Found in cache - instant navigation!
        this.currentProduct = product;
        this.prevProduct = currentIndex > 0 ? this.cachedProducts[currentIndex - 1] : null;
        this.nextProduct = currentIndex < this.cachedProducts.length - 1 ? this.cachedProducts[currentIndex + 1] : null;
        this.currentView = 'product-detail';

        // Update URL for bookmarking using replaceState to avoid triggering hashchange
        // This prevents redundant API calls since we've already handled the navigation
        const categoryIdentifier = currentCategory.slug || currentCategory.id;
        const productIdentifier = product.slug || product.id;
        const newHash = `#!/categories/${categoryIdentifier}/product/${productIdentifier}`;
        history.replaceState(null, '', newHash);

        // Check if we have full product details (description, variants, etc.)
        // Products from list API only have basic data
        const hasFullDetails = product.description !== undefined;

        if (!hasFullDetails) {
          // Load full details in background while showing the product
          this.loadingProduct = true;
          this.sdk.products.get(productIdentifier).then(fullProduct => {
            this.currentProduct = fullProduct;
            // Update cache with full product details
            this.cachedProducts[currentIndex] = fullProduct;
          }).catch(error => {
            console.error('[Categories] Failed to load full product:', error);
          }).finally(() => {
            this.loadingProduct = false;
          });
        }

        return;
      }
    }

    // Fallback: Navigate via URL (will trigger loadCategoryAndProduct)
    const categoryIdentifier = currentCategory.slug || currentCategory.id;
    const productIdentifier = product.slug || product.id;
    window.location.hash = `#!/categories/${categoryIdentifier}/product/${productIdentifier}`;
  };

  /**
   * Render product detail view
   */
  private renderProductDetail(): TemplateResult {
    // Only show loading spinner if we don't have any product data yet
    if (this.loadingProduct && !this.currentProduct) {
      return html`<div class="sr-loading-spinner"></div>`;
    }

    if (!this.currentProduct) {
      return html`
        <div class="sr-empty-state">
          <p>Product not found</p>
        </div>
      `;
    }

    return html`
      <shoprocket-product
        .sdk="${this.sdk}"
        .product="${this.currentProduct}"
        .prevProduct="${this.prevProduct}"
        .nextProduct="${this.nextProduct}"
        @navigate-product="${this.handleProductNavigation}"
      ></shoprocket-product>
    `;
  }

  /**
   * Main render
   */
  override render(): TemplateResult {
    if (this.loading) {
      return this.renderLoadingState();
    }

    // Remove min-height reservation once content loads
    if (this.hasAttribute('data-sr-reserve')) {
      this.style.minHeight = '';
      this.removeAttribute('data-sr-reserve');
    }

    const currentCategory = this.getCurrentCategory();

    return html`
      <style>
        /* Hide product's back button since categories widget provides its own */
        shoprocket-product .sr-back-button {
          display: none !important;
        }
      </style>
      <div class="sr-categories-widget">
        ${this.renderBackButton()}

        ${currentCategory ? html`
          <div class="sr-category-header">
            <h2 class="sr-category-title">${currentCategory.name}</h2>
            ${this.currentView === 'products' && currentCategory.description ? html`
              <p class="sr-category-description">${currentCategory.description}</p>
            ` : ''}
          </div>
        ` : ''}

        ${this.currentView === 'categories' ? html`
          ${this.currentCategories.length > 0 ? html`
            <div class="sr-category-grid" style="--sr-category-cols: ${this.columns}">
              ${this.currentCategories.map(cat => this.renderCategoryCard(cat))}
            </div>
          ` : this.renderEmptyState()}
        ` : this.currentView === 'products' ?
          this.renderProducts()
        : this.renderProductDetail()}
      </div>
    `;
  }
}

// Register element
if (!customElements.get('shoprocket-categories')) {
  customElements.define('shoprocket-categories', CategoriesWidget);
}
