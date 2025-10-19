import { html, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { ShoprocketElement } from '../core/base-component';
import type { Category } from '@shoprocket/core';
import { formatNumber } from '../utils/formatters';

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

  @property({ type: Number, attribute: 'min-price' })
  minPrice?: number;

  @property({ type: Number, attribute: 'max-price' })
  maxPrice?: number;

  @property({ type: Number, attribute: 'price-range-min' })
  priceRangeMin = 0;

  @property({ type: Number, attribute: 'price-range-max' })
  priceRangeMax = 1000;

  @property({ type: Boolean, attribute: 'in-stock-only' })
  inStockOnly = false;

  @state()
  private localMinPrice?: number;

  @state()
  private localMaxPrice?: number;

  private priceDebounceTimer?: number;

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

  private handleMinPriceChange(e: InputEvent) {
    const input = e.target as HTMLInputElement;
    let value = parseFloat(input.value);

    // Ensure min doesn't exceed max
    const currentMax = this.localMaxPrice ?? this.maxPrice ?? this.priceRangeMax;
    if (value > currentMax) {
      value = currentMax;
      input.value = value.toString();
    }

    // Update local state immediately for visual feedback
    this.localMinPrice = value;
    this.requestUpdate();

    // Debounce the actual filter change
    this.debouncePriceChange();
  }

  private handleMaxPriceChange(e: InputEvent) {
    const input = e.target as HTMLInputElement;
    let value = parseFloat(input.value);

    // Ensure max doesn't go below min
    const currentMin = this.localMinPrice ?? this.minPrice ?? this.priceRangeMin;
    if (value < currentMin) {
      value = currentMin;
      input.value = value.toString();
    }

    // Update local state immediately for visual feedback
    this.localMaxPrice = value;
    this.requestUpdate();

    // Debounce the actual filter change
    this.debouncePriceChange();
  }

  private debouncePriceChange() {
    // Clear existing timer
    if (this.priceDebounceTimer) {
      window.clearTimeout(this.priceDebounceTimer);
    }

    // Set new timer - dispatch after 500ms of no changes
    this.priceDebounceTimer = window.setTimeout(() => {
      const currentMin = this.localMinPrice ?? this.priceRangeMin;
      const currentMax = this.localMaxPrice ?? this.priceRangeMax;

      // Dispatch a single event with both min and max price to avoid race conditions
      const minValue = currentMin > this.priceRangeMin ? currentMin.toString() : '';
      const maxValue = currentMax < this.priceRangeMax ? currentMax.toString() : '';

      this.dispatchFilterChange('priceRange', JSON.stringify({ min: minValue, max: maxValue }));
    }, 500);
  }

  private handleInStockChange(e: Event) {
    const checked = (e.target as HTMLInputElement).checked;
    this.dispatchFilterChange('inStockOnly', checked ? 'true' : 'false');
  }

  private dispatchFilterChange(filterType: string, value: string) {
    this.dispatchEvent(new CustomEvent('filter-change', {
      detail: { filterType, value },
      bubbles: true,
      composed: true,
    }));
  }

  private formatPrice(value: number): string {
    // Get store currency and user locale for proper formatting
    const store = (window as any).Shoprocket?.store?.get?.();
    const currency = store?.base_currency_code || 'USD';
    const locale = navigator.language || 'en-US';

    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  }

  private renderPriceRangeSlider(): TemplateResult {
    const currentMin = this.localMinPrice ?? this.minPrice ?? this.priceRangeMin;
    const currentMax = this.localMaxPrice ?? this.maxPrice ?? this.priceRangeMax;

    return html`
      <div class="sr-field-group">
        <div class="sr-price-range-field">
          <div class="sr-price-range-header">
            <span class="sr-price-range-label">Price Range</span>
            <span class="sr-price-range-values">
              ${this.formatPrice(currentMin)} - ${this.formatPrice(currentMax)}
            </span>
          </div>
          <div class="sr-price-range-slider">
            <input
              type="range"
              class="sr-range-min"
              min="${this.priceRangeMin}"
              max="${this.priceRangeMax}"
              step="1"
              .value="${currentMin.toString()}"
              @input="${this.handleMinPriceChange}"
              aria-label="Minimum price"
            />
            <input
              type="range"
              class="sr-range-max"
              min="${this.priceRangeMin}"
              max="${this.priceRangeMax}"
              step="1"
              .value="${currentMax.toString()}"
              @input="${this.handleMaxPriceChange}"
              aria-label="Maximum price"
            />
          </div>
        </div>
      </div>
    `;
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

        <!-- Price Range Slider -->
        <div class="sr-filter-group sr-filter-price-range">
          ${this.renderPriceRangeSlider()}
        </div>

        <!-- In Stock Only Checkbox -->
        <div class="sr-filter-group sr-filter-stock">
          <label class="sr-checkbox-label">
            <input
              type="checkbox"
              class="sr-checkbox"
              .checked="${this.inStockOnly}"
              @change="${this.handleInStockChange}"
            />
            <span class="sr-checkbox-text">In stock</span>
          </label>
        </div>

        <!-- Product Count -->
        ${this.totalProducts > 0 ? html`
          <div class="sr-filter-group sr-filter-product-count">
            <div class="sr-product-count">
              ${formatNumber(this.totalProducts)} ${this.totalProducts === 1 ? 'product' : 'products'}
            </div>
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
