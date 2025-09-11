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
import { CartWidget } from './components/cart';
import { initializeConfig, getConfig } from './core/config';

// ProductGrid and CartWidget are now imported from their respective files

// Capture script info immediately while currentScript is available
const scriptUrl = (document.currentScript as HTMLScriptElement)?.src || '';

// Create global instance
const shoprocket = new WidgetManager();

// Expose to window
declare global {
  interface Window {
    Shoprocket: WidgetManager;
    ShoprocketSDK: {
      cart: {
        open: () => void;
        close: () => void;
        toggle: () => void;
      };
    };
  }
}
window.Shoprocket = shoprocket;

// Create SDK object using events for clean component communication
window.ShoprocketSDK = {
  cart: {
    open: () => window.dispatchEvent(new CustomEvent('open-cart', { bubbles: true })),
    close: () => window.dispatchEvent(new CustomEvent('close-cart', { bubbles: true })),
    toggle: () => window.dispatchEvent(new CustomEvent('toggle-cart', { bubbles: true }))
  }
};

/**
 * Get public key from script URL
 */
function getPublicKey(): string | null {
  if (!scriptUrl) return null;
  
  const url = new URL(scriptUrl);
  return url.searchParams.get('pk');
}


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

// Register components globally for the widget manager
declare global {
  interface Window {
    __shoprocketComponents: Record<string, typeof ShoprocketElement>;
  }
}
window.__shoprocketComponents = {
  'catalog': ProductCatalog,      // Full browsable catalog
  'products': ProductCatalog,      // Alias for backward compatibility
  'product-catalog': ProductCatalog,
  'product': ProductDetail,       // Single product detail
  'product-detail': ProductDetail,
  'cart': CartWidget
};

// Auto-initialize on DOMContentLoaded or immediately if already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', autoInit);
} else {
  autoInit();
}

// Export for module usage
export { WidgetManager, ShoprocketElement, ProductCatalog, ProductDetail, CartWidget };