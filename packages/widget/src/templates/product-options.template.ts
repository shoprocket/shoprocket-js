import { html, type TemplateResult } from 'lit';
import type { Product, ProductOption, VariantOption } from '../types/api';

export interface OptionsHandlers {
  selectOption: (optionId: string, valueId: string) => void;
  isOptionValueAvailable?: (option: ProductOption, value: VariantOption) => boolean;
  getOptionValueStock?: (option: ProductOption, value: VariantOption) => number | undefined;
}

export interface OptionsState {
  selectedOptions: Map<string, string>;
  availableValueIds?: Set<string>;
  variantStock?: Map<string, number>;
}

/**
 * Renders product options (variants/customizations)
 */
export const renderProductOptions = (
  product: Product,
  state: OptionsState,
  handlers: OptionsHandlers,
  isLoading = false
): TemplateResult => {
  // Show skeleton during loading
  if (isLoading) {
    return html`
      <div class="sr-product-options-skeleton">
        <div class="sr-skeleton sr-skeleton-text" style="width: 80px; height: 20px;"></div>
        <div class="sr-skeleton-group">
          <div class="sr-skeleton sr-skeleton-box" style="width: 60px; height: 40px;"></div>
          <div class="sr-skeleton sr-skeleton-box" style="width: 60px; height: 40px;"></div>
          <div class="sr-skeleton sr-skeleton-box" style="width: 60px; height: 40px;"></div>
        </div>
      </div>
    `;
  }

  // No options to render
  if (!product.options || product.options.length === 0) {
    return html``;
  }

  return html`
    <div class="sr-product-options">
      ${product.options.map(option => renderOption(option, product, state, handlers))}
    </div>
  `;
};

const renderOption = (
  option: ProductOption,
  product: Product,
  state: OptionsState,
  handlers: OptionsHandlers
): TemplateResult => {
  const selectedValue = state.selectedOptions.get(option.id);
  
  return html`
    <div class="sr-product-option">
      <label class="sr-product-option-label">
        ${option.name}
        ${option.required ? html`<span class="sr-required">*</span>` : ''}
      </label>
      
      <div class="sr-product-option-values">
        ${option.values.map(value => {
          const isSelected = selectedValue === value.id;
          const isAvailable = handlers.isOptionValueAvailable 
            ? handlers.isOptionValueAvailable(option, value)
            : state.availableValueIds?.has(value.id) ?? true;
          const stock = handlers.getOptionValueStock?.(option, value);
          const hasLowStock = stock !== undefined && stock > 0 && stock <= 5;
          
          return html`
            <button
              type="button"
              class="sr-product-option-value ${isSelected ? 'selected' : ''} ${!isAvailable ? 'unavailable' : ''}"
              @click="${() => handlers.selectOption(option.id, value.id)}"
              ?disabled="${!isAvailable}"
              title="${!isAvailable ? 'This option is not available' : value.name}"
            >
              ${renderOptionValue(option, value, isAvailable, hasLowStock, stock)}
            </button>
          `;
        })}
      </div>
    </div>
  `;
};

const renderOptionValue = (
  option: ProductOption,
  value: VariantOption,
  isAvailable: boolean,
  hasLowStock: boolean,
  stock?: number
): TemplateResult => {
  // Color swatch
  if (option.type === 'color' && value.color) {
    return html`
      <span 
        class="sr-color-swatch" 
        style="background-color: ${value.color};"
        title="${value.name}"
      ></span>
      ${hasLowStock ? html`<span class="sr-option-stock-indicator">${stock}</span>` : ''}
    `;
  }
  
  // Image swatch
  if (option.type === 'image' && value.image) {
    return html`
      <img 
        src="${value.image}" 
        alt="${value.name}"
        class="sr-option-image"
      >
      ${hasLowStock ? html`<span class="sr-option-stock-indicator">${stock}</span>` : ''}
    `;
  }
  
  // Text value
  return html`
    <span class="sr-option-text">${value.name}</span>
    ${hasLowStock ? html`<span class="sr-option-stock-indicator">${stock} left</span>` : ''}
  `;
};

/**
 * Checks if all required options are selected
 */
export const areAllRequiredOptionsSelected = (
  product: Product,
  selectedOptions: Map<string, string>
): boolean => {
  if (!product.options) return true;
  
  return product.options
    .filter(opt => opt.required)
    .every(opt => selectedOptions.has(opt.id));
};