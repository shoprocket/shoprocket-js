import { html, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { ShoprocketElement } from '../core/base-component';
import type { Product } from '../types/api';
import { ProductListTemplates } from './product-list';
import { WIDGET_EVENTS, TIMEOUTS } from '../constants';

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
  @state() private currentProducts: Product[] = [];
  @state() private currentProduct?: Product;
  @state() private navigationStack: NavigationItem[] = [{ type: 'root' }];
  @state() private loading = false;
  @state() private loadingProducts = false;
  @state() private loadingProduct = false;
  @state() private addedToCartProducts = new Set<string>();

  override connectedCallback(): void {
    super.connectedCallback();

    // Listen for product added events to show success state
    this.handleProductAdded = this.handleProductAdded.bind(this);
    window.addEventListener(WIDGET_EVENTS.PRODUCT_ADDED, this.handleProductAdded as EventListener);

    // Always enable routing - namespace filtering prevents conflicts
    window.addEventListener('hashchange', this.handleHashChange);

    // Sync with current URL on mount
    this.syncWithUrl();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener(WIDGET_EVENTS.PRODUCT_ADDED, this.handleProductAdded as EventListener);
    window.removeEventListener('hashchange', this.handleHashChange);
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
    if (hash.startsWith('#!/categories/')) {
      this.syncWithUrl();
    }
    // Note: We also ignore empty hash - the widget should maintain its current state
    // rather than resetting when user navigates elsewhere on the page
  };

  /**
   * Handle product added to cart event
   */
  private handleProductAdded = (event: CustomEvent) => {
    const { product } = event.detail;
    if (product && product.id) {
      this.addedToCartProducts.add(product.id);
      this.requestUpdate();

      // Clear success state after timeout
      setTimeout(() => {
        this.addedToCartProducts.delete(product.id);
        this.requestUpdate();
      }, TIMEOUTS.SUCCESS_MESSAGE);
    }
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
          filter: { root: true },
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
        // Leaf category - load products
        this.currentCategories = [];
        this.currentView = 'products';
        await this.loadCategoryProducts(category.id);
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
    // Check if we're already viewing this category - if so, just load the product
    const currentCategory = this.getCurrentCategory();

    // Match by either ID or slug
    if (currentCategory && (currentCategory.id === categoryId || currentCategory.slug === categoryId)) {
      // Already in this category, just load/switch to the product
      await this.loadProduct(productSlug);
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

      // Now load the specific product
      await this.loadProduct(productSlug);
    } catch (error) {
      console.error('Failed to load category and product:', error);
      this.showError('Failed to load content');
    } finally {
      this.loading = false;
    }
  }

  /**
   * Load a specific product
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
   * Load products for a category
   */
  private async loadCategoryProducts(categoryId: string) {
    this.loadingProducts = true;

    try {
      const response = await this.sdk.products.list({
        per_page: this.limit,
        category: categoryId,
      });

      this.currentProducts = response.data || [];
    } catch (error) {
      console.error('Failed to load products:', error);
      this.showError('Failed to load products');
    } finally {
      this.loadingProducts = false;
    }
  }

  /**
   * Handle product click - navigate to product detail
   */
  private handleProductClick = (product: Product) => {
    // Dispatch event for external handling
    this.dispatchEvent(new CustomEvent('product-click', {
      detail: { product },
      bubbles: true,
      composed: true,
    }));

    // Get current category from navigation stack
    const currentCategory = this.getCurrentCategory();
    if (!currentCategory) {
      console.error('Cannot navigate to product: no current category');
      return;
    }

    // Navigate to product using category-scoped hash
    // Format: #!/categories/{cat-id}/product/{product-slug}
    const categoryIdentifier = currentCategory.slug || currentCategory.id;
    const productIdentifier = product.slug || product.id;
    window.location.hash = `#!/categories/${categoryIdentifier}/product/${productIdentifier}`;
  };

  /**
   * Handle add to cart
   */
  private handleAddToCart = async (product: Product) => {
    // If product needs options, navigate to product page
    if (!product.quick_add_eligible || !product.default_variant_id) {
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

    // Dispatch event to cart component - it will handle everything including optimistic updates
    window.dispatchEvent(new CustomEvent(WIDGET_EVENTS.CART_ADD_ITEM, {
      detail: { item: cartItemData, stockInfo }
    }));
  };

  /**
   * Handle category click
   */
  private async handleCategoryClick(category: Category) {
    if (this.hasChildren(category)) {
      // Has subcategories - navigate into them
      this.navigationStack.push({
        type: 'category',
        category: category,
      });

      this.currentCategories = category.children || [];

      // Update URL (prefer slug, fallback to ID)
      const identifier = category.slug || category.id;
      window.location.hash = `#!/categories/${identifier}`;
    } else {
      // Leaf category - show products
      this.navigationStack.push({
        type: 'category',
        category: category,
      });

      this.currentView = 'products';
      this.currentCategories = [];

      // Update URL (prefer slug, fallback to ID)
      const identifier = category.slug || category.id;
      window.location.hash = `#!/categories/${identifier}`;

      // Load products for this category
      await this.loadCategoryProducts(category.id);
    }
  }

  /**
   * Handle back button click
   */
  private handleBack() {
    // If viewing product detail, go back to category products
    if (this.currentView === 'product-detail') {
      const currentCategory = this.getCurrentCategory();
      if (currentCategory) {
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
      // Back to root - clear URL and reload initial categories
      window.location.hash = '';
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
            src="${category.image_url}"
            alt="${category.name}"
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
   * Render products grid
   */
  private renderProducts(): TemplateResult {
    return html`
      <div class="sr-category-products">
        ${ProductListTemplates.renderProductList(
          this.currentProducts,
          this.loadingProducts,
          this.limit,
          this.errorMessage,
          null, // successMessage
          this.addedToCartProducts,
          {
            handleProductClick: this.handleProductClick,
            handleAddToCart: this.handleAddToCart,
            formatPrice: this.formatPrice,
            getMediaUrl: this.getMediaUrl,
            handleImageError: this.handleImageError,
            isLoadingItem: () => false, // Cart handles loading state
          }
        )}
      </div>
    `;
  }

  /**
   * Render product detail view
   */
  private renderProductDetail(): TemplateResult {
    if (this.loadingProduct) {
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
        data-hide="navigation"
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

    const currentCategory = this.getCurrentCategory();

    return html`
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
        ` : this.currentView === 'product-detail' ? this.renderProductDetail() : this.renderProducts()}
      </div>
    `;
  }
}

// Register element
if (!customElements.get('shoprocket-categories')) {
  customElements.define('shoprocket-categories', CategoriesWidget);
}
