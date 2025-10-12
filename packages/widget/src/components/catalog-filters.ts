import { html, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { ShoprocketElement } from '../core/base-component';
import type { Category } from '@shoprocket/core';

/**
 * Catalog Filters Component - Filter toolbar for product catalog
 *
 * @element shoprocket-catalog-filters
 * @fires filter-change - When any filter value changes
 */
export class CatalogFilters extends ShoprocketElement {
  // Always use Light DOM since this is embedded in catalog
  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  @property({ type: String })
  search = '';

  @property({ type: String })
  sort = '';

  @property({ type: String })
  category = '';

  @property({ type: Array })
  categories: Category[] = [];

  @property({ type: String, attribute: 'filter-position' })
  filterPosition: 'top' | 'left' = 'top';

  @property({ type: Number, attribute: 'total-products' })
  totalProducts = 0;

  private handleSearchInput(e: InputEvent) {
    const value = (e.target as HTMLInputElement).value;
    this.dispatchFilterChange('search', value);
  }

  private handleSortChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value;
    this.dispatchFilterChange('sort', value);
  }

  private handleCategoryChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value;
    this.dispatchFilterChange('category', value);
  }

  private clearSearch() {
    this.dispatchFilterChange('search', '');
  }

  private dispatchFilterChange(filterType: string, value: string) {
    this.dispatchEvent(new CustomEvent('filter-change', {
      detail: { filterType, value },
      bubbles: true,
      composed: true,
    }));
  }

  protected override render(): TemplateResult {
    const isHorizontal = this.filterPosition === 'top';

    return html`
      <div class="sr-catalog-filters ${isHorizontal ? 'sr-filters-horizontal' : 'sr-filters-sidebar'}">
        <!-- Search -->
        <div class="sr-filter-group sr-filter-search">
          <div class="sr-field-group-with-icon">
            <input
              type="text"
              id="search"
              class="sr-field-input sr-field-input-with-icon peer sr-search-input"
              placeholder=" "
              .value="${this.search}"
              @input="${this.handleSearchInput}"
            />
            <svg class="sr-field-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <label class="sr-field-label" for="search">Search</label>
            ${this.search ? html`
              <button
                type="button"
                class="sr-search-clear"
                @click="${this.clearSearch}"
                aria-label="Clear search"
              >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Sort -->
        <div class="sr-filter-group sr-filter-sort">
          <div class="sr-field-group">
            <select
              id="sort"
              class="sr-field-select peer has-value"
              .value="${this.sort}"
              @change="${this.handleSortChange}"
            >
              <option value="">Featured</option>
              <option value="name_asc">Name (A-Z)</option>
              <option value="name_desc">Name (Z-A)</option>
              <option value="price_asc">Price (Low to High)</option>
              <option value="price_desc">Price (High to Low)</option>
              <option value="created_at_desc">Newest First</option>
              <option value="created_at_asc">Oldest First</option>
            </select>
            <label class="sr-field-label" for="sort">Sort</label>
          </div>
        </div>

        <!-- Category Filter (only show if we have categories) -->
        ${this.categories && this.categories.length > 0 ? html`
          <div class="sr-filter-group sr-filter-category">
            <div class="sr-field-group">
              <select
                id="category"
                class="sr-field-select peer has-value"
                .value="${this.category}"
                @change="${this.handleCategoryChange}"
              >
                <option value="">All</option>
                ${this.categories.map(cat => html`
                  <option value="${cat.slug}" ?selected="${cat.slug === this.category}">
                    ${cat.name}
                  </option>
                `)}
              </select>
              <label class="sr-field-label" for="category">Category</label>
            </div>
          </div>
        ` : ''}

        <!-- Product Count -->
        ${this.totalProducts > 0 ? html`
          <div class="sr-product-count">
            ${this.totalProducts} ${this.totalProducts === 1 ? 'product' : 'products'}
          </div>
        ` : ''}
      </div>
    `;
  }
}

// Register the component
if (!customElements.get('shoprocket-catalog-filters')) {
  customElements.define('shoprocket-catalog-filters', CatalogFilters);
}
