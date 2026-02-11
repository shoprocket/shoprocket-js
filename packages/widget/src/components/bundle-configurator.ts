/**
 * Bundle Configurator Component
 * One card per component product, with cascading option selectors.
 * Pattern: matches Shopify/WooCommerce bundle builder UX.
 */
import { html, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { ShoprocketElement, EVENTS } from '../core/base-component';
import type { BundleConfig, BundleSelection, BundleComponent, BundleComponentVariant } from '@shoprocket/core';
import { t } from '../utils/i18n';

/** Per-component state: selected options, resolved variant, quantity */
interface ComponentState {
  selectedOptions: Record<string, string>;
  selectedVariantId: string | null;
  quantity: number;
}

export class BundleConfigurator extends ShoprocketElement {
  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  @property({ type: Object })
  bundleConfig?: BundleConfig;

  @property({ type: String })
  productId?: string;

  @property({ type: String })
  productName?: string;

  /** Keyed by component ID */
  @state()
  private componentStates: Map<string, ComponentState> = new Map();

  override updated(changedProperties: Map<string, any>): void {
    super.updated(changedProperties);
    if (changedProperties.has('bundleConfig') && this.bundleConfig) {
      const states = new Map<string, ComponentState>();
      for (const comp of this.bundleConfig.components) {
        states.set(comp.id, this.initComponentState(comp));
      }
      this.componentStates = states;
      this.dispatchSelectionsChanged();
    }
  }

  /** Initialize state for a component — pre-select first in-stock variant's options */
  private initComponentState(comp: BundleComponent): ComponentState {
    const options = comp.product.options ?? [];
    const firstInStock = comp.variants.find(v => v.inStock) ?? comp.variants[0];

    if (options.length > 0 && firstInStock?.optionValues) {
      // Resolve the option selections from the first in-stock variant
      const selectedOptions: Record<string, string> = {};
      for (const opt of options) {
        const match = opt.values.find(v => firstInStock.optionValues!.includes(v.id));
        if (match) selectedOptions[opt.id] = match.id;
      }
      return { selectedOptions, selectedVariantId: firstInStock.id, quantity: 0 };
    }

    // Single variant or no options data
    return { selectedOptions: {}, selectedVariantId: firstInStock?.id ?? null, quantity: 0 };
  }

  private get totalSelected(): number {
    let total = 0;
    this.componentStates.forEach(s => { total += s.quantity; });
    return total;
  }

  private get maxQuantity(): number {
    return this.bundleConfig?.maxQuantity ?? this.bundleConfig?.minQuantity ?? 0;
  }

  private get isValid(): boolean {
    if (!this.bundleConfig) return false;
    return this.totalSelected === this.bundleConfig.minQuantity;
  }

  private getSelections(): BundleSelection[] {
    const result: BundleSelection[] = [];
    this.componentStates.forEach(s => {
      if (s.quantity > 0 && s.selectedVariantId) {
        result.push({ variantId: s.selectedVariantId, quantity: s.quantity });
      }
    });
    return result;
  }

  private getSelectedVariant(component: BundleComponent): BundleComponentVariant | undefined {
    const state = this.componentStates.get(component.id);
    if (!state?.selectedVariantId) return undefined;
    return component.variants.find(v => v.id === state.selectedVariantId);
  }

  /** Resolve variant from selected options */
  private resolveVariant(component: BundleComponent, selectedOptions: Record<string, string>): BundleComponentVariant | undefined {
    const options = component.product.options ?? [];
    const selectedValues = Object.values(selectedOptions);
    if (selectedValues.length !== options.length) return undefined;

    return component.variants.find(v => {
      const vals = v.optionValues ?? [];
      return vals.length === selectedValues.length &&
             selectedValues.every(id => vals.includes(id));
    });
  }

  /** Check if an option value leads to any in-stock variant (given other selections) */
  private isOptionValueAvailable(component: BundleComponent, optionId: string, valueId: string): boolean {
    const state = this.componentStates.get(component.id);
    if (!state) return true;

    // Get the other selected option values (excluding this option)
    const otherSelections = Object.entries(state.selectedOptions)
      .filter(([id]) => id !== optionId)
      .map(([, val]) => val);

    // Find variants that have this value AND match other selections AND are in stock
    return component.variants.some(v => {
      const vals = v.optionValues ?? [];
      if (!vals.includes(valueId)) return false;
      if (!otherSelections.every(id => vals.includes(id))) return false;
      return v.inStock;
    });
  }

  private canIncrement(component: BundleComponent): boolean {
    if (this.totalSelected >= this.maxQuantity) return false;
    const variant = this.getSelectedVariant(component);
    if (!variant?.inStock) return false;
    const state = this.componentStates.get(component.id);
    const current = state?.quantity ?? 0;
    if (variant.inventoryCount !== undefined && variant.inventoryCount > 0 && current >= variant.inventoryCount) return false;
    if (!this.bundleConfig?.allowDuplicates && current >= 1) return false;
    return true;
  }

  private increment(component: BundleComponent): void {
    if (!this.canIncrement(component)) return;
    const states = new Map(this.componentStates);
    const current = states.get(component.id)!;
    states.set(component.id, { ...current, quantity: current.quantity + 1 });
    this.componentStates = states;
    this.dispatchSelectionsChanged();
  }

  private decrement(componentId: string): void {
    const states = new Map(this.componentStates);
    const current = states.get(componentId);
    if (!current || current.quantity <= 0) return;
    states.set(componentId, { ...current, quantity: current.quantity - 1 });
    this.componentStates = states;
    this.dispatchSelectionsChanged();
  }

  private selectOption(componentId: string, optionId: string, valueId: string, component: BundleComponent): void {
    const states = new Map(this.componentStates);
    const current = states.get(componentId);
    if (!current) return;

    const selectedOptions = { ...current.selectedOptions, [optionId]: valueId };
    const resolved = this.resolveVariant(component, selectedOptions);

    // Reset quantity when options change (variant/stock may differ)
    states.set(componentId, {
      selectedOptions,
      selectedVariantId: resolved?.id ?? null,
      quantity: 0
    });
    this.componentStates = states;
    this.dispatchSelectionsChanged();
  }

  /** Fallback: flat dropdown for components without options data */
  private selectVariantDirect(componentId: string, variantId: string): void {
    const states = new Map(this.componentStates);
    const current = states.get(componentId);
    if (!current) return;
    states.set(componentId, { ...current, selectedVariantId: variantId, quantity: 0 });
    this.componentStates = states;
    this.dispatchSelectionsChanged();
  }

  private dispatchSelectionsChanged(): void {
    this.dispatchEvent(new CustomEvent('bundle-selections-changed', {
      detail: {
        selections: this.getSelections(),
        totalSelected: this.totalSelected,
        isValid: this.isValid
      },
      bubbles: true
    }));

    if (this.isValid && this.productId) {
      this.track(EVENTS.BUNDLE_CONFIGURED, {
        product_id: this.productId,
        product_name: this.productName,
        bundle_size: this.bundleConfig?.minQuantity,
        unique_items: this.getSelections().length
      });
    }
  }

  protected override render(): TemplateResult {
    if (!this.bundleConfig) return html``;

    const { minQuantity, components } = this.bundleConfig;
    const total = this.totalSelected;
    const remaining = minQuantity - total;
    const progressPercent = Math.min(100, (total / minQuantity) * 100);

    return html`
      <div class="sr-bundle-configurator">
        <!-- Progress -->
        <div class="sr-bundle-progress">
          <div class="sr-bundle-progress-text">
            ${this.isValid
              ? html`<span class="sr-bundle-progress-done">${t('bundle.selection_complete', 'Selection complete')}</span>`
              : html`<span>${remaining === 1
                  ? t('bundle.select_one_more', 'Select 1 more item')
                  : t('bundle.select_more', 'Select {count} items', { count: remaining })
                }</span>`
            }
            <span class="sr-bundle-progress-count">${total}/${minQuantity}</span>
          </div>
          <div class="sr-bundle-progress-bar">
            <div class="sr-bundle-progress-fill ${this.isValid ? 'complete' : ''}" style="width: ${progressPercent}%"></div>
          </div>
        </div>

        <!-- Component rows -->
        <div class="sr-bundle-components">
          ${components.map(comp => this.renderComponent(comp))}
        </div>
      </div>
    `;
  }

  private renderComponent(component: BundleComponent): TemplateResult {
    const media = component.product.media?.[0];
    const state = this.componentStates.get(component.id);
    const qty = state?.quantity ?? 0;
    const isSelected = qty > 0;
    const selectedVariant = this.getSelectedVariant(component);
    const allOutOfStock = !component.variants.some(v => v.inStock);
    const hasOptions = (component.product.options?.length ?? 0) > 0;
    const hasMultipleVariants = component.variants.length > 1;

    return html`
      <div class="sr-bundle-component ${isSelected ? 'selected' : ''} ${allOutOfStock ? 'out-of-stock' : ''}">
        <!-- Image -->
        ${media ? html`
          <div class="sr-bundle-component-image">
            <img
              src="${this.getMediaUrl(media, 'w=300,h=300,fit=cover')}"
              alt="${component.product.name}"
              loading="lazy"
              @error="${this.handleImageError}"
            />
            ${isSelected ? html`<div class="sr-bundle-component-badge">${qty}</div>` : ''}
          </div>
        ` : html`
          <div class="sr-bundle-component-image sr-bundle-no-image">
            ${isSelected ? html`<div class="sr-bundle-component-badge">${qty}</div>` : ''}
          </div>
        `}

        <!-- Info -->
        <div class="sr-bundle-component-body">
          <div class="sr-bundle-component-name">${component.product.name}</div>

          ${allOutOfStock ? html`
            <div class="sr-bundle-component-stock">${t('bundle.out_of_stock', 'Out of stock')}</div>
          ` : html`
            <!-- Option selectors + actions in a row -->
            <div class="sr-bundle-component-controls">
              ${hasOptions
                ? this.renderOptionSelectors(component)
                : hasMultipleVariants
                  ? this.renderFallbackDropdown(component, state)
                  : ''}

              <div class="sr-bundle-component-actions">
                ${isSelected ? html`
                  <div class="sr-bundle-component-quantity">
                    <button
                      class="sr-bundle-qty-button"
                      @click="${() => this.decrement(component.id)}"
                      aria-label="${t('cart.decrease_quantity', 'Decrease quantity')}"
                    >−</button>
                    <span class="sr-bundle-qty-value">${qty}</span>
                    <button
                      class="sr-bundle-qty-button"
                      @click="${() => this.increment(component)}"
                      ?disabled="${!this.canIncrement(component)}"
                      aria-label="${t('cart.increase_quantity', 'Increase quantity')}"
                    >+</button>
                  </div>
                ` : html`
                  <button
                    class="sr-button sr-button-primary sr-bundle-add-button"
                    @click="${() => this.increment(component)}"
                    ?disabled="${!this.canIncrement(component)}"
                  >
                    ${this.totalSelected >= this.maxQuantity
                      ? t('bundle.max_reached', 'Max reached')
                      : !selectedVariant?.inStock
                        ? t('bundle.out_of_stock', 'Out of stock')
                        : t('bundle.add', 'Add')}
                  </button>
                `}
              </div>
            </div>
          `}
        </div>
      </div>
    `;
  }

  /** Render cascading option selectors (dropdowns per option) */
  private renderOptionSelectors(component: BundleComponent): TemplateResult {
    const options = component.product.options ?? [];
    const state = this.componentStates.get(component.id);

    return html`
      <div class="sr-bundle-options">
        ${options.map(option => html`
          <label class="sr-bundle-option">
            <span class="sr-bundle-option-label">${option.name}</span>
            <select
              class="sr-bundle-option-select"
              @change="${(e: Event) => this.selectOption(component.id, option.id, (e.target as HTMLSelectElement).value, component)}"
            >
              ${option.values.map(value => {
                const isAvailable = this.isOptionValueAvailable(component, option.id, value.id);
                return html`
                  <option
                    value="${value.id}"
                    ?selected="${state?.selectedOptions[option.id] === value.id}"
                    ?disabled="${!isAvailable}"
                  >${value.value}${!isAvailable ? ` - ${t('bundle.out_of_stock', 'Out of stock')}` : ''}</option>
                `;
              })}
            </select>
          </label>
        `)}
      </div>
    `;
  }

  /** Fallback flat dropdown for components without options data */
  private renderFallbackDropdown(component: BundleComponent, state: ComponentState | undefined): TemplateResult {
    return html`
      <select
        class="sr-bundle-variant-select"
        .value="${state?.selectedVariantId ?? ''}"
        @change="${(e: Event) => this.selectVariantDirect(component.id, (e.target as HTMLSelectElement).value)}"
      >
        ${component.variants.map((v: BundleComponentVariant) => html`
          <option value="${v.id}" ?disabled="${!v.inStock}">
            ${v.name}${!v.inStock ? ` - ${t('bundle.out_of_stock', 'Out of stock')}` : ''}
          </option>
        `)}
      </select>
    `;
  }
}
