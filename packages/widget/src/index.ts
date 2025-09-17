/**
 * Shoprocket Widget
 * 
 * Copyright (c) 2025 Shoprocket Ltd.
 * 
 * This source code is proprietary and confidential.
 * Unauthorized copying or distribution is strictly prohibited.
 * 
 * @license Proprietary
 */

// CSS is imported via shared-styles.ts with ?inline for Shadow DOM injection
// import './styles.css'; // Removed - we don't need a separate CSS file

// Import the widget manager and components
import { WidgetManager } from './core/widget-manager';
import { ShoprocketElement } from './core/base-component';
import { ProductCatalog } from './components/product-catalog';
import { ProductDetail } from './components/product-detail';
import { ProductView } from './components/product-view';
import { CartWidget } from './components/cart';
import { initializeConfig, getConfig } from './core/config';

// ProductGrid and CartWidget are now imported from their respective files

// Declare global types
declare global {
  interface Window {
    Shoprocket: WidgetManager;
    __shoprocketComponents: Record<string, typeof ShoprocketElement>;
  }
}

// The loader ensures this script only runs once, so we can proceed directly

// Capture script info immediately while currentScript is available
const scriptUrl = (document.currentScript as HTMLScriptElement)?.src || '';

// Create global instance
const shoprocket = new WidgetManager();

// Expose to window
window.Shoprocket = shoprocket;

/**
 * Shoprocket Widget Events
 * 
 * The widget emits various events that you can listen to for integration:
 * 
 * @example
 * // Listen for cart updates
 * window.addEventListener('shoprocket:cart:updated', (event) => {
 *   console.log('Cart updated:', event.detail.cart);
 *   console.log('Total items:', event.detail.cart.total_items);
 *   console.log('Total price:', event.detail.cart.total);
 * });
 * 
 * @example
 * // Listen for product added to cart
 * window.addEventListener('shoprocket:product:added', (event) => {
 *   console.log('Product added:', event.detail.product);
 *   // Show custom success message
 *   showNotification(`${event.detail.product.name} added to cart!`);
 * });
 * 
 * @example
 * // Listen for cart errors
 * window.addEventListener('shoprocket:cart:error', (event) => {
 *   console.error('Cart error:', event.detail.error);
 *   // Handle error in your app
 * });
 * 
 * Available events:
 * - 'shoprocket:cart:updated' - Fired when cart contents change
 *   @param {Object} event.detail.cart - Updated cart object with items, totals
 * 
 * - 'shoprocket:cart:loaded' - Fired when cart is initially loaded
 *   @param {Object} event.detail.cart - Loaded cart object
 * 
 * - 'shoprocket:product:added' - Fired when a product is successfully added to cart
 *   @param {Object} event.detail.product - Product that was added
 *   @param {Object} event.detail.variant - Selected variant (if applicable)
 *   @param {number} event.detail.quantity - Quantity added
 * 
 * - 'shoprocket:cart:error' - Fired when cart operations fail
 *   @param {string} event.detail.error - Error message
 *   @param {string} event.detail.type - Error type (e.g., 'out_of_stock', 'network_error')
 */

/**
 * Shoprocket JavaScript SDK
 * 
 * The main entry point for controlling the Shoprocket widget programmatically.
 * 
 * @example
 * // Cart operations
 * Shoprocket.cart.open();
 * Shoprocket.cart.close();
 * Shoprocket.cart.toggle();
 * 
 * @example
 * // Open cart when user clicks a custom button
 * document.getElementById('my-cart-button').addEventListener('click', () => {
 *   Shoprocket.cart.open();
 * });
 * 
 * @example
 * // Toggle cart with keyboard shortcut
 * document.addEventListener('keydown', (e) => {
 *   if (e.key === 'c' && e.ctrlKey) {
 *     Shoprocket.cart.toggle();
 *   }
 * });
 */

/**
 * Get public key from script URL
 */
function getPublicKey(): string | null {
  if (!scriptUrl) return null;
  
  const url = new URL(scriptUrl);
  return url.searchParams.get('pk');
}


// Register components globally for the widget manager - MUST happen before autoInit
window.__shoprocketComponents = {
  'catalog': ProductCatalog,
  'product': ProductDetail,
  'product-view': ProductView,
  'cart': CartWidget
};

// Register all custom elements upfront - much simpler!
customElements.define('shoprocket-catalog', ProductCatalog);
customElements.define('shoprocket-product', ProductDetail);
customElements.define('shoprocket-product-view', ProductView);
customElements.define('shoprocket-cart', CartWidget);

/**
 * Initialize when DOM is ready
 */
function autoInit(): void {
  
  const publicKey = getPublicKey();
  
  if (!publicKey) {
    // No public key found - widget won't initialize
    return;
  }
  
  // Initialize config based on script URL
  initializeConfig(scriptUrl);
  
  // Get the config to pass API URL
  const { apiUrl } = getConfig();
  
  shoprocket.init(publicKey, { apiUrl }).catch(console.error);
}

// Auto-initialize on DOMContentLoaded or immediately if already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', autoInit);
} else {
  autoInit();
}

// Note: We don't export anything because this is bundled as IIFE
// The window.Shoprocket assignment above is what exposes our API