import { html, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { ShoprocketElement } from '../core/base-component';
import type { Category } from '@shoprocket/core';
import type { Product } from '../types/api';
import { ProductListTemplates } from './product-list';

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
 * @attr {string} [data-parent] - Parent category ID/slug to start from
 * @attr {number} [data-columns=3] - Number of columns in grid
 * @attr {boolean} [data-show-images=true] - Show category images
 * @attr {boolean} [data-show-counts=true] - Show product counts
 * @attr {boolean} [data-show-description=true] - Show category descriptions
 * @attr {number} [data-limit=12] - Products per page when showing products
 * @attr {boolean} [data-routable=false] - Enable URL routing
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
  @property({ type: String, attribute: 'data-parent' }) parent?: string;
  @property({ type: Number, attribute: 'data-columns' }) columns = 3;
  @property({ type: Boolean, attribute: 'data-show-images' }) showImages = true;
  @property({ type: Boolean, attribute: 'data-show-counts' }) showCounts = true;
  @property({ type: Boolean, attribute: 'data-show-description' }) showDescription = true;
  @property({ type: Number, attribute: 'data-limit' }) limit = 12;
  @property({ type: Boolean, attribute: 'data-routable' }) routable = false;

  // State
  @state() private currentView: 'categories' | 'products' = 'categories';
  @state() private currentCategories: Category[] = [];
  @state() private currentProducts: Product[] = [];
  @state() private navigationStack: NavigationItem[] = [{ type: 'root' }];
  @state() private loading = false;
  @state() private loadingProducts = false;
  @state() private addedToCartProducts = new Set<string>();
  @state() private loadingItems = new Map<string, boolean>();

  override connectedCallback(): void {
    super.connectedCallback();

    // Initialize router if routable
    if (this.routable) {
      // Listen for hash changes
      window.addEventListener('hashchange', this.handleHashChange);

      // Sync with current URL on mount
      this.syncWithUrl();
    } else {
      // No routing - just load initial data
      this.loadInitialCategories();
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.routable) {
      window.removeEventListener('hashchange', this.handleHashChange);
    }
  }

  /**
   * Handle URL hash changes
   */
  private handleHashChange = () => {
    this.syncWithUrl();
  };

  /**
   * Parse category ID from hash
   * Format: #!/categories/cat_123
   */
  private getCategoryFromHash(): string | null {
    const hash = window.location.hash;

    // Check if hash matches #!/categories/{id}
    const match = hash.match(/^#!\/categories\/([^/]+)/);
    return match ? match[1] : null;
  }

  /**
   * Sync widget state with current URL
   */
  private async syncWithUrl() {
    const categoryId = this.getCategoryFromHash();

    if (categoryId) {
      // URL has category - load it
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
        // Load specific categories
        const categoryIds = this.categories.split(',').map(c => c.trim());
        response = await this.sdk.categories.list({
          filter: { id: categoryIds },
          include: 'children',
        });
      } else if (this.parent) {
        // Load children of parent category
        response = await this.sdk.categories.list({
          filter: { parent_id: this.parent },
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

    // Don't change hash - let other widgets (like catalog) handle product display
    // This keeps the category URL in place
  };

  /**
   * Handle add to cart
   */
  private handleAddToCart = async (product: Product) => {
    const loadingKey = product.quick_add_eligible === false
      ? `viewProduct-${product.id}`
      : `addToCart-${product.id}`;

    // If product needs options, navigate to product page
    if (product.quick_add_eligible === false) {
      this.handleProductClick(product);
      return;
    }

    // Safety check for SDK
    if (!this.sdk || !this.sdk.cart) {
      console.error('SDK not initialized');
      this.showError('Unable to add to cart - widget not initialized');
      return;
    }

    this.loadingItems.set(loadingKey, true);
    this.requestUpdate();

    try {
      await this.sdk.cart.addItem({
        product_id: product.id,
        variant_id: product.default_variant_id,
        quantity: 1,
      });

      // Show success state
      this.addedToCartProducts.add(product.id);
      this.requestUpdate();

      // Dispatch cart update event
      this.dispatchEvent(new CustomEvent('cart-updated', {
        bubbles: true,
        composed: true,
      }));

      // Reset after 2 seconds
      setTimeout(() => {
        this.addedToCartProducts.delete(product.id);
        this.requestUpdate();
      }, 2000);
    } catch (error) {
      console.error('Failed to add to cart:', error);
      this.showError('Failed to add to cart');
    } finally {
      this.loadingItems.set(loadingKey, false);
      this.requestUpdate();
    }
  };

  /**
   * Check if an item is loading
   */
  private isLoadingItem = (key: string): boolean => {
    return this.loadingItems.get(key) || false;
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

      // Update URL if routable (prefer slug, fallback to ID)
      if (this.routable) {
        const identifier = category.slug || category.id;
        window.location.hash = `#!/categories/${identifier}`;
      }
    } else {
      // Leaf category - show products
      this.navigationStack.push({
        type: 'category',
        category: category,
      });

      this.currentView = 'products';
      this.currentCategories = [];

      // Update URL if routable (prefer slug, fallback to ID)
      if (this.routable) {
        const identifier = category.slug || category.id;
        window.location.hash = `#!/categories/${identifier}`;
      }

      // Load products for this category
      await this.loadCategoryProducts(category.id);
    }
  }

  /**
   * Handle back button click
   */
  private handleBack() {
    if (this.navigationStack.length <= 1) return;

    this.navigationStack.pop();
    const previous = this.navigationStack[this.navigationStack.length - 1];

    if (previous.type === 'root') {
      // Back to root - clear URL and reload initial categories
      if (this.routable) {
        window.location.hash = '';
      }
      this.loadInitialCategories();
    } else if (previous.category) {
      // Back to parent category
      if (this.routable) {
        const identifier = previous.category.slug || previous.category.id;
        window.location.hash = `#!/categories/${identifier}`;
      }
      this.currentCategories = previous.category.children || [];
      this.currentView = 'categories';
    }
  }

  /**
   * Get current category (if not at root)
   */
  private getCurrentCategory(): Category | null {
    const current = this.navigationStack[this.navigationStack.length - 1];
    return current.type === 'category' && current.category ? current.category : null;
  }

  /**
   * Render back button
   */
  private renderBackButton(): TemplateResult {
    if (this.navigationStack.length <= 1) return html``;

    const previous = this.navigationStack[this.navigationStack.length - 2];
    const label = previous.type === 'root' ? 'All Categories' : previous.category?.name || 'Back';

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
            isLoadingItem: this.isLoadingItem,
          }
        )}
      </div>
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
        ` : this.renderProducts()}
      </div>
    `;
  }
}

// Register element
if (!customElements.get('shoprocket-categories')) {
  customElements.define('shoprocket-categories', CategoriesWidget);
}
