import { html, type TemplateResult } from 'lit';
import type { Product } from '../types/api';
import { formatCurrency, formatStock } from '../utils/formatting';

export interface ProductInfoHandlers {
  updateQuantity?: (quantity: number) => void;
  addToCart?: () => void;
  toggleWishlist?: () => void;
}

export interface ProductInfoState {
  quantity: number;
  selectedVariantId?: string;
  canAddToCart: boolean;
  isAddingToCart: boolean;
  isInWishlist?: boolean;
  buttonText: string;
}

/**
 * Renders product basic information (name, price, description)
 */
export const renderProductInfo = (
  product: Product,
  state: ProductInfoState,
  handlers: ProductInfoHandlers
): TemplateResult => {
  return html`
    <div class="sr-product-info">
      <!-- Title and metadata -->
      <h1 class="sr-product-title">${product.name}</h1>
      
      ${product.sku ? html`
        <div class="sr-product-sku">SKU: ${product.sku}</div>
      ` : ''}
      
      <!-- Price display -->
      ${renderPriceDisplay(product, state.selectedVariantId)}
      
      <!-- Stock status -->
      ${renderStockStatus(product, state.selectedVariantId)}
      
      <!-- Short description -->
      ${product.short_description ? html`
        <div class="sr-product-short-description">
          ${product.short_description}
        </div>
      ` : ''}
      
      <!-- Add to cart section -->
      ${renderAddToCart(product, state, handlers)}
      
      <!-- Full description -->
      ${product.description ? html`
        <div class="sr-product-description">
          <h3 class="sr-product-section-title">Description</h3>
          <div class="sr-product-description-content" 
               .innerHTML="${product.description}">
          </div>
        </div>
      ` : ''}
    </div>
  `;
};

const renderPriceDisplay = (
  product: Product,
  selectedVariantId?: string
): TemplateResult => {
  // Get the appropriate price based on selection
  const variant = selectedVariantId && product.variants
    ? product.variants.find(v => v.id === selectedVariantId)
    : null;
  
  const price = variant?.price ?? product.price;
  const comparePrice = variant?.compare_at_price ?? product.compare_at_price;
  const hasDiscount = comparePrice && comparePrice > price;
  
  return html`
    <div class="sr-product-price-wrapper">
      ${hasDiscount ? html`
        <span class="sr-product-price-compare">
          ${formatCurrency(comparePrice, product.store.currency)}
        </span>
      ` : ''}
      <span class="sr-product-price ${hasDiscount ? 'sr-product-price-sale' : ''}">
        ${formatCurrency(price, product.store.currency)}
      </span>
      ${hasDiscount ? html`
        <span class="sr-product-discount-badge">
          -${Math.round(((comparePrice - price) / comparePrice) * 100)}%
        </span>
      ` : ''}
    </div>
  `;
};

const renderStockStatus = (
  product: Product,
  selectedVariantId?: string
): TemplateResult => {
  // Get stock info for selected variant or product
  const variant = selectedVariantId && product.variants
    ? product.variants.find(v => v.id === selectedVariantId)
    : null;
  
  const trackInventory = variant?.track_inventory ?? product.track_inventory;
  const stockQuantity = variant?.stock_quantity ?? product.stock_quantity;
  const stockStatus = variant?.stock_status ?? product.stock_status;
  
  if (!trackInventory) {
    return html``;
  }
  
  const isInStock = stockStatus === 'in_stock';
  const isLowStock = isInStock && stockQuantity !== null && stockQuantity <= 5;
  
  return html`
    <div class="sr-product-stock-status ${!isInStock ? 'out-of-stock' : ''} ${isLowStock ? 'low-stock' : ''}">
      ${!isInStock ? html`
        <span class="sr-stock-indicator">Out of Stock</span>
      ` : isLowStock ? html`
        <span class="sr-stock-indicator">Only ${stockQuantity} left in stock</span>
      ` : html`
        <span class="sr-stock-indicator">In Stock</span>
      `}
    </div>
  `;
};

const renderAddToCart = (
  product: Product,
  state: ProductInfoState,
  handlers: ProductInfoHandlers
): TemplateResult => {
  const isOutOfStock = product.stock_status === 'out_of_stock' || 
    (state.selectedVariantId && product.variants?.find(v => v.id === state.selectedVariantId)?.stock_status === 'out_of_stock');
  
  return html`
    <div class="sr-product-actions">
      <!-- Quantity selector -->
      ${!isOutOfStock && handlers.updateQuantity ? html`
        <div class="sr-quantity-selector">
          <button 
            type="button"
            class="sr-quantity-btn"
            @click="${() => handlers.updateQuantity!(Math.max(1, state.quantity - 1))}"
            ?disabled="${state.quantity <= 1}"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd"/>
            </svg>
          </button>
          <input
            type="number"
            class="sr-quantity-input"
            value="${state.quantity}"
            min="1"
            max="${product.max_quantity || 999}"
            @change="${(e: Event) => {
              const input = e.target as HTMLInputElement;
              const qty = Math.max(1, parseInt(input.value) || 1);
              handlers.updateQuantity!(qty);
            }}"
          >
          <button 
            type="button"
            class="sr-quantity-btn"
            @click="${() => handlers.updateQuantity!(state.quantity + 1)}"
            ?disabled="${product.max_quantity ? state.quantity >= product.max_quantity : false}"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/>
            </svg>
          </button>
        </div>
      ` : ''}
      
      <!-- Add to cart button -->
      <button
        type="button"
        class="sr-btn sr-btn-primary sr-add-to-cart-btn"
        @click="${handlers.addToCart}"
        ?disabled="${!state.canAddToCart || state.isAddingToCart || isOutOfStock}"
      >
        ${state.isAddingToCart ? html`
          <span class="sr-loading-spinner"></span>
          Adding...
        ` : isOutOfStock ? html`
          Out of Stock
        ` : html`
          ${state.buttonText}
        `}
      </button>
      
      <!-- Wishlist button -->
      ${handlers.toggleWishlist ? html`
        <button
          type="button"
          class="sr-btn sr-btn-secondary sr-wishlist-btn"
          @click="${handlers.toggleWishlist}"
          title="${state.isInWishlist ? 'Remove from wishlist' : 'Add to wishlist'}"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="${state.isInWishlist ? 'currentColor' : 'none'}" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
          </svg>
        </button>
      ` : ''}
    </div>
  `;
};