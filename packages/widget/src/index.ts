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

// Import core only - components will be lazy-loaded
import { WidgetManager } from './core/widget-manager';
import { ShoprocketElement } from './core/base-component';
import { Tooltip } from './components/tooltip';
import { TestModeBanner } from './components/test-mode-banner';
import { Toggle } from './components/toggle';
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
// Note: CLS prevention is handled by loader.js (sets inline min-height before bundle loads)
// Components clear these inline styles when content is ready (see product-catalog.ts, etc.)

// Capture script info - different methods for ES modules vs IIFE
// ES modules: Use import.meta.url (most reliable)
// IIFE: Use document.currentScript or fallback to bundle script tag
const scriptUrl = (typeof import.meta !== 'undefined' && import.meta.url)
  ? import.meta.url
  : (document.currentScript as HTMLScriptElement)?.src || '';

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
 * Get public key from data attribute set by loader
 */
function getPublicKey(): string | null {
  // Loader sets data-pk on the bundle script tag (both ESM and IIFE)
  const bundleScript = document.querySelector('script[data-shoprocket-bundle="true"]');
  if (bundleScript) {
    return bundleScript.getAttribute('data-pk');
  }

  // Fallback: Check for any script with data-pk (direct bundle load without loader)
  const directScript = document.querySelector('script[data-pk][src*="shoprocket"]');
  if (directScript) {
    return directScript.getAttribute('data-pk');
  }

  return null;
}


// Component loader registry - maps widget type to lazy loader function
const componentLoaders: Record<string, () => Promise<typeof ShoprocketElement>> = {
  'catalog': async () => {
    const { ProductCatalog } = await import('./components/product-catalog');
    return ProductCatalog;
  },
  'product': async () => {
    const { ProductDetail } = await import('./components/product-detail');
    return ProductDetail;
  },
  'product-view': async () => {
    const { ProductView } = await import('./components/product-view');
    return ProductView;
  },
  'buy-button': async () => {
    const { BuyButton } = await import('./components/buy-button');
    return BuyButton;
  },
  'cart': async () => {
    const { CartWidget } = await import('./components/cart');
    return CartWidget;
  },
  'categories': async () => {
    const { CategoriesWidget } = await import('./components/categories');
    return CategoriesWidget;
  }
};

// Register lazy-loaded components
window.__shoprocketComponents = new Proxy({} as Record<string, typeof ShoprocketElement>, {
  get(target, prop: string) {
    // If component already loaded, return it
    if (target[prop]) {
      return target[prop];
    }

    // Otherwise trigger lazy load (will be awaited by widget manager)
    const loader = componentLoaders[prop];
    if (loader) {
      // Return a promise that resolves to the component
      return loader().then(Component => {
        target[prop] = Component;
        return Component;
      });
    }

    return undefined;
  }
});

// Register small utility components immediately
if (!customElements.get('sr-tooltip')) {
  customElements.define('sr-tooltip', Tooltip);
}
if (!customElements.get('shoprocket-test-banner')) {
  customElements.define('shoprocket-test-banner', TestModeBanner);
}
if (!customElements.get('shoprocket-toggle')) {
  customElements.define('shoprocket-toggle', Toggle);
}

/**
 * Initialize when DOM is ready
 */
function autoInit(): void {
  // Prevent multiple initializations
  if ((window as any).__shoprocketAutoInitRan) {
    return;
  }
  (window as any).__shoprocketAutoInitRan = true;

  const publicKey = getPublicKey();

  if (!publicKey) {
    // No public key found - widget won't initialize
    return;
  }

  // Initialize config based on script URL
  // scriptUrl is already set from import.meta.url (ES modules) or document.currentScript (IIFE)
  // Final fallback: try to find bundle script tag
  const configUrl = scriptUrl || (document.querySelector('script[data-shoprocket-bundle="true"]') as HTMLScriptElement)?.src || '';
  initializeConfig(configUrl);

  // Get the config to pass API URL
  const { apiUrl } = getConfig();

  // Note: Preconnect hints are now added in loader.js (before bundle loads)
  // This catches the first API request much earlier for better LCP

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