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
    ShoprocketSDK: {
      cart: {
        open: () => void;
        close: () => void;
        toggle: () => void;
      };
    };
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